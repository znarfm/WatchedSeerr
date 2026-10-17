import { JellyfinClient } from "./clients/jellyfin"
import { SeerrClient } from "./clients/seerr"
import { isItemWhitelisted } from "./whitelist"
import type {
  AuditMediaItem,
  AuditReport,
  ConflictStatus,
  JellyfinItem,
  JellyfinUser,
  UserPlaybackState,
  WatchStatus,
} from "@/types"

interface AuditOptions {
  ghostThresholdDays?: number
  conflictThresholdDays?: number
  seerrClient?: SeerrClient
  jellyfinClient?: JellyfinClient
}

function calculateDaysAgo(dateStr?: string): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function mapUserWatchStatus(
  item: JellyfinItem,
  episodes?: JellyfinItem[]
): { status: WatchStatus; progressPercent: number; episodesWatched?: number; totalEpisodes?: number } {
  if (episodes && episodes.length > 0) {
    const totalEpisodes = episodes.length
    const watchedEpisodes = episodes.filter((ep) => ep.UserData?.Played).length
    const progressPercent = Math.round((watchedEpisodes / totalEpisodes) * 100)

    let status: WatchStatus = "unplayed"
    if (watchedEpisodes === totalEpisodes && totalEpisodes > 0) {
      status = "completed"
    } else if (watchedEpisodes > 0 || episodes.some((ep) => (ep.UserData?.PlaybackPositionTicks || 0) > 0)) {
      status = "in_progress"
    }

    return { status, progressPercent, episodesWatched: watchedEpisodes, totalEpisodes }
  }

  const userData = item.UserData
  if (!userData) {
    return { status: "unplayed", progressPercent: 0 }
  }

  if (userData.Played) {
    return { status: "completed", progressPercent: 100 }
  }

  const runTime = item.RunTimeTicks || 0
  const position = userData.PlaybackPositionTicks || 0
  if (runTime > 0 && position > 0) {
    const pct = Math.min(99, Math.round((position / runTime) * 100))
    return { status: pct > 90 ? "completed" : "in_progress", progressPercent: pct }
  }

  return { status: "unplayed", progressPercent: 0 }
}

