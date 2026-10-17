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
import { invalidateAuditCache, normalizeVideoQuality } from "@/lib/audit"
import type { AuditEpisodeItem, WatchStatus } from "@/types"

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

export async function toggleWhitelistAction(input: unknown) {
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
  userId?: string
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
        lastPlayedDate: status === "unplayed" ? undefined : userData?.LastPlayedDate,
        sizeBytes: ep.Size ?? ep.MediaSources?.[0]?.Size,
        ...normalizeVideoQuality(
          ((ep as any).MediaStreams ?? ep.MediaSources?.[0]?.MediaStreams)?.find(
            (s: any) => s.Type === "Video"
          )
        ),
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
  } = parsed.data
  let details = ""

  if (mediaType === "movie") {
    const radarr = new RadarrClient()
    if (radarr.isConfigured()) {
      const movie = await radarr.getMovieByTmdbId(tmdbId)
      if (movie) {
        await radarr.deleteMovie(movie.id, true)
        details = `Deleted from Radarr (ID: ${movie.id}, title: ${movie.title})`
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
        } else {
          await sonarr.deleteSeries(series.id, true)
          details = `Deleted entire series from Sonarr: ${series.title}`
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
