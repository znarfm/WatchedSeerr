import { describe, it, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { GET as getPoster } from "../app/api/proxy/poster/route"
import { GET as getAvatar } from "../app/api/proxy/avatar/route"

describe("Image Proxy Seam", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  it("poster route returns 400 when missing required parameters", async () => {
    const req = new Request("http://localhost/api/proxy/poster")
    const res = await getPoster(req)
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.ok(data.error)
  })

  it("poster route proxies jellyfin image if jellyfinItemId provided", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    process.env.JELLYFIN_API_KEY = "jf-key"

    let requestedUrl = ""
    let requestedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = url.toString()
      requestedHeaders = (init?.headers as Record<string, string>) || {}
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    }) as typeof globalThis.fetch

    const req = new Request("http://localhost/api/proxy/poster?jellyfinItemId=jf-item-123")
    const res = await getPoster(req)

    assert.equal(res.status, 200)
    assert.equal(res.headers.get("Content-Type"), "image/jpeg")
    assert.ok(res.headers.get("Cache-Control")?.includes("max-age=86400"))
    assert.ok(requestedUrl.includes("/Items/jf-item-123/Images/Primary?maxWidth=240&quality=80"))
    assert.ok(requestedHeaders["Authorization"]?.includes('Token="jf-key"'))

    globalThis.fetch = originalFetch
  })

  it("poster route respects custom width and tag with immutable header", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    process.env.JELLYFIN_API_KEY = "jf-key"

    let requestedUrl = ""
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = url.toString()
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    }) as typeof globalThis.fetch

    const req = new Request("http://localhost/api/proxy/poster?jellyfinItemId=jf-item-123&w=400&tag=tag123")
    const res = await getPoster(req)

    assert.equal(res.status, 200)
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable")
    assert.ok(requestedUrl.includes("/Items/jf-item-123/Images/Primary?maxWidth=400&quality=80&tag=tag123"))

    globalThis.fetch = originalFetch
  })

  it("avatar route returns 400 when missing userId and avatar params", async () => {
    const req = new Request("http://localhost/api/proxy/avatar")
    const res = await getAvatar(req)
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.ok(data.error)
  })

  it("avatar route proxies jellyfin avatar for userId", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    process.env.JELLYFIN_API_KEY = "jf-key"

    let requestedUrl = ""
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = url.toString()
      return new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    }) as typeof globalThis.fetch

    const req = new Request("http://localhost/api/proxy/avatar?userId=user-456")
    const res = await getAvatar(req)

    assert.equal(res.status, 200)
    assert.equal(res.headers.get("Content-Type"), "image/png")
    assert.ok(res.headers.get("Cache-Control")?.includes("max-age=86400"))
    assert.ok(requestedUrl.includes("/Users/user-456/Images/Primary?maxWidth=96&quality=80"))

    globalThis.fetch = originalFetch
  })

  it("avatar route includes tag and returns immutable header when tag is present", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    process.env.JELLYFIN_API_KEY = "jf-key"

    let requestedUrl = ""
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = url.toString()
      return new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    }) as typeof globalThis.fetch

    const req = new Request("http://localhost/api/proxy/avatar?userId=user-456&tag=tag456")
    const res = await getAvatar(req)

    assert.equal(res.status, 200)
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable")
    assert.ok(requestedUrl.includes("/Users/user-456/Images/Primary?maxWidth=96&quality=80&tag=tag456"))

    globalThis.fetch = originalFetch
  })

  it("poster route returns 404 with Cache-Control header when upstream not found", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    globalThis.fetch = (async () => {
      return new Response("Not found", { status: 404 })
    }) as unknown as typeof globalThis.fetch

    const req = new Request("http://localhost/api/proxy/poster?jellyfinItemId=missing-123")
    const res = await getPoster(req)

    assert.equal(res.status, 404)
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=3600")
    const body = await res.json()
    assert.equal(body.error, "Poster not found")

    globalThis.fetch = originalFetch
  })

  it("avatar route returns 404 with Cache-Control header when upstream not found", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    globalThis.fetch = (async () => {
      return new Response("Not found", { status: 404 })
    }) as unknown as typeof globalThis.fetch

    const req = new Request("http://localhost/api/proxy/avatar?userId=missing-user")
    const res = await getAvatar(req)

    assert.equal(res.status, 404)
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=3600")
    const body = await res.json()
    assert.equal(body.error, "Avatar not found")

    globalThis.fetch = originalFetch
  })

  it("poster route serves repeated requests from in-memory cache without calling fetch again", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    let callCount = 0

    globalThis.fetch = (async () => {
      callCount++
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    }) as unknown as typeof globalThis.fetch

    const req1 = new Request("http://localhost/api/proxy/poster?jellyfinItemId=cache-poster-1")
    const res1 = await getPoster(req1)
    assert.equal(res1.status, 200)
    assert.equal(callCount, 1)

    const req2 = new Request("http://localhost/api/proxy/poster?jellyfinItemId=cache-poster-1")
    const res2 = await getPoster(req2)
    assert.equal(res2.status, 200)
    assert.equal(callCount, 1, "fetch should not be called a second time")

    globalThis.fetch = originalFetch
  })

  it("avatar route serves repeated requests from in-memory cache without calling fetch again", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    let callCount = 0

    globalThis.fetch = (async () => {
      callCount++
      return new Response(new Uint8Array([7, 8, 9]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    }) as unknown as typeof globalThis.fetch

    const req1 = new Request("http://localhost/api/proxy/avatar?userId=cache-user-1")
    const res1 = await getAvatar(req1)
    assert.equal(res1.status, 200)
    assert.equal(callCount, 1)

    const req2 = new Request("http://localhost/api/proxy/avatar?userId=cache-user-1")
    const res2 = await getAvatar(req2)
    assert.equal(res2.status, 200)
    assert.equal(callCount, 1, "fetch should not be called a second time")

    globalThis.fetch = originalFetch
  })

  it("caches 404 responses so repeated missing requests do not call fetch again", async () => {
    process.env.JELLYFIN_URL = "http://jellyfin:8096"
    let callCount = 0

    globalThis.fetch = (async () => {
      callCount++
      return new Response("Not found", { status: 404 })
    }) as unknown as typeof globalThis.fetch

    const req1 = new Request("http://localhost/api/proxy/poster?jellyfinItemId=missing-cache-1")
    const res1 = await getPoster(req1)
    assert.equal(res1.status, 404)
    assert.equal(callCount, 1)

    const req2 = new Request("http://localhost/api/proxy/poster?jellyfinItemId=missing-cache-1")
    const res2 = await getPoster(req2)
    assert.equal(res2.status, 404)
    assert.equal(callCount, 1, "fetch should not be called a second time for 404")

    globalThis.fetch = originalFetch
  })
})
