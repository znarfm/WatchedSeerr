import { describe, it, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { RadarrClient } from "../lib/clients/radarr"
import { SonarrClient } from "../lib/clients/sonarr"

describe("Arr Clients Seam", () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  it("RadarrClient looks up movie by tmdbId and deletes files", async () => {
    let capturedUrl = ""
    let capturedMethod = ""
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedUrl = url.toString()
      capturedMethod = init?.method || "GET"
      capturedHeaders = (init?.headers as Record<string, string>) || {}

      if (capturedUrl.includes("/api/v3/movie?tmdbId=157336")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 42, title: "Interstellar", tmdbId: 157336, hasFile: true },
          ],
        } as unknown as Response
      }

      if (
        capturedUrl.includes("/api/v3/movie/42") &&
        capturedMethod === "DELETE"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as unknown as Response
      }

      return { ok: false, status: 404 } as unknown as Response
    }) as typeof globalThis.fetch

    const radarr = new RadarrClient("http://radarr:7878", "test-radarr-key")
    const movie = await radarr.getMovieByTmdbId(157336)
    assert.ok(movie)
    assert.equal(movie?.id, 42)
    assert.equal(movie?.title, "Interstellar")

    const deleted = await radarr.deleteMovie(42, true)
    assert.equal(deleted, true)
    assert.ok(capturedUrl.includes("deleteFiles=true"))
    assert.equal(capturedHeaders["X-Api-Key"], "test-radarr-key")

    globalThis.fetch = originalFetch
  })

  it("SonarrClient looks up series by tmdbId and deletes episode files", async () => {
    let capturedUrl = ""
    let capturedMethod = ""
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedUrl = url.toString()
      capturedMethod = init?.method || "GET"
      capturedHeaders = (init?.headers as Record<string, string>) || {}

      if (capturedUrl.includes("/api/v3/series")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 99,
              title: "Arcane",
              tmdbId: 94605,
              tvdbId: 374000,
              monitored: true,
            },
          ],
        } as unknown as Response
      }

      if (
        capturedUrl.includes("/api/v3/episodefile/1001") &&
        capturedMethod === "DELETE"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as unknown as Response
      }

      return { ok: false, status: 404 } as unknown as Response
    }) as typeof globalThis.fetch

    const sonarr = new SonarrClient("http://sonarr:8989", "test-sonarr-key")
    const series = await sonarr.getSeriesByTmdbId(94605)
    assert.ok(series)
    assert.equal(series?.id, 99)
    assert.equal(series?.title, "Arcane")

    const deletedEp = await sonarr.deleteEpisodeFile(1001)
    assert.equal(deletedEp, true)
    assert.equal(capturedHeaders["X-Api-Key"], "test-sonarr-key")

    globalThis.fetch = originalFetch
  })
})
