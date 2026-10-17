"use server"

import { revalidatePath } from "next/cache"
import { toggleWhitelistItem } from "@/lib/whitelist"
import { toggleWhitelistSchema, deleteActionSchema } from "@/lib/validation/actions"
import { RadarrClient } from "@/lib/clients/radarr"
import { SonarrClient } from "@/lib/clients/sonarr"

export async function toggleWhitelistAction(input: unknown) {
  const parsed = toggleWhitelistSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.format() }
  }

  const isWhitelisted = toggleWhitelistItem(parsed.data)
  revalidatePath("/")
  revalidatePath("/matrix")
  return { success: true, isWhitelisted }
}

export async function deleteMediaAction(input: unknown) {
  const parsed = deleteActionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.format() }
  }

  const { id, tmdbId, tvdbId, mediaType, target, episodeFileIds } = parsed.data
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
        if (target === "watched_episodes" && episodeFileIds && episodeFileIds.length > 0) {
          await Promise.all(episodeFileIds.map((epId) => sonarr.deleteEpisodeFile(epId)))
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
  revalidatePath("/")
  revalidatePath("/matrix")
  return { success: true, purgedId: id, details }
}
