"use server"

import { revalidatePath } from "next/cache"
import { toggleWhitelistItem } from "@/lib/whitelist"
import {
  toggleWhitelistSchema,
  deleteActionSchema,
  getSeriesEpisodesSchema,
  type GetSeriesEpisodesInput,
} from "@/lib/validation/actions"
import { RadarrClient } from "@/lib/clients/radarr"
import { SonarrClient } from "@/lib/clients/sonarr"
import { JellyfinClient } from "@/lib/clients/jellyfin"
import { invalidateAuditCache, normalizeVideoQuality } from "@/lib/audit"
import { isDeleteDisabled } from "@/lib/utils"
import type {
  AuditEpisodeItem,
  JellyfinItem,
  UserPlaybackState,
  WatchStatus,
} from "@/types"

const EPISODE_CACHE_TTL_MS = 60_000
const MAX_EPISODE_CACHE_SIZE = 200
const episodeCache = new Map<
  string,
  { data: AuditEpisodeItem[]; expiresAt: number }
>()

function clearEpisodeCache() {
  episodeCache.clear()
}

export async function invalidateEpisodeCache() {
  clearEpisodeCache()
}

function revalidateAuditViews() {
  invalidateAuditCache()
  clearEpisodeCache()
  try {
    revalidatePath("/")
    revalidatePath("/matrix")
  } catch {
    // Outside Next.js request context (e.g. tests)
  }
}

function resolvePlaybackProgress(
  userData?: JellyfinItem["UserData"],
  runTimeTicks?: number
): { status: WatchStatus; progressPercent: number } {
  let status: WatchStatus = "unplayed"
  let progressPercent = 0
  if (userData?.Played) {
    status = "completed"
    progressPercent = 100
  } else if (userData?.PlaybackPositionTicks && runTimeTicks) {
    progressPercent = Math.min(
      99,
      Math.round((userData.PlaybackPositionTicks / runTimeTicks) * 100)
    )
    status = progressPercent > 90 ? "completed" : "in_progress"
  }
  return { status, progressPercent }
}

export async function refreshAuditAction() {
  revalidateAuditViews()
  return { success: true }
}

export async function toggleWhitelistAction(
  input: unknown
): Promise<
  { success: true; isWhitelisted: boolean } | { success: false; error: unknown }
> {
  const parsed = toggleWhitelistSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.format() }
  }

  const isWhitelisted = toggleWhitelistItem(parsed.data)
  revalidateAuditViews()
  return { success: true, isWhitelisted }
}

