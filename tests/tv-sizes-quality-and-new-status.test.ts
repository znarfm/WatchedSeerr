import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { JellyfinClient } from "../lib/clients/jellyfin"

describe("TV Sizes, Quality Normalization & New Status Seam", () => {
  it("JellyfinClient.getAllEpisodesMetadata queries /Items with episode parameters", async () => {
    let capturedUrl = ""
    let capturedHeaders: Record<string, string> = {}

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString()
      capturedHeaders = (init?.headers as Record<string, string>) || {}
      return {
        ok: true,
        status: 200,
        json: async () => ({
          Items: [
            {
              Id: "ep-1",
              SeriesId: "series-1",
              Type: "Episode",
              Size: 1048576,
              MediaSources: [{ Size: 1048576, MediaStreams: [{ Type: "Video", Width: 1920, Height: 1080 }] }],
            },
          ],
        }),
      } as Response
    }) as typeof globalThis.fetch

    try {
      const client = new JellyfinClient("http://jellyfin.test", "secret-token")
      const episodes = await client.getAllEpisodesMetadata()

      assert.ok(
        capturedUrl.includes(
          "/Items?Recursive=true&IncludeItemTypes=Episode&Fields=MediaSources,MediaStreams,Size&EnableUserData=false&EnableImages=false&EnableTotalRecordCount=false&Limit=10000"
        ),
        `Unexpected URL: ${capturedUrl}`
      )
      assert.equal(capturedHeaders.Authorization, 'MediaBrowser Token="secret-token"')
      assert.equal(episodes.length, 1)
      assert.equal(episodes[0].Id, "ep-1")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("buildMediaExternalLinks builds complete URLs for movies and tv", async () => {
    // Dynamic import to test export
    const { buildMediaExternalLinks } = await import("../lib/audit") as any

    const movieLinks = buildMediaExternalLinks({
      mediaType: "movie",
      tmdbId: 27205,
      imdbId: "tt1375666",
      jellyfinItemId: "jf-movie-1",
      jellyfinServerId: "srv-jf-1",
      externalServiceSlug: "inception-2010",
      jellyfinBaseUrl: "https://jf.example.com/",
      seerrBaseUrl: "https://seerr.example.com///",
      radarrBaseUrl: "https://radarr.example.com",
      sonarrBaseUrl: "https://sonarr.example.com",
    })

    assert.equal(movieLinks.imdb, "https://www.imdb.com/title/tt1375666/")
    assert.equal(movieLinks.letterboxd, "https://letterboxd.com/tmdb/27205/")
    assert.equal(movieLinks.arr, "https://radarr.example.com/movie/inception-2010")
    assert.equal(
      movieLinks.jellyfin,
      "https://jf.example.com/web/index.html#!/details?id=jf-movie-1&serverId=srv-jf-1"
    )
    assert.equal(movieLinks.seerr, "https://seerr.example.com/movie/27205")

    const tvLinks = buildMediaExternalLinks({
      mediaType: "tv",
      tmdbId: 1396,
      jellyfinItemId: "jf-tv-1",
      externalServiceSlug: "breaking-bad",
      jellyfinBaseUrl: "https://jf.example.com",
      seerrBaseUrl: "https://seerr.example.com",
      radarrBaseUrl: "https://radarr.example.com",
      sonarrBaseUrl: "https://sonarr.example.com",
    })

    assert.equal(tvLinks.imdb, undefined)
    assert.equal(tvLinks.letterboxd, undefined) // no letterboxd for TV
    assert.equal(tvLinks.arr, "https://sonarr.example.com/series/breaking-bad")
    assert.equal(
      tvLinks.jellyfin,
      "https://jf.example.com/web/index.html#!/details?id=jf-tv-1"
    )
    assert.equal(tvLinks.seerr, "https://seerr.example.com/tv/1396")

    // serviceUrl takes precedence for arr link
    const customArrLinks = buildMediaExternalLinks({
      mediaType: "movie",
      tmdbId: 100,
      serviceUrl: "https://custom-radarr.internal/movie/custom",
      radarrBaseUrl: "https://radarr.example.com",
    })
    assert.equal(customArrLinks.arr, "https://custom-radarr.internal/movie/custom")
  })

  it("normalizeVideoQuality normalizes structured streams and messy MKV track titles", async () => {
    const { normalizeVideoQuality } = await import("../lib/audit") as any

    // 1. Structured 1080p HEVC
    const q1 = normalizeVideoQuality({ Width: 1920, Height: 1080, Codec: "hevc" })
    assert.equal(q1.quality, "1080p")
    assert.equal(q1.qualityFull, "1080p HEVC")

    // 2. Structured 4K H.264
    const q2 = normalizeVideoQuality({ Width: 3840, Height: 2160, Codec: "h264" })
    assert.equal(q2.quality, "4K")
    assert.equal(q2.qualityFull, "4K H.264")

    // 3. Structured 720p with no codec
    const q3 = normalizeVideoQuality({ Width: 1280, Height: 720 })
    assert.equal(q3.quality, "720p")
    assert.equal(q3.qualityFull, "720p")

    // 4. Messy MKV title with embedded release group and codec string
    const q4 = normalizeVideoQuality({
      DisplayTitle: "GalaxyRG265 - Inception.2010.1080p.BluRay.DDP5.1.x265.10bit-GalaxyRG265 - HEVC - SDR",
    })
    assert.equal(q4.quality, "1080p")
    assert.equal(q4.qualityFull, "1080p HEVC")

    // 5. AV1 and 720p regex fallback
    const q5 = normalizeVideoQuality({
      DisplayTitle: "Show - 720p AV1",
    })
    assert.equal(q5.quality, "720p")
    assert.equal(q5.qualityFull, "720p AV1")

    // 6. 480p SD fallback
    const q6 = normalizeVideoQuality({
      Width: 640,
      Height: 480,
    })
    assert.equal(q6.quality, "480p")
    assert.equal(q6.qualityFull, "480p")

    // 7. is4k fallback
    const q7 = normalizeVideoQuality(undefined, true)
    assert.equal(q7.quality, "4K")
    assert.equal(q7.qualityFull, "4K")

    // 8. undefined/empty
    const q8 = normalizeVideoQuality()
    assert.equal(q8.quality, undefined)
    assert.equal(q8.qualityFull, undefined)
  })

  it("auditMedia aggregates TV episode sizes, normalizes quality, and attaches externalLinks", async () => {
    const { auditMedia } = await import("../lib/audit")

    const mockRequests = [
      {
        id: 1,
        status: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        requestedBy: { id: 10, username: "alice" },
        is4k: false,
        media: {
          id: 101,
          tmdbId: 1396,
          imdbId: "tt0903747",
          status: 5,
          mediaType: "tv" as const,
          externalServiceSlug: "breaking-bad",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    ]

    const mockJellyfinUsers = [{ Id: "u-alice", Name: "alice" }]

    // Series item in Jellyfin does NOT have Size or MediaSources
    const mockLibraryItems = [
      {
        Id: "jf-series-1396",
        Name: "Breaking Bad",
        Type: "Series" as const,
        ProviderIds: { Tmdb: "1396", Imdb: "tt0903747" },
        ServerId: "jf-srv-1",
      },
    ]

    // Child episodes have sizes and media streams
    const mockEpisodes = [
      {
        Id: "ep-101",
        SeriesId: "jf-series-1396",
        Type: "Episode" as const,
        Size: 1_500_000_000,
        MediaSources: [
          {
            Size: 1_500_000_000,
            MediaStreams: [
              {
                Type: "Video",
                Width: 1920,
                Height: 1080,
                Codec: "hevc",
                DisplayTitle: "1080p HEVC",
              },
            ],
          },
        ],
      },
      {
        Id: "ep-102",
        SeriesId: "jf-series-1396",
        Type: "Episode" as const,
        Size: 2_000_000_000,
        MediaSources: [
          {
            Size: 2_000_000_000,
            MediaStreams: [
              {
                Type: "Video",
                Width: 1920,
                Height: 1080,
                Codec: "hevc",
              },
            ],
          },
        ],
      },
    ]

    const mockSeerrClient = {
      getRequests: async () => mockRequests,
      getMediaDetails: async () => ({ id: 1396, title: "Breaking Bad" }),
    } as any

    const mockJellyfinClient = {
      getUsers: async () => mockJellyfinUsers,
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async () => [],
      getAllEpisodesMetadata: async () => mockEpisodes,
    } as any

    const report = await auditMedia({
      seerrClient: mockSeerrClient,
      jellyfinClient: mockJellyfinClient,
    })

    assert.equal(report.items.length, 1)
    const item = report.items[0]

    // Aggregated size from episodes (1.5GB + 2.0GB = 3.5GB)
    assert.equal(item.sizeBytes, 3_500_000_000)
    assert.equal(item.quality, "1080p")
    assert.equal(item.qualityFull, "1080p HEVC")
    assert.equal(item.imdbId, "tt0903747")
    assert.ok(item.externalLinks)
    assert.equal(item.externalLinks.imdb, "https://www.imdb.com/title/tt0903747/")
    assert.equal(item.externalLinks.letterboxd, undefined)
  })

  it("auditMedia classifies recent unplayed request as 'new' and computes newCount", async () => {
    const { auditMedia } = await import("../lib/audit")

    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago (< 30)
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() // 40 days ago (>= 30)

    const mockRequests = [
      {
        id: 10,
        status: 2,
        createdAt: recentDate,
        updatedAt: recentDate,
        requestedBy: { id: 1, username: "alice" },
        is4k: false,
        media: {
          id: 110,
          tmdbId: 1001,
          status: 5,
          mediaType: "movie" as const,
          createdAt: recentDate,
          updatedAt: recentDate,
        },
      },
      {
        id: 11,
        status: 2,
        createdAt: oldDate,
        updatedAt: oldDate,
        requestedBy: { id: 2, username: "bob" },
        is4k: false,
        media: {
          id: 111,
          tmdbId: 1002,
          status: 5,
          mediaType: "movie" as const,
          createdAt: oldDate,
          updatedAt: oldDate,
        },
      },
    ]

    const mockJellyfinUsers = [
      { Id: "u-alice", Name: "alice" },
      { Id: "u-bob", Name: "bob" },
    ]

    const mockLibraryItems = [
      {
        Id: "jf-1001",
        Name: "Fresh Movie",
        Type: "Movie" as const,
        ProviderIds: { Tmdb: "1001" },
      },
      {
        Id: "jf-1002",
        Name: "Old Unwatched Movie",
        Type: "Movie" as const,
        ProviderIds: { Tmdb: "1002" },
      },
    ]

    const mockSeerrClient = {
      getRequests: async () => mockRequests,
      getMediaDetails: async (_type: string, id: number) => ({ id, title: `Movie ${id}` }),
    } as any

    const mockJellyfinClient = {
      getUsers: async () => mockJellyfinUsers,
      getAllLibraryItems: async () => mockLibraryItems,
      getAllUserItems: async () => [],
      getAllEpisodesMetadata: async () => [],
    } as any

    const report = await auditMedia({
      seerrClient: mockSeerrClient,
      jellyfinClient: mockJellyfinClient,
      ghostThresholdDays: 30,
    })

    assert.equal(report.items.length, 2)
    const freshItem = report.items.find((i) => i.tmdbId === 1001)!
    const oldItem = report.items.find((i) => i.tmdbId === 1002)!

    assert.equal(freshItem.conflictStatus, "new")
    assert.ok(freshItem.conflictReason.includes("Recently requested"))
    assert.ok(freshItem.conflictReason.includes("awaiting first watch"))

    assert.equal(oldItem.conflictStatus, "ghost")
    assert.ok(oldItem.conflictReason.includes("never watched item"))

    assert.equal(report.newCount, 1)
    assert.equal(report.ghostCount, 1)
  })
})



