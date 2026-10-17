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

// Persistent process-level cache for TMDB details (survives requests while server runs)
const titleDetailsCache = new Map<
  string,
  {
    title: string
    year?: number
    posterPath?: string
    overview?: string
    genres?: string[]
  }
>()

function calculateDaysAgo(dateStr?: string): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function mapUserWatchStatus(
  item?: JellyfinItem,
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

  const userData = item?.UserData
  if (!userData) {
    return { status: "unplayed", progressPercent: 0 }
  }

  if (userData.Played) {
    return { status: "completed", progressPercent: 100 }
  }

  const runTime = item?.RunTimeTicks || 0
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

  // 1. Concurrent bulk fetch from Seerr & Jellyfin
  const [requests, jellyfinUsers, allLibraryItems] = await Promise.all([
    seerr.getRequests(200, "all"),
    jellyfin.getUsers(),
    jellyfin.getAllLibraryItems().catch(() => [] as JellyfinItem[]),
  ])

  // 2. Index Jellyfin library items by exact TMDB ID string
  const jfByTmdb = new Map<string, JellyfinItem>()
  for (const item of allLibraryItems) {
    if (item.ProviderIds?.Tmdb) {
      jfByTmdb.set(String(item.ProviderIds.Tmdb), item)
    }
  }

  // 3. Bulk fetch UserData for all Jellyfin users in parallel (1 call per user, not per item)
  const userItemsMap = new Map<string, Map<string, JellyfinItem>>()
  await Promise.all(
    jellyfinUsers.map(async (u) => {
      try {
        const items = await jellyfin.getAllUserItems(u.Id)
        const map = new Map<string, JellyfinItem>()
        for (const item of items) {
          map.set(item.Id, item)
        }
        userItemsMap.set(u.Id, map)
      } catch {
        userItemsMap.set(u.Id, new Map())
      }
    })
  )

  // 4. Resolve media metadata: check cache, then fetch missing in batches of 25 (for items in Jellyfin)
  const missingRequests = requests.filter((r) => {
    if (!r.media?.tmdbId) return false
    const tmdbIdStr = String(r.media.tmdbId)
    if (!jfByTmdb.has(tmdbIdStr)) return false
    const key = `${r.media.mediaType || "movie"}-${r.media.tmdbId}`
    return !titleDetailsCache.has(key)
  })

  const CHUNK_SIZE = 25
  for (let i = 0; i < missingRequests.length; i += CHUNK_SIZE) {
    const batch = missingRequests.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        const tmdbId = r.media.tmdbId
        const mediaType = r.media.mediaType || "movie"
        const key = `${mediaType}-${tmdbId}`
        try {
          const details = await seerr.getMediaDetails(mediaType, tmdbId)
          const title = details.title || (details as any).name || `TMDB ${tmdbId}`
          const yearStr = details.releaseDate || (details as any).firstAirDate
          const year = yearStr ? new Date(yearStr).getFullYear() : undefined
          const genres = details.genres?.map((g) => g.name).filter(Boolean)
          titleDetailsCache.set(key, {
            title,
            year: isNaN(year!) ? undefined : year,
            posterPath: details.posterPath,
            overview: details.overview,
            genres,
          })
        } catch {
          titleDetailsCache.set(key, { title: `TMDB ${tmdbId}` })
        }
      })
    )
  }

  // Map username & ID -> Jellyfin user
  const userMap = new Map<string, JellyfinUser>()
  for (const u of jellyfinUsers) {
    userMap.set(u.Name.toLowerCase(), u)
    userMap.set(u.Id.toLowerCase(), u)
  }

  const auditItems: AuditMediaItem[] = []
  const seenTvTmdbIds = new Set<number>()

  for (const req of requests) {
    const media = req.media
    if (!media || !media.tmdbId) continue

    const tmdbId = media.tmdbId
    const mediaType = media.mediaType || "movie"

    // Deduplicate TV series requests to a single parent row
    if (mediaType === "tv") {
      if (seenTvTmdbIds.has(tmdbId)) continue
      seenTvTmdbIds.add(tmdbId)
    }

    const requestedAt = req.createdAt

    // Find Jellyfin library item matching this TMDB ID
    const jellyfinItem = jfByTmdb.get(String(tmdbId))

    // Skip tracked/unacquired media that does not exist in Jellyfin
    if (!jellyfinItem) continue

    // Resolve metadata: title, year, overview, genres, posterPath
    const cached = titleDetailsCache.get(`${mediaType}-${tmdbId}`)
    const title = jellyfinItem.Name || cached?.title || `TMDB ${tmdbId}`
    const year = jellyfinItem.ProductionYear || cached?.year
    const posterPath = cached?.posterPath
    const overview = jellyfinItem.Overview || cached?.overview
    const genres = (jellyfinItem.Genres && jellyfinItem.Genres.length > 0)
      ? jellyfinItem.Genres
      : cached?.genres
    const jellyfinImageTag = jellyfinItem.ImageTags?.Primary

    // Quality determination (e.g. "4K", "1080p", "720p", "Web-DL")
    let quality: string | undefined
    const videoStream = jellyfinItem.MediaSources?.[0]?.MediaStreams?.find(
      (s) => s.Type === "Video"
    )
    if (videoStream?.DisplayTitle) {
      quality = videoStream.DisplayTitle
    } else if (req.is4k) {
      quality = "4K"
    }

    // Match requester profile
    const reqBy = req.requestedBy
    const requesterUsername = (reqBy as any)?.displayName || reqBy?.username || "Unknown"
    const matchedJellyfinUser =
      (reqBy as any)?.jellyfinUserId && userMap.get((reqBy as any).jellyfinUserId.toLowerCase())
        ? userMap.get((reqBy as any).jellyfinUserId.toLowerCase())
        : (reqBy as any)?.jellyfinUsername && userMap.get((reqBy as any).jellyfinUsername.toLowerCase())
        ? userMap.get((reqBy as any).jellyfinUsername.toLowerCase())
        : userMap.get(requesterUsername.toLowerCase())

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
        const userItems = userItemsMap.get(jUser.Id)
        const userItem = userItems?.get(jellyfinItem.Id) || jellyfinItem

        const { status, progressPercent, episodesWatched, totalEpisodes } =
          mapUserWatchStatus(userItem)

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

    const activeNonRequesters = householdStates.filter(
      (h) =>
        h.status === "in_progress" ||
        (h.lastPlayedDate && (calculateDaysAgo(h.lastPlayedDate) ?? 999) <= conflictThreshold)
    )

    if (activeNonRequesters.length > 0) {
      conflictStatus = "conflict"
      conflictReason = `Active viewer(s) in household: ${activeNonRequesters.map((u) => u.username).join(", ")}`
    } else if (requesterState.status === "unplayed" && daysSinceAdded >= ghostThreshold) {
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

    const requesterAvatarUrl = matchedJellyfinUser?.Id
      ? `/api/proxy/avatar?userId=${matchedJellyfinUser.Id}`
      : req.requestedBy?.avatar
      ? `/api/proxy/avatar?avatar=${encodeURIComponent(req.requestedBy.avatar)}`
      : undefined

    auditItems.push({
      id: itemIdentifier,
      requestId: req.id,
      tmdbId,
      jellyfinItemId: jellyfinItem?.Id,
      title,
      year,
      mediaType,
      posterPath,
      overview,
      genres,
      quality,
      jellyfinImageTag,
      sizeBytes: jellyfinItem?.Size,
      requestedAt,
      requester: {
        id: req.requestedBy?.id || 0,
        username: requesterUsername,
        avatar: req.requestedBy?.avatar,
        requesterAvatarUrl,
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
