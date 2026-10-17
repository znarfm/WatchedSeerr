import { auditMedia } from "../lib/audit"
import type { SeerrClient } from "../lib/clients/seerr"
import type { JellyfinClient } from "../lib/clients/jellyfin"

async function runTestAudit() {
  console.log("=== WatchedSeerr CLI Audit Test ===")

  const mockSeerr: Partial<SeerrClient> = {
    getRequests: async () => ({
      pageInfo: { page: 1, pages: 1, pageSize: 3, results: 3 },
      results: [
        {
          id: 101,
          status: 2,
          media: {
            id: 501,
            tmdbId: 157336, // Interstellar
            status: 5,
            mediaType: "movie",
            createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
            updatedAt: new Date().toISOString(),
          },
          createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          requestedBy: {
            id: 1,
            username: "alice",
          },
          is4k: false,
        },
        {
          id: 102,
          status: 2,
          media: {
            id: 502,
            tmdbId: 94605, // Arcane
            status: 5,
            mediaType: "tv",
            createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
            updatedAt: new Date().toISOString(),
          },
          createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          requestedBy: {
            id: 2,
            username: "bob",
          },
          is4k: false,
        },
        {
          id: 103,
          status: 2,
          media: {
            id: 503,
            tmdbId: 603, // The Matrix
            status: 5,
            mediaType: "movie",
            createdAt: new Date(Date.now() - 100 * 86400000).toISOString(),
            updatedAt: new Date().toISOString(),
          },
          createdAt: new Date(Date.now() - 100 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          requestedBy: {
            id: 3,
            username: "charlie",
          },
          is4k: false,
        },
      ],
    }),
    getMediaDetails: async (mediaType: "movie" | "tv", tmdbId: number) => {
      const titles: Record<number, string> = {
        157336: "Interstellar",
        94605: "Arcane",
        603: "The Matrix",
      }
      return {
        id: tmdbId,
        title: titles[tmdbId] || `TMDB ${tmdbId}`,
      }
    },
  }

  const mockJellyfin: Partial<JellyfinClient> = {
    getUsers: async () => [
      { Id: "u-1", Name: "alice" },
      { Id: "u-2", Name: "bob" },
      { Id: "u-3", Name: "charlie" },
    ],
    getAllLibraryItems: async () => [
      {
        Id: "jf-item-1",
        Name: "Interstellar",
        ProductionYear: 2014,
        Type: "Movie",
        RunTimeTicks: 10000000,
        ProviderIds: { Tmdb: "157336" },
      },
      {
        Id: "jf-item-2",
        Name: "Arcane",
        ProductionYear: 2021,
        Type: "Series",
        ProviderIds: { Tmdb: "94605" },
      },
      {
        Id: "jf-item-3",
        Name: "The Matrix",
        ProductionYear: 1999,
        Type: "Movie",
        RunTimeTicks: 10000000,
        ProviderIds: { Tmdb: "603" },
      },
    ],
    getAllUserItems: async (userId: string) => {
      if (userId === "u-1") {
        return [
          {
            Id: "jf-item-1",
            Name: "Interstellar",
            Type: "Movie",
            UserData: {
              PlaybackPositionTicks: 10000000,
              PlayCount: 1,
              IsFavorite: false,
              Played: true,
              LastPlayedDate: new Date(
                Date.now() - 35 * 86400000
              ).toISOString(),
            },
          },
          {
            Id: "jf-item-2",
            Name: "Arcane",
            Type: "Series",
            UserData: {
              PlaybackPositionTicks: 5000000,
              PlayCount: 0,
              IsFavorite: false,
              Played: false,
              LastPlayedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
            },
          },
        ]
      }
      if (userId === "u-2") {
        return [
          {
            Id: "jf-item-2",
            Name: "Arcane",
            Type: "Series",
            UserData: {
              PlaybackPositionTicks: 3000000,
              PlayCount: 0,
              IsFavorite: false,
              Played: false,
              LastPlayedDate: new Date(
                Date.now() - 10 * 86400000
              ).toISOString(),
            },
          },
        ]
      }
      return []
    },
  }

  const report = await auditMedia({
    seerrClient: mockSeerr as SeerrClient,
    jellyfinClient: mockJellyfin as JellyfinClient,
    ghostThresholdDays: 30,
    conflictThresholdDays: 60,
  })

  console.log(`Generated: ${report.generatedAt}`)
  console.log(
    `Summary: Total=${report.totalItems}, Safe=${report.safeCount}, Conflicts=${report.conflictCount}, Ghost=${report.ghostCount}\n`
  )

  for (const item of report.items) {
    console.log(
      `[${item.conflictStatus.toUpperCase()}] ${item.title} (${item.year || "N/A"}) - ${item.mediaType}`
    )
    console.log(
      `  Requester: ${item.requester.username} (Status: ${item.requesterState.status}, Progress: ${item.requesterState.progressPercent}%)`
    )
    console.log(`  Conflict reason: ${item.conflictReason}`)
    console.log(
      `  Household: ${item.householdStates.map((h) => `${h.username}: ${h.status}`).join(", ") || "None"}`
    )
    console.log("--------------------------------------------------")
  }
}

runTestAudit().catch(console.error)