export async function getSeriesEpisodesAction(
  jellyfinItemIdOrInput: string | GetSeriesEpisodesInput,
  seriesTmdbId?: number,
  userId?: string,
  householdUsers?: { userId: string; username: string; avatarUrl?: string }[],
  requesterUsername?: string
) {
  try {
    const input =
      typeof jellyfinItemIdOrInput === "object" && jellyfinItemIdOrInput !== null
        ? jellyfinItemIdOrInput
        : {
            jellyfinItemId: jellyfinItemIdOrInput,
            seriesTmdbId: seriesTmdbId!,
            userId,
            householdUsers,
            requesterUsername,
          }

    const parsed = getSeriesEpisodesSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        episodes: [] as AuditEpisodeItem[],
        error: parsed.error.format(),
      }
    }

    const {
      jellyfinItemId,
      seriesTmdbId: parsedTmdbId,
      userId: parsedUserId,
      householdUsers: parsedHouseholdUsers,
      requesterUsername: parsedRequesterUsername,
    } = parsed.data

    const cacheKey = `${jellyfinItemId}:${parsedUserId || "none"}:${(parsedHouseholdUsers || [])
      .map((u) => u.userId)
      .sort()
      .join(",")}`

    const cached = episodeCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return { success: true, episodes: cached.data }
    }

    const jellyfin = new JellyfinClient()
    const sonarr = new SonarrClient()

    const [jellyfinEpisodes, sonarrSeries] = await Promise.all([
      jellyfin.getEpisodes(jellyfinItemId, parsedUserId),
      sonarr.isConfigured()
        ? sonarr.getSeriesByTmdbId(parsedTmdbId)
        : Promise.resolve(null),
    ])

    const otherUsers = Array.from(
      new Map(
        (parsedHouseholdUsers || [])
          .filter((u) => u.userId && u.userId !== parsedUserId)
          .map((u) => [u.userId, u])
      ).values()
    )
    const otherUserEpisodes = await Promise.all(
      otherUsers.map(async (u) => {
        try {
          const items = await jellyfin.getEpisodes(jellyfinItemId, u.userId)
          return { user: u, items: Array.isArray(items) ? items : [] }
        } catch {
          return { user: u, items: [] as JellyfinItem[] }
        }
      })
    )

    const userEpisodeMaps = otherUserEpisodes.map(({ user, items }) => ({
      user,
      map: new Map(items.map((i) => [i.Id, i])),
    }))

    let sonarrFiles: {
      id: number
      seasonNumber: number
      relativePath: string
    }[] = []
    if (sonarrSeries) {
      sonarrFiles = await sonarr.getEpisodeFiles(sonarrSeries.id)
    }

    const sonarrFilesBySeason = new Map<
      number,
      { id: number; seasonNumber: number; relativePath: string }[]
    >()
    for (const f of sonarrFiles) {
      let list = sonarrFilesBySeason.get(f.seasonNumber)
      if (!list) {
        list = []
        sonarrFilesBySeason.set(f.seasonNumber, list)
      }
      list.push(f)
    }

    const episodes: AuditEpisodeItem[] = jellyfinEpisodes.map((ep) => {
      const seasonNumber = ep.ParentIndexNumber ?? 1
      const episodeNumber = ep.IndexNumber ?? 0
      const userData = ep.UserData

      const { status, progressPercent } = resolvePlaybackProgress(
        userData,
        ep.RunTimeTicks
      )

      const seasonFiles = sonarrFilesBySeason.get(seasonNumber)
      let matchedSonarrFile: { id: number } | undefined
      if (seasonFiles) {
        const epPattern = new RegExp(`E0*${episodeNumber}\\b`, "i")
        matchedSonarrFile = seasonFiles.find((f) =>
          epPattern.test(f.relativePath)
        )
      }

      const requesterState: UserPlaybackState = {
        userId: parsedUserId || "",
        username: parsedRequesterUsername || "",
        isRequester: true,
        status,
        progressPercent,
        lastPlayedDate:
          status === "unplayed" ? undefined : userData?.LastPlayedDate,
        playCount: status === "completed" ? 1 : userData?.PlayCount || 0,
      }

      const householdStates: UserPlaybackState[] = userEpisodeMaps.map(
        ({ user, map }) => {
          const userEp = map.get(ep.Id)
          const uData = userEp?.UserData
          const { status: uStatus, progressPercent: uProgressPercent } =
            resolvePlaybackProgress(
              uData,
              userEp?.RunTimeTicks || ep.RunTimeTicks
            )

          return {
            userId: user.userId,
            username: user.username,
            avatarUrl: user.avatarUrl,
            isRequester: false,
            status: uStatus,
            progressPercent: uProgressPercent,
            lastPlayedDate:
              uStatus === "unplayed" ? undefined : uData?.LastPlayedDate,
            playCount: uStatus === "completed" ? 1 : uData?.PlayCount || 0,
          }
        }
      )

      return {
        id: `ep-${ep.Id}`,
        episodeId: ep.Id,
        seriesId: jellyfinItemId,
        sonarrEpisodeFileId: matchedSonarrFile?.id,
        seasonNumber,
        episodeNumber,
        name: ep.Name,
        progressPercent,
        status,
        lastPlayedDate:
          status === "unplayed" ? undefined : userData?.LastPlayedDate,
        sizeBytes: ep.Size ?? ep.MediaSources?.[0]?.Size,
        ...normalizeVideoQuality(
          (ep.MediaStreams ?? ep.MediaSources?.[0]?.MediaStreams)?.find(
            (s) => s.Type === "Video"
          )
        ),
        householdStates,
        requesterState,
      }
    })

    // Sort by Season ASC, Episode ASC
    episodes.sort(
      (a, b) =>
        a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber
    )

    if (episodeCache.size >= MAX_EPISODE_CACHE_SIZE) {
      clearEpisodeCache()
    }

    episodeCache.set(cacheKey, {
      data: episodes,
      expiresAt: Date.now() + EPISODE_CACHE_TTL_MS,
    })

    return { success: true, episodes }
  } catch (error) {
    console.error("[WatchedSeerr] Failed to fetch series episodes:", error)
    return {
      success: false,
      episodes: [] as AuditEpisodeItem[],
      error: String(error),
    }
  }
}

