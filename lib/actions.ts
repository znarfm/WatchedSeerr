"use server"

import { revalidatePath } from "next/cache"
import { toggleWhitelistItem } from "@/lib/whitelist"
import {
  toggleWhitelistSchema,
  deleteActionSchema,
} from "@/lib/validation/actions"
import { RadarrClient } from "@/lib/clients/radarr"
import { SonarrClient } from "@/lib/clients/sonarr"
import { JellyfinClient } from "@/lib/clients/jellyfin"
import { SeerrClient } from "@/lib/clients/seerr"
import { invalidateAuditCache, normalizeVideoQuality } from "@/lib/audit"
import { isDeleteDisabled } from "@/lib/utils"
import type {
  AuditEpisodeItem,
  JellyfinItem,
  JellyfinUser,
  SeerrUser,
  UserPlaybackState,
  WatchStatus,
} from "@/types"

export async function refreshAuditAction() {
  invalidateAuditCache()
  try {
    revalidatePath("/")
    revalidatePath("/matrix")
  } catch {
    // Outside Next.js request context (e.g. tests)
  }
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
  invalidateAuditCache()
  try {
    revalidatePath("/")
    revalidatePath("/matrix")
  } catch {
    // Outside Next.js request context (e.g. tests)
  }
  return { success: true, isWhitelisted }
}

export async function getSeriesEpisodesAction(
  jellyfinItemId: string,
  seriesTmdbId: number,
  userId?: string,
  householdUsers?: { userId: string; username: string; avatarUrl?: string }[],
  requesterUsername?: string
) {
  try {
    const jellyfin = new JellyfinClient()
    const sonarr = new SonarrClient()

    const [jellyfinEpisodes, sonarrSeries] = await Promise.all([
      jellyfin.getEpisodes(jellyfinItemId, userId),
      sonarr.isConfigured()
        ? sonarr.getSeriesByTmdbId(seriesTmdbId)
        : Promise.resolve(null),
    ])

    const otherUsers = (householdUsers || []).filter(
      (u) => u.userId && u.userId !== userId
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

    let sonarrFiles: {
      id: number
      seasonNumber: number
      relativePath: string
    }[] = []
    if (sonarrSeries) {
      sonarrFiles = await sonarr.getEpisodeFiles(sonarrSeries.id)
    }

    const episodes: AuditEpisodeItem[] = jellyfinEpisodes.map((ep) => {
      const seasonNumber = ep.ParentIndexNumber ?? 1
      const episodeNumber = ep.IndexNumber ?? 0
      const userData = ep.UserData

      let status: WatchStatus = "unplayed"
      let progressPercent = 0
      if (userData?.Played) {
        status = "completed"
        progressPercent = 100
      } else if (userData?.PlaybackPositionTicks && ep.RunTimeTicks) {
        progressPercent = Math.min(
          99,
          Math.round((userData.PlaybackPositionTicks / ep.RunTimeTicks) * 100)
        )
        status = progressPercent > 90 ? "completed" : "in_progress"
      }

      // Try matching Sonarr episode file by season & episode pattern in relativePath or seasonNumber
      const matchedSonarrFile = sonarrFiles.find((f) => {
        if (f.seasonNumber !== seasonNumber) return false
        const epPattern = new RegExp(`E0*${episodeNumber}\\b`, "i")
        return epPattern.test(f.relativePath)
      })

      const requesterState: UserPlaybackState = {
        userId: userId || "",
        username: requesterUsername || "",
        isRequester: true,
        status,
        progressPercent,
        lastPlayedDate:
          status === "unplayed" ? undefined : userData?.LastPlayedDate,
        playCount: status === "completed" ? 1 : userData?.PlayCount || 0,
      }

      const householdStates: UserPlaybackState[] = otherUserEpisodes.map(
        ({ user, items }) => {
          const userEp = items.find((i) => i.Id === ep.Id)
          const uData = userEp?.UserData
          let uStatus: WatchStatus = "unplayed"
          let uProgressPercent = 0
          if (uData?.Played) {
            uStatus = "completed"
            uProgressPercent = 100
          } else if (
            uData?.PlaybackPositionTicks &&
            (userEp?.RunTimeTicks || ep.RunTimeTicks)
          ) {
            const ticks = userEp?.RunTimeTicks || ep.RunTimeTicks || 1
            uProgressPercent = Math.min(
              99,
              Math.round((uData.PlaybackPositionTicks / ticks) * 100)
            )
            uStatus = uProgressPercent > 90 ? "completed" : "in_progress"
          }

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
        if (target === "single_episode" && episodeFileId) {
          await sonarr.deleteEpisodeFile(episodeFileId)
          details = `Deleted episode file ${episodeFileId} from Sonarr series: ${series.title}`
        } else if (
          target === "watched_episodes" &&
          episodeFileIds &&
          episodeFileIds.length > 0
        ) {
          await Promise.all(
            episodeFileIds.map((epId) => sonarr.deleteEpisodeFile(epId))
          )
          details = `Deleted ${episodeFileIds.length} episodes from Sonarr series: ${series.title}`
        } else if (removeFromLibrary) {
          await sonarr.deleteSeries(series.id, true)
          details = `Removed entire series from Sonarr library: ${series.title}`
        } else {
          await sonarr.unmonitorSeries(series.id)
          const files = await sonarr.getEpisodeFiles(series.id)
          if (files.length > 0) {
            await Promise.all(files.map((f) => sonarr.deleteEpisodeFile(f.id)))
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
  invalidateAuditCache()
  try {
    revalidatePath("/")
    revalidatePath("/matrix")
  } catch {
    // Outside Next.js request context (e.g. tests)
  }
  return { success: true, purgedId: id, details }
}
