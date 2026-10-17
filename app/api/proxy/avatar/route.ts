export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")
  const avatar = searchParams.get("avatar")

  if (!userId && !avatar) {
    return Response.json(
      { error: "Missing required parameter: userId or avatar" },
      { status: 400 }
    )
  }

  const cacheHeader = "public, max-age=86400"

  // 1. Jellyfin avatar proxy
  if (userId && process.env.JELLYFIN_URL) {
    const jfUrl = process.env.JELLYFIN_URL.replace(/\/+$/, "")
    const jfKey = process.env.JELLYFIN_API_KEY || ""
    try {
      const upstream = await fetch(`${jfUrl}/Users/${userId}/Images/Primary`, {
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
      // Fall through
    }
  }

  // 2. Seerr avatar proxy
  if (avatar) {
    let avatarUrl = avatar
    if (!avatar.startsWith("http://") && !avatar.startsWith("https://")) {
      const seerrUrl = (process.env.SEERR_URL || "").replace(/\/+$/, "")
      avatarUrl = `${seerrUrl}${avatar.startsWith("/") ? "" : "/"}${avatar}`
    }
    const seerrKey = process.env.SEERR_API_KEY || ""

    try {
      const upstream = await fetch(avatarUrl, {
        headers: seerrKey ? { "X-Api-Key": seerrKey } : {},
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
      // Return 404 below
    }
  }

  return Response.json({ error: "Avatar not found" }, { status: 404 })
}