export async function auditMedia(options: AuditOptions = {}): Promise<AuditReport> {
  const ghostThreshold =
    options.ghostThresholdDays ??
    Number(process.env.GHOST_THRESHOLD_DAYS || 30)
  const conflictThreshold =
    options.conflictThresholdDays ??
    Number(process.env.CONFLICT_THRESHOLD_DAYS || 60)

  const seerr = options.seerrClient || new SeerrClient()
  const jellyfin = options.jellyfinClient || new JellyfinClient()

  // 1. Fetch Seerr requests & Jellyfin users concurrently
  const [requests, jellyfinUsers] = await Promise.all([
    seerr.getRequests(200, "all"),
    jellyfin.getUsers(),
  ])

  // Map username -> Jellyfin user ID (case-insensitive)
  const userMap = new Map<string, JellyfinUser>()
  for (const u of jellyfinUsers) {
    userMap.set(u.Name.toLowerCase(), u)
  }

  const auditItems: AuditMediaItem[] = []

  for (const req of requests) {
    const media = req.media
    if (!media || !media.tmdbId) continue

    const tmdbId = media.tmdbId
    const mediaType = media.mediaType || "movie"
    const requestedAt = req.createdAt

    // Find Jellyfin item by TMDB ID
    let jellyfinItem: JellyfinItem | undefined
    try {
      const items = await jellyfin.findItemsByTmdbId(tmdbId, mediaType)
      jellyfinItem = items[0]
    } catch {
      // In case library item isn't ready or search fails
    }

    const requesterUsername = req.requestedBy?.username || "Unknown"
    const matchedJellyfinUser = userMap.get(requesterUsername.toLowerCase())

    const householdStates: UserPlaybackState[] = []
    let requesterState: UserPlaybackState = {
      userId: matchedJellyfinUser?.Id || "unknown",
      username: requesterUsername,
      isRequester: true,
      status: "unplayed",
      progressPercent: 0,
      playCount: 0,
    }

    let mostRecentPlayedDate: string | undefined

    if (jellyfinItem) {
      for (const jUser of jellyfinUsers) {
        const isRequester = matchedJellyfinUser?.Id === jUser.Id

        let episodes: JellyfinItem[] | undefined
        let userItem = jellyfinItem
        try {
          userItem = await jellyfin.getUserItemData(jUser.Id, jellyfinItem.Id)
          if (mediaType === "tv") {
            episodes = await jellyfin.getEpisodes(jellyfinItem.Id, jUser.Id)
          }
        } catch {
          // Fall back to general state if user item fetch fails
        }

        const { status, progressPercent, episodesWatched, totalEpisodes } =
          mapUserWatchStatus(userItem, episodes)

        const lastPlayed = userItem.UserData?.LastPlayedDate
        if (lastPlayed) {
          if (!mostRecentPlayedDate || new Date(lastPlayed) > new Date(mostRecentPlayedDate)) {
            mostRecentPlayedDate = lastPlayed
          }
        }

        const state: UserPlaybackState = {
          userId: jUser.Id,
          username: jUser.Name,
          isRequester,
          status,
          progressPercent,
          lastPlayedDate: lastPlayed,
          playCount: userItem.UserData?.PlayCount || 0,
          episodesWatched,
          totalEpisodes,
        }

        if (isRequester) {
          requesterState = state
        } else {
          householdStates.push(state)
        }
      }
    }

    const daysSincePlayed = calculateDaysAgo(mostRecentPlayedDate)
    const daysSinceAdded = calculateDaysAgo(requestedAt) ?? 0

    // Conflict Resolution Logic
    let conflictStatus: ConflictStatus = "safe"
    let conflictReason = "No active household viewing detected"

    // 1. Check non-requester conflicts (active in-progress or played recently)
    const activeNonRequesters = householdStates.filter(
      (h) =>
        h.status === "in_progress" ||
        (h.lastPlayedDate && (calculateDaysAgo(h.lastPlayedDate) ?? 999) <= conflictThreshold)
    )

    if (activeNonRequesters.length > 0) {
      conflictStatus = "conflict"
      conflictReason = `Active viewer(s) in household: ${activeNonRequesters.map((u) => u.username).join(", ")}`
    } else if (requesterState.status === "unplayed" && daysSinceAdded >= ghostThreshold) {
      // 2. Ghost request: requester never played and item added >= threshold days ago
      conflictStatus = "ghost"
      conflictReason = `Requester has never watched item (${daysSinceAdded} days since requested)`
    } else if (requesterState.status === "in_progress") {
      const requesterDays = calculateDaysAgo(requesterState.lastPlayedDate)
      if (requesterDays !== null && requesterDays <= conflictThreshold) {
        conflictStatus = "conflict"
        conflictReason = `Requester is currently watching (${requesterState.progressPercent}%, ${requesterDays} days ago)`
      } else {
        conflictStatus = "safe"
        conflictReason = "Requester stalled/abandoned playback"
      }
    }

    const itemIdentifier = `req-${req.id}-tmdb-${tmdbId}`
    const whitelisted = isItemWhitelisted(itemIdentifier)

    let title = jellyfinItem?.Name || `TMDB ${tmdbId}`
    let year = jellyfinItem?.ProductionYear

    auditItems.push({
      id: itemIdentifier,
      requestId: req.id,
      tmdbId,
      jellyfinItemId: jellyfinItem?.Id,
      title,
      year,
      mediaType,
      sizeBytes: jellyfinItem?.Size,
      requestedAt,
      requester: {
        id: req.requestedBy?.id || 0,
        username: requesterUsername,
        avatar: req.requestedBy?.avatar,
        matchedJellyfinUserId: matchedJellyfinUser?.Id,
      },
      requesterState,
      householdStates,
      daysSinceLastPlayed: daysSincePlayed,
      conflictStatus,
      conflictReason,
      isWhitelisted: whitelisted,
    })
  }

  const safeCount = auditItems.filter((i) => i.conflictStatus === "safe").length
  const conflictCount = auditItems.filter((i) => i.conflictStatus === "conflict").length
  const ghostCount = auditItems.filter((i) => i.conflictStatus === "ghost").length
  const whitelistedCount = auditItems.filter((i) => i.isWhitelisted).length

  return {
    generatedAt: new Date().toISOString(),
    totalItems: auditItems.length,
    safeCount,
    conflictCount,
    ghostCount,
    whitelistedCount,
    items: auditItems,
  }
}
