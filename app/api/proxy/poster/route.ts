export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tmdbId = searchParams.get("tmdbId")
  const mediaType = searchParams.get("mediaType")
  const jellyfinItemId = searchParams.get("jellyfinItemId")
  const posterPath = searchParams.get("posterPath")

  if (!jellyfinItemId && !posterPath && !tmdbId) {
    return Response.json(
      { error: "Missing required parameter: jellyfinItemId, posterPath, or tmdbId" },
      { status: 400 }
    )
  }

  const cacheHeader = "public, max-age=86400, stale-while-revalidate=604800"

  // 1. Try Jellyfin if item ID is provided
  if (jellyfinItemId && process.env.JELLYFIN_URL) {
    const jfUrl = process.env.JELLYFIN_URL.replace(/\/+$/, "")
    const jfKey = process.env.JELLYFIN_API_KEY || ""
    try {
      const upstream = await fetch(`${jfUrl}/Items/${jellyfinItemId}/Images/Primary`, {
        headers: jfKey ? { Authorization: `MediaBrowser Token="${jfKey}"` } : {},
      })
      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "image/jpeg"
        return new Response(upstream.body, {
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
      const upstream = await fetch(`https://image.tmdb.org/t/p/w300${path}`)
      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "image/jpeg"
        return new Response(upstream.body, {
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

  return Response.json({ error: "Poster not found" }, { status: 404 })
}