export async function deleteMediaAction(input: unknown) {
  if (isDeleteDisabled()) {
    return { success: false, error: "Delete functionality is disabled" }
  }

  const parsed = deleteActionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.format() }
  }

  const {
    id,
    tmdbId,
    tvdbId,
    mediaType,
    target,
    episodeFileId,
    episodeFileIds,
    removeFromLibrary,
  } = parsed.data
  let details = ""

  if (mediaType === "movie") {
    const radarr = new RadarrClient()
    if (radarr.isConfigured()) {
      const movie = await radarr.getMovieByTmdbId(tmdbId)
      if (movie) {
        if (removeFromLibrary) {
          await radarr.deleteMovie(movie.id, true)
          details = `Removed from Radarr library and disk (ID: ${movie.id}, title: ${movie.title})`
        } else {
          await radarr.unmonitorMovie(movie.id)
          if (movie.movieFileId) {
            await radarr.deleteMovieFile(movie.movieFileId)
          }
          details = `Unmonitored and deleted file from Radarr (ID: ${movie.id}, title: ${movie.title})`
        }
      } else {
        details = `Movie TMDB ${tmdbId} not found in Radarr`
      }
    } else {
      details = "Radarr not configured, simulated purge"
    }
  } else {
    const sonarr = new SonarrClient()
    if (sonarr.isConfigured()) {
      const series = tvdbId
        ? await sonarr.getSeriesByTvdbId(tvdbId)
        : await sonarr.getSeriesByTmdbId(tmdbId)

      if (series) {
        if (target === "single_episode") {
          if (!episodeFileId) {
            return {
              success: false,
              error: "episodeFileId is required for single_episode target",
            }
          }
          await sonarr.deleteEpisodeFile(episodeFileId)
          details = `Deleted episode file ${episodeFileId} from Sonarr series: ${series.title}`
        } else if (target === "watched_episodes") {
          const uniqueFileIds = [...new Set(episodeFileIds || [])]
          if (uniqueFileIds.length === 0) {
            return {
              success: false,
              error: "episodeFileIds array is required for watched_episodes target",
            }
          }
          const BATCH_SIZE = 8
          for (let i = 0; i < uniqueFileIds.length; i += BATCH_SIZE) {
            const batch = uniqueFileIds.slice(i, i + BATCH_SIZE)
            await Promise.all(batch.map((epId) => sonarr.deleteEpisodeFile(epId)))
          }
          details = `Deleted ${uniqueFileIds.length} episodes from Sonarr series: ${series.title}`
        } else if (removeFromLibrary) {
          await sonarr.deleteSeries(series.id, true)
          details = `Removed entire series from Sonarr library: ${series.title}`
        } else {
          await sonarr.unmonitorSeries(series.id)
          const files = await sonarr.getEpisodeFiles(series.id)
          if (files.length > 0) {
            const BATCH_SIZE = 8
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
              const batch = files.slice(i, i + BATCH_SIZE)
              await Promise.all(batch.map((f) => sonarr.deleteEpisodeFile(f.id)))
            }
          }
          details = `Unmonitored series and deleted ${files.length} episode files from Sonarr: ${series.title}`
        }
      } else {
        details = `Series TMDB ${tmdbId} not found in Sonarr`
      }
    } else {
      details = "Sonarr not configured, simulated purge"
    }
  }

  console.log(`[WatchedSeerr] Purged media: ${id} (${details})`)
  revalidateAuditViews()
  return { success: true, purgedId: id, details }
}
