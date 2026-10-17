import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { auditMedia } from "../lib/audit"
import { deleteMediaAction } from "../lib/actions"
import type { SeerrClient } from "../lib/clients/seerr"
import type { JellyfinClient } from "../lib/clients/jellyfin"
import type { JellyfinItem, JellyfinUser, SeerrRequest } from "../types"

describe("Jellyfin Filter & TV Hierarchy Seam", () => {
  it("omits requests where media does not exist in Jellyfin library", async () => {
    const mockRequests: SeerrRequest[] = [
      {
        id: 1,
        status: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedBy: { id: 10, username: "alice" },
        is4k: false,
        media: {
          id: 101,
          tmdbId: 550, // Exists in Jellyfin
          status: 5,
          mediaType: "movie",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: 2,
        status: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedBy: { id: 11, username: "bob" },
        is4k: false,
        media: {
          id: 102,
          tmdbId: 999999, // Unacquired - NOT in Jellyfin
          status: 3,
          mediaType: "movie",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: 3,
        status: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedBy: { id: 10, username: "alice" },
        is4k: false,
        media: {
          id: 103,
          tmdbId: 1399, // TV series - exists in Jellyfin
          status: 5,
          mediaType: "tv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: 4,
        status: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedBy: { id: 12, username: "charlie" },
        is4k: false,
        media: {
          id: 104,
          tmdbId: 1399, // Duplicate request for same TV series
          status: 5,
          mediaType: "tv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]

    const mockJellyfinUsers: JellyfinUser[] = [{ Id: "u-alice", Name: "alice" }]

    const mockLibraryItems: JellyfinItem[] = [
      {
        Id: "jf-movie-550",
        Name: "Fight Club",
        Type: "Movie",
        ProviderIds: { Tmdb: "550" },
      },
      {
        Id: "jf-tv-1399",
        Name: "Game of Thrones",
        Type: "Series",
        ProviderIds: { Tmdb: "1399" },
      },
    ]

    const mockSeerrClient = {
      getRequests: async () => mockRequests,
      getMediaDetails: async () => ({ id: 550, title: "Fight Club" }),
    } as unknown as SeerrClient

    const mockJellyfinClient = {
      getUsers: async () => mockJellyfinUsers,
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async () => [],
    } as unknown as JellyfinClient

    const report = await auditMedia({
      seerrClient: mockSeerrClient,
      jellyfinClient: mockJellyfinClient,
    })

    // Assert: Only Fight Club (550) and Game of Thrones (1399) should be in report.
    // 999999 (not in Jellyfin) must be filtered out.
    // Duplicate TV request for 1399 must be deduplicated into a single parent row.
    assert.equal(report.items.length, 2)
    assert.equal(report.items[0].tmdbId, 550)
    assert.equal(report.items[0].title, "Fight Club")
    assert.equal(report.items[1].tmdbId, 1399)
    assert.equal(report.items[1].title, "Game of Thrones")
  })

  it("deleteMediaAction handles single episode target", async () => {
    let capturedUrl = ""
    let capturedMethod = ""

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (
      url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedUrl = url.toString()
      capturedMethod = init?.method || "GET"

      if (capturedUrl.includes("/api/v3/series")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 88, title: "Breaking Bad", tmdbId: 1396, tvdbId: 81189 },
          ],
        } as unknown as Response
      }

      if (
        capturedUrl.includes("/api/v3/episodefile/5001") &&
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

    try {
      // Mock Sonarr env
      process.env.SONARR_URL = "http://sonarr:8989"
      process.env.SONARR_API_KEY = "test-key"

      const res = await deleteMediaAction({
        id: "ep-123",
        tmdbId: 1396,
        mediaType: "tv",
        target: "single_episode",
        episodeFileId: 5001,
      })

      assert.equal(res.success, true)
      assert.ok(capturedUrl.includes("/api/v3/episodefile/5001"))
      assert.equal(capturedMethod, "DELETE")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("deleteMediaAction is rejected when DISABLE_DELETE is enabled", async () => {
    const prevEnv = process.env.DISABLE_DELETE
    try {
      process.env.DISABLE_DELETE = "true"

      const res = await deleteMediaAction({
        id: "ep-123",
        tmdbId: 1396,
        mediaType: "tv",
        target: "single_episode",
        episodeFileId: 5001,
      })

      assert.equal(res.success, false)
      assert.equal(
        "error" in res ? res.error : undefined,
        "Delete functionality is disabled"
      )
    } finally {
      if (prevEnv !== undefined) {
        process.env.DISABLE_DELETE = prevEnv
      } else {
        delete process.env.DISABLE_DELETE
      }
    }
  })
})
