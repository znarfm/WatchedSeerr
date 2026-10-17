import { auditMedia } from "../lib/audit"
import type { SeerrClient } from "../lib/clients/seerr"
import type { JellyfinClient } from "../lib/clients/jellyfin"

async function runTestAudit() {
  console.log("=== WatchedSeerr CLI Audit Test ===")

  // Mock clients for testing without live external servers
  const mockSeerr: Partial<SeerrClient> = {
    getRequests: async () => [
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
  }

  const mockJellyfin: Partial<JellyfinClient> = {
    getUsers: async () => [
      { Id: "u-1", Name: "alice" },
      { Id: "u-2", Name: "bob" },
      { Id: "u-3", Name: "charlie" },
    ],
    findItemsByTmdbId: async (tmdbId) => {
      if (tmdbId === 157336) {
        return [
          {
            Id: "jf-item-1",
            Name: "Interstellar",
            ProductionYear: 2014,
            Type: "Movie",
            RunTimeTicks: 10000000,
            UserData: {
              PlaybackPositionTicks: 10000000,
              PlayCount: 1,
              IsFavorite: false,
              Played: true,
              LastPlayedDate: new Date(Date.now() - 35 * 86400000).toISOString(),
            },
          },
        ]
      }
      if (tmdbId === 94605) {
        return [
          {
            Id: "jf-item-2",
            Name: "Arcane",
            ProductionYear: 2021,
            Type: "Series",
          },
        ]
      }
      if (tmdbId === 603) {
        return [
          {
            Id: "jf-item-3",
            Name: "The Matrix",
            ProductionYear: 1999,
            Type: "Movie",
            RunTimeTicks: 10000000,
            UserData: {
              PlaybackPositionTicks: 0,
              PlayCount: 0,
              IsFavorite: false,
              Played: false,
            },
          },
        ]
      }
      return []
    },
    getUserItemData: async (userId, itemId) => {
      // Bob requested Arcane and watched 2 episodes. But Alice is watching Arcane right now!
      if (itemId === "jf-item-2") {
        return {
          Id: itemId,
          Name: "Arcane",
          Type: "Series",
          UserData: {
            PlaybackPositionTicks: 0,
            PlayCount: 0,
            IsFavorite: false,
            Played: false,
            LastPlayedDate:
              userId === "u-1"
                ? new Date(Date.now() - 2 * 86400000).toISOString()
                : undefined,
          },
        }
      }
      if (itemId === "jf-item-1") {
        return {
          Id: itemId,
          Name: "Interstellar",
          Type: "Movie",
          UserData: {
            PlaybackPositionTicks: userId === "u-1" ? 10000000 : 0,
            PlayCount: userId === "u-1" ? 1 : 0,
            IsFavorite: false,
            Played: userId === "u-1",
            LastPlayedDate:
              userId === "u-1"
                ? new Date(Date.now() - 35 * 86400000).toISOString()
                : undefined,
          },
        }
      }
      return {
        Id: itemId,
        Name: "The Matrix",
        Type: "Movie",
        UserData: {
          PlaybackPositionTicks: 0,
          PlayCount: 0,
          IsFavorite: false,
          Played: false,
        },
      }
    },
    getEpisodes: async (seriesId, userId) => {
      if (seriesId === "jf-item-2") {
        return [
          {
            Id: "ep-1",
            Name: "Episode 1",
            Type: "Episode",
            UserData: {
              PlaybackPositionTicks: 1000,
              PlayCount: 1,
              IsFavorite: false,
              Played: true,
              LastPlayedDate:
                userId === "u-1"
                  ? new Date(Date.now() - 2 * 86400000).toISOString()
                  : undefined,
            },
          },
          {
            Id: "ep-2",
            Name: "Episode 2",
            Type: "Episode",
            UserData: {
              PlaybackPositionTicks: 500,
              PlayCount: 0,
              IsFavorite: false,
              Played: false,
              LastPlayedDate:
                userId === "u-1"
                  ? new Date(Date.now() - 1 * 86400000).toISOString()
                  : undefined,
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
  console.log(`Summary: Total=${report.totalItems}, Safe=${report.safeCount}, Conflicts=${report.conflictCount}, Ghost=${report.ghostCount}\n`)

  for (const item of report.items) {
    console.log(`[${item.conflictStatus.toUpperCase()}] ${item.title} (${item.year || "N/A"}) - ${item.mediaType}`)
    console.log(`  Requester: ${item.requester.username} (Status: ${item.requesterState.status}, Progress: ${item.requesterState.progressPercent}%)`)
    console.log(`  Conflict reason: ${item.conflictReason}`)
    console.log(`  Household: ${item.householdStates.map(h => `${h.username}: ${h.status}`).join(", ") || "None"}`)
    console.log("--------------------------------------------------")
  }
}

runTestAudit().catch(console.error)
