import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { auditMedia, invalidateAuditCache } from "../lib/audit"
import {
  getSeriesEpisodesAction,
  refreshAuditAction,
  toggleWhitelistAction,
  deleteMediaAction,
} from "../lib/actions"
import { SeerrClient } from "../lib/clients/seerr"
import { JellyfinClient } from "../lib/clients/jellyfin"
import type {
  SeerrRequest,
  SeerrUser,
  JellyfinItem,
  JellyfinUser,
} from "../types"

describe("User Reconciliation and Watch Status Seam", () => {
  it("SeerrClient.getUsers fetches /api/v1/user with take parameter", async () => {
    let capturedUrl = ""
    const client = new SeerrClient("http://seerr.test", "api-key")
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = url.toString()
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 1, displayName: "Meinard", jellyfinUserId: "u-1" }],
        }),
      } as unknown as Response
    }) as typeof globalThis.fetch

    try {
      const users = await client.getUsers(50)
      assert.equal(capturedUrl, "http://seerr.test/api/v1/user?take=50")
      assert.equal(users.length, 1)
      assert.equal(users[0].displayName, "Meinard")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("JellyfinClient query endpoints include optimized fields and parameters", async () => {
    const capturedUrls: string[] = []
    const client = new JellyfinClient("http://jellyfin.test", "api-key")
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrls.push(url.toString())
      return {
        ok: true,
        status: 200,
        json: async () => ({ Items: [], TotalRecordCount: 0 }),
      } as unknown as Response
    }) as typeof globalThis.fetch

    try {
      await client.getAllLibraryItems()
      await client.getAllUserItems("user-xyz")

      assert.equal(
        capturedUrls[0],
        "http://jellyfin.test/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,ProductionYear,RunTimeTicks,Path,Overview,Genres,MediaStreams,MediaSources,Size,ImageTags&EnableUserData=false&Limit=5000"
      )
      assert.equal(
        capturedUrls[1],
        "http://jellyfin.test/Users/user-xyz/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=UserData&EnableImages=false&EnableTotalRecordCount=false&Limit=5000"
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("reconciles user identities to canonical Seerr display names and handles avatars accurately", async () => {
    const mockSeerrUsers: SeerrUser[] = [
      {
        id: 1,
        displayName: "Meinard",
        username: "meinard",
        jellyfinUsername: "nard",
        jellyfinUserId: "u-nard-1234",
        avatar: "/avatar/meinard.jpg",
      },
      {
        id: 2,
        displayName: "Family",
        username: "family",
        jellyfinUsername: "fam",
        jellyfinUserId: "u-fam-5678",
      },
    ]

    const mockRequests: SeerrRequest[] = [
      {
        id: 1,
        status: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        requestedBy: mockSeerrUsers[0],
        is4k: false,
        media: {
          id: 101,
          tmdbId: 550,
          status: 5,
          mediaType: "movie",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    ]

    const mockJellyfinUsers: JellyfinUser[] = [
      { Id: "unard1234", Name: "nard", PrimaryImageTag: "tag-nard" },
      { Id: "ufam5678", Name: "fam" }, // No PrimaryImageTag
      { Id: "ujenna", Name: "jenna" }, // No Seerr user, no PrimaryImageTag
    ]

    const mockLibraryItems: JellyfinItem[] = [
      {
        Id: "jf-movie-550",
        Name: "Fight Club",
        Type: "Movie",
        ProviderIds: { Tmdb: "550" },
      },
    ]

    const mockUserItems: JellyfinItem[] = [
      {
        Id: "jf-movie-550",
        Name: "Fight Club",
        Type: "Movie",
        UserData: {
          PlaybackPositionTicks: 0,
          PlayCount: 1,
          IsFavorite: false,
          Played: true,
        },
      },
    ]

    const mockSeerr = {
      getUsers: async () => mockSeerrUsers,
      getRequests: async () => mockRequests,
      getMediaDetails: async () => ({ id: 550, title: "Fight Club" }),
    } as unknown as SeerrClient

    const mockJellyfin = {
      getUsers: async () => mockJellyfinUsers,
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async (userId: string) =>
        userId === "unard1234" ? mockUserItems : [],
    } as unknown as JellyfinClient

    const report = await auditMedia({
      seerrClient: mockSeerr,
      jellyfinClient: mockJellyfin,
    })

    assert.equal(report.items.length, 1)
    const item = report.items[0]

    // Canonical display name on requester and requesterState
    assert.equal(item.requester.username, "Meinard")
    assert.equal(item.requesterState.username, "Meinard")
    assert.equal(item.requesterState.userId, "unard1234")
    assert.equal(item.requesterState.status, "completed")
    assert.equal(
      item.requesterState.avatarUrl,
      "/api/proxy/avatar?userId=unard1234&tag=tag-nard"
    )
    assert.equal(
      item.requester.requesterAvatarUrl,
      "/api/proxy/avatar?userId=unard1234&tag=tag-nard"
    )

    // Household states should have canonical display names and avatar presence
    const famState = item.householdStates.find((h) => h.userId === "ufam5678")
    assert.ok(famState, "Family user exists in householdStates")
    assert.equal(famState.username, "Family")
    assert.equal(
      famState.avatarUrl,
      undefined,
      "fam has no PrimaryImageTag so avatarUrl is undefined"
    )

    const jennaState = item.householdStates.find((h) => h.userId === "ujenna")
    assert.ok(jennaState, "jenna user exists in householdStates")
    assert.equal(jennaState.username, "jenna")
    assert.equal(
      jennaState.avatarUrl,
      undefined,
      "jenna has no PrimaryImageTag so avatarUrl is undefined"
    )
  })

  it("marks movie with PlayCount > 0 and Played: false as unplayed (0%)", async () => {
    const mockRequests: SeerrRequest[] = [
      {
        id: 10,
        status: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        requestedBy: { id: 1, username: "alice" },
        is4k: false,
        media: {
          id: 101,
          tmdbId: 600,
          status: 5,
          mediaType: "movie",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    ]

    const mockJellyfinUsers: JellyfinUser[] = [{ Id: "u-alice", Name: "alice" }]

    const mockLibraryItems: JellyfinItem[] = [
      {
        Id: "jf-600",
        Name: "Movie 600",
        Type: "Movie",
        ProviderIds: { Tmdb: "600" },
        MediaSources: [{ Size: 4500000000 }],
      },
    ]

    const mockUserItems: JellyfinItem[] = [
      {
        Id: "jf-600",
        Name: "Movie 600",
        Type: "Movie",
        UserData: {
          PlaybackPositionTicks: 0,
          PlayCount: 3,
          IsFavorite: false,
          Played: false,
          LastPlayedDate: "2026-02-01T00:00:00Z",
        },
      },
    ]

    const mockSeerr = {
      getUsers: async () => [
        { id: 1, username: "alice", displayName: "Alice D" },
      ],
      getRequests: async () => mockRequests,
      getMediaDetails: async () => {
        throw new Error(
          "Should not be called when jellyfinItem.Name is present"
        )
      },
    } as unknown as SeerrClient

    const mockJellyfin = {
      getUsers: async () => mockJellyfinUsers,
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async () => mockUserItems,
    } as unknown as JellyfinClient

    const report = await auditMedia({
      seerrClient: mockSeerr,
      jellyfinClient: mockJellyfin,
    })

    assert.equal(report.items.length, 1)
    const item = report.items[0]
    assert.equal(item.requesterState.status, "unplayed")
    assert.equal(item.requesterState.progressPercent, 0)
    assert.equal(item.requesterState.lastPlayedDate, undefined)
    assert.equal(item.requesterState.playCount, 0)
    assert.equal(item.sizeBytes, 4500000000)
  })

  it("handles TV series PlayedPercentage accurately for in_progress and completed", async () => {
    const mockRequests: SeerrRequest[] = [
      {
        id: 20,
        status: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        requestedBy: { id: 1, username: "alice" },
        is4k: false,
        media: {
          id: 102,
          tmdbId: 700,
          status: 5,
          mediaType: "tv",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
      {
        id: 21,
        status: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        requestedBy: { id: 2, username: "bob" },
        is4k: false,
        media: {
          id: 103,
          tmdbId: 800,
          status: 5,
          mediaType: "tv",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    ]

    const mockJellyfinUsers: JellyfinUser[] = [
      { Id: "u-alice", Name: "alice" },
      { Id: "u-bob", Name: "bob" },
    ]

    const mockLibraryItems: JellyfinItem[] = [
      {
        Id: "jf-700",
        Name: "Show 700",
        Type: "Series",
        ProviderIds: { Tmdb: "700" },
      },
      {
        Id: "jf-800",
        Name: "Show 800",
        Type: "Series",
        ProviderIds: { Tmdb: "800" },
      },
    ]

    const mockUserItemsAlice: JellyfinItem[] = [
      {
        Id: "jf-700",
        Name: "Show 700",
        Type: "Series",
        UserData: {
          PlaybackPositionTicks: 0,
          PlayCount: 0,
          IsFavorite: false,
          Played: false,
          PlayedPercentage: 45.4,
        },
      },
    ]

    const mockUserItemsBob: JellyfinItem[] = [
      {
        Id: "jf-800",
        Name: "Show 800",
        Type: "Series",
        UserData: {
          PlaybackPositionTicks: 0,
          PlayCount: 0,
          IsFavorite: false,
          Played: false,
          PlayedPercentage: 94.8,
        },
      },
    ]

    const mockSeerr = {
      getUsers: async () => [
        { id: 1, username: "alice" },
        { id: 2, username: "bob" },
      ],
      getRequests: async () => mockRequests,
    } as unknown as SeerrClient

    const mockJellyfin = {
      getUsers: async () => mockJellyfinUsers,
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async (userId: string) =>
        userId === "u-alice" ? mockUserItemsAlice : mockUserItemsBob,
    } as unknown as JellyfinClient

    const report = await auditMedia({
      seerrClient: mockSeerr,
      jellyfinClient: mockJellyfin,
    })

    const item700 = report.items.find((i) => i.tmdbId === 700)!
    assert.equal(item700.requesterState.status, "in_progress")
    assert.equal(item700.requesterState.progressPercent, 45)

    const item800 = report.items.find((i) => i.tmdbId === 800)!
    assert.equal(item800.requesterState.status, "completed")
    assert.equal(item800.requesterState.progressPercent, 100)
  })

  it("uses Seerr avatar fallback when user has no matched Jellyfin user", async () => {
    const mockRequests: SeerrRequest[] = [
      {
        id: 30,
        status: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        requestedBy: {
          id: 99,
          username: "external_guy",
          avatar: "https://external.domain/avatar.png",
        },
        is4k: false,
        media: {
          id: 104,
          tmdbId: 900,
          status: 5,
          mediaType: "movie",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    ]

    const mockLibraryItems: JellyfinItem[] = [
      {
        Id: "jf-900",
        Name: "Movie 900",
        Type: "Movie",
        ProviderIds: { Tmdb: "900" },
      },
    ]

    const mockSeerr = {
      getUsers: async () => [],
      getRequests: async () => mockRequests,
    } as unknown as SeerrClient

    const mockJellyfin = {
      getUsers: async () => [{ Id: "u-internal", Name: "internal_user" }],
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async () => [],
    } as unknown as JellyfinClient

    const report = await auditMedia({
      seerrClient: mockSeerr,
      jellyfinClient: mockJellyfin,
    })

    assert.equal(report.items.length, 1)
    const item = report.items[0]
    assert.equal(
      item.requester.requesterAvatarUrl,
      "/api/proxy/avatar?avatar=https%3A%2F%2Fexternal.domain%2Favatar.png"
    )
  })

  it("handles 60-second report cache and invalidateAuditCache", async () => {
    invalidateAuditCache()

    let fetchCount = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/api/v1/user")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ results: [] }),
        } as Response
      }
      if (urlStr.includes("/api/v1/request")) {
        fetchCount++
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                id: 50,
                status: 2,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
                requestedBy: { id: 1, username: "user1" },
                is4k: false,
                media: { id: 105, tmdbId: 1000, mediaType: "movie", status: 5 },
              },
            ],
          }),
        } as Response
      }
      if (urlStr.includes("/Users")) {
        return { ok: true, status: 200, json: async () => [] } as Response
      }
      if (urlStr.includes("/Items")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            Items: [
              {
                Id: "jf-1000",
                Name: "Item 1000",
                Type: "Movie",
                ProviderIds: { Tmdb: "1000" },
              },
            ],
          }),
        } as Response
      }
      return { ok: false, status: 404 } as Response
    }) as typeof globalThis.fetch

    try {
      process.env.SEERR_URL = "http://seerr.test"
      process.env.SEERR_API_KEY = "test-key"
      process.env.JELLYFIN_URL = "http://jellyfin.test"
      process.env.JELLYFIN_API_KEY = "test-key"

      const report1 = await auditMedia()
      assert.equal(fetchCount, 1)

      // Second call without custom options returns cached report
      const report2 = await auditMedia()
      assert.equal(fetchCount, 1)
      assert.equal(report1, report2)

      // Invalidating cache forces fresh fetch
      invalidateAuditCache()
      const report3 = await auditMedia()
      assert.equal(fetchCount, 2)
    } finally {
      invalidateAuditCache()
      globalThis.fetch = originalFetch
    }
  })

  it("getSeriesEpisodesAction forwards userId and respects Played status for episodes", async () => {
    let capturedUrl = ""
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request) => {
      capturedUrl = url.toString()
      return {
        ok: true,
        status: 200,
        json: async () => ({
          Items: [
            {
              Id: "ep-1",
              Name: "Pilot",
              IndexNumber: 1,
              ParentIndexNumber: 1,
              RunTimeTicks: 30000000000,
              UserData: {
                PlaybackPositionTicks: 0,
                PlayCount: 2,
                Played: true,
              },
            },
            {
              Id: "ep-2",
              Name: "Episode 2",
              IndexNumber: 2,
              ParentIndexNumber: 1,
              RunTimeTicks: 30000000000,
              UserData: {
                PlaybackPositionTicks: 0,
                PlayCount: 1,
                Played: false,
                LastPlayedDate: "2026-02-01T00:00:00Z",
              },
            },
          ],
        }),
      } as Response
    }) as typeof globalThis.fetch

    try {
      process.env.JELLYFIN_URL = "http://jellyfin.test"
      process.env.JELLYFIN_API_KEY = "test-key"

      const res = await getSeriesEpisodesAction("show-123", 1399, "user-456")
      assert.equal(res.success, true)
      assert.ok(
        capturedUrl.includes(
          "/Shows/show-123/Episodes?userId=user-456&Fields=UserData,RunTimeTicks"
        )
      )
      assert.equal(res.episodes.length, 2)
      assert.equal(res.episodes[0].status, "completed")
      assert.equal(res.episodes[0].progressPercent, 100)

      assert.equal(res.episodes[1].status, "unplayed")
      assert.equal(res.episodes[1].progressPercent, 0)
      assert.equal(res.episodes[1].lastPlayedDate, undefined)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("refreshAuditAction invalidates audit cache and returns success", async () => {
    let fetchCount = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.includes("/api/v1/user")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ results: [] }),
        } as Response
      }
      if (urlStr.includes("/api/v1/request")) {
        fetchCount++
        return {
          ok: true,
          status: 200,
          json: async () => ({ results: [] }),
        } as Response
      }
      if (urlStr.includes("/Users")) {
        return { ok: true, status: 200, json: async () => [] } as Response
      }
      if (urlStr.includes("/Items")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ Items: [] }),
        } as Response
      }
      return { ok: false, status: 404 } as Response
    }) as typeof globalThis.fetch

    try {
      process.env.SEERR_URL = "http://seerr.test"
      process.env.SEERR_API_KEY = "test-key"
      process.env.JELLYFIN_URL = "http://jellyfin.test"
      process.env.JELLYFIN_API_KEY = "test-key"

      await auditMedia()
      assert.equal(fetchCount, 1)

      await auditMedia()
      assert.equal(fetchCount, 1) // Cached

      const res = await refreshAuditAction()
      assert.equal(res.success, true)

      await auditMedia()
      assert.equal(fetchCount, 2) // Re-fetched because cache was invalidated
    } finally {
      invalidateAuditCache()
      globalThis.fetch = originalFetch
    }
  })
})
