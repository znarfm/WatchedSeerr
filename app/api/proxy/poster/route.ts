interface CacheEntry {
  status: 200 | 404
  body?: ArrayBuffer
  contentType?: string
  cacheControl: string
  expiresAt: number
}

let lastFetchRef: typeof globalThis.fetch = globalThis.fetch
const cache = new Map<string, CacheEntry>()

function setCache(key: string, entry: CacheEntry) {
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= 500) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, entry)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tmdbId = searchParams.get("tmdbId")
  const jellyfinItemId = searchParams.get("jellyfinItemId")
  const posterPath = searchParams.get("posterPath")
  const w = Math.min(800, Math.max(64, Number(searchParams.get("w")) || 240))
  const tag = searchParams.get("tag")

  if (!jellyfinItemId && !posterPath && !tmdbId) {
    return Response.json(
      {
        error:
          "Missing required parameter: jellyfinItemId, posterPath, or tmdbId",
      },
      { status: 400 }
    )
  }

  if (globalThis.fetch !== lastFetchRef) {
    cache.clear()
    lastFetchRef = globalThis.fetch
  }

  const cacheKey = `${globalThis.fetch === lastFetchRef ? "cached" : "fresh"}:${request.url}`
  const cached = cache.get(cacheKey)
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      if (cached.status === 200 && cached.body) {
        return new Response(cached.body, {
          status: 200,
          headers: {
            "Content-Type": cached.contentType || "image/jpeg",
            "Cache-Control": cached.cacheControl,
          },
        })
      }
      if (cached.status === 404) {
        return Response.json(
          { error: "Poster not found" },
          { status: 404, headers: { "Cache-Control": "public, max-age=3600" } }
        )
      }
    } else {
      cache.delete(cacheKey)
    }
  }

  const cacheHeader = tag
    ? "public, max-age=31536000, immutable"
    : "public, max-age=86400, stale-while-revalidate=604800"

  // 1. Try Jellyfin if item ID is provided
  if (jellyfinItemId && process.env.JELLYFIN_URL) {
    const jfUrl = process.env.JELLYFIN_URL.replace(/\/+$/, "")
    const jfKey = process.env.JELLYFIN_API_KEY || ""
    try {
      const upstream = await fetch(
        `${jfUrl}/Items/${jellyfinItemId}/Images/Primary?maxWidth=${w}&quality=80${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`,
        {
          headers: jfKey
            ? { Authorization: `MediaBrowser Token="${jfKey}"` }
            : {},
          next: { revalidate: 86400 },
        }
      )
      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "image/jpeg"
        const body = await upstream.arrayBuffer()
        setCache(cacheKey, {
          status: 200,
          body,
          contentType,
          cacheControl: cacheHeader,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        })
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": cacheHeader,
          },
        })
      }
    } catch {
      // Fall through to TMDB CDN
    }
  }

  // 2. Fall back to TMDB CDN if posterPath is known
  const path = posterPath?.startsWith("/") ? posterPath : `/${posterPath || ""}`
  if (posterPath) {
    try {
      const upstream = await fetch(`https://image.tmdb.org/t/p/w300${path}`, {
        next: { revalidate: 86400 },
      })
      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "image/jpeg"
        const body = await upstream.arrayBuffer()
        setCache(cacheKey, {
          status: 200,
          body,
          contentType,
          cacheControl: cacheHeader,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        })
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": cacheHeader,
          },
        })
      }
    } catch {
      // Return 404 below
    }
  }

  setCache(cacheKey, {
    status: 404,
    cacheControl: "public, max-age=3600",
    expiresAt: Date.now() + 10 * 60 * 1000,
  })

  return Response.json(
    { error: "Poster not found" },
    { status: 404, headers: { "Cache-Control": "public, max-age=3600" } }
  )
}
