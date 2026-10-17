import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { auditMedia } from "../lib/audit"
import type { SeerrClient } from "../lib/clients/seerr"
import type { JellyfinClient } from "../lib/clients/jellyfin"

describe("Audit Enrichment Seam", () => {
  it("enriches audit item with overview, genres, quality, and posterPath", async () => {
    const mockSeerr = {
      getRequests: async () => [
        {
          id: 101,
          status: 2,
          media: {
            id: 201,
            tmdbId: 550,
            mediaType: "movie" as const,
            status: 5,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          requestedBy: {
            id: 1,
            username: "alice",
            avatar: "/avatar/alice.png",
          },
          is4k: false,
        },
      ],
      getMediaDetails: async () => ({
        id: 550,
        title: "Fight Club",
        overview: "An insomniac office worker...",
        genres: [
          { id: 18, name: "Drama" },
          { id: 53, name: "Thriller" },
        ],
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      }),
    } as unknown as SeerrClient

    const mockJellyfin = {
      getUsers: async () => [{ Id: "jf-u1", Name: "alice" }],
      getAllLibraryItems: async () => [
        {
          Id: "jf-item-550",
          Name: "Fight Club",
          ProductionYear: 1999,
          Type: "Movie" as const,
          ProviderIds: { Tmdb: "550" },
          Overview: "An insomniac office worker and a soap maker...",
          Size: 15368709120, // ~14.3 GB
          MediaSources: [
            {
              MediaStreams: [{ Type: "Video", DisplayTitle: "1080p HEVC" }],
            },
          ],
        },
      ],
      getAllUserItems: async () => [],
    } as unknown as JellyfinClient

    const report = await auditMedia({
      seerrClient: mockSeerr,
      jellyfinClient: mockJellyfin,
    })

    assert.equal(report.items.length, 1)
    const item = report.items[0]
    assert.equal(item.title, "Fight Club")
    assert.ok(item.overview?.includes("insomniac"))
    assert.deepEqual(item.genres, ["Drama", "Thriller"])
    assert.equal(item.posterPath, "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg")
    assert.equal(item.requester.avatar, "/avatar/alice.png")
    assert.equal(item.sizeBytes, 15368709120)
  })
})
