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
    assert.ok(requestedUrl.includes("/Items/jf-item-123/Images/Primary"))
    assert.ok(requestedHeaders["Authorization"]?.includes('Token="jf-key"'))

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
    assert.ok(requestedUrl.includes("/Users/user-456/Images/Primary"))

    globalThis.fetch = originalFetch
  })
})
