export { cn } from "cn"
import type {
  AuditEpisodeItem,
  AuditMediaItem,
  UserPlaybackState,
} from "@/types"

export function formatMediaSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return ""
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
export function isDeleteDisabled(): boolean {
  const envVal =
    typeof process !== "undefined" && process?.env
      ? (process.env.DISABLE_DELETE ??
        process.env.NEXT_PUBLIC_DELETE_DISABLED ??
        process.env.DELETE_DISABLED)
      : undefined

  if (typeof envVal === "boolean") return envVal
  if (typeof envVal === "string") {
    return ["true", "1", "yes", "on"].includes(envVal.toLowerCase().trim())
  }
  return false
}

export function isEmptySeries(item: {
  mediaType?: string
  sizeBytes?: number | null
}): boolean {
  return item.mediaType === "tv" && (!item.sizeBytes || item.sizeBytes <= 0)
}

export function calculateDaysAgo(dateStr?: string): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function buildEpisodeSubRows(
  item: AuditMediaItem,
  episodes: AuditEpisodeItem[]
): {
  subRows: AuditMediaItem[]
  seriesDaysSinceLastPlayed: number | null
  requesterLastPlayedDate?: string
  householdLastPlayedDates: Map<string, string>
} {
  let seriesMostRecentDate: string | undefined
  let reqLatestDate: string | undefined = item.requesterState.lastPlayedDate
  const hhLatestDates = new Map<string, string>()

  const subRows: AuditMediaItem[] = episodes.map((ep) => {
    const sNum = String(ep.seasonNumber).padStart(2, "0")
    const eNum = String(ep.episodeNumber).padStart(2, "0")

    const epRequesterState: UserPlaybackState = {
      userId: ep.requesterState?.userId || item.requesterState.userId,
      username: ep.requesterState?.username || item.requesterState.username,
      isRequester: !!item.requester.username,
      status: ep.requesterState?.status ?? ep.status,
      progressPercent: ep.requesterState?.progressPercent ?? ep.progressPercent,
      lastPlayedDate: ep.requesterState?.lastPlayedDate ?? ep.lastPlayedDate,
      playCount:
        ep.requesterState?.playCount ?? (ep.status === "completed" ? 1 : 0),
    }

    const epHouseholdStates: UserPlaybackState[] =
      ep.householdStates && ep.householdStates.length > 0
        ? ep.householdStates
        : item.householdStates.map((h) => ({
            ...h,
            status: "unplayed",
            progressPercent: 0,
            lastPlayedDate: undefined,
            playCount: 0,
          }))

    if (epRequesterState.lastPlayedDate) {
      if (
        !reqLatestDate ||
        new Date(epRequesterState.lastPlayedDate) > new Date(reqLatestDate)
      ) {
        reqLatestDate = epRequesterState.lastPlayedDate
      }
    }

    for (const h of epHouseholdStates) {
      if (h.lastPlayedDate) {
        const cur = hhLatestDates.get(h.userId)
        if (!cur || new Date(h.lastPlayedDate) > new Date(cur)) {
          hhLatestDates.set(h.userId, h.lastPlayedDate)
        }
      }
    }

    let epMostRecentPlayedDate: string | undefined =
      epRequesterState.lastPlayedDate
    for (const h of epHouseholdStates) {
      if (h.lastPlayedDate) {
        if (
          !epMostRecentPlayedDate ||
          new Date(h.lastPlayedDate) > new Date(epMostRecentPlayedDate)
        ) {
          epMostRecentPlayedDate = h.lastPlayedDate
        }
      }
    }

    if (epMostRecentPlayedDate) {
      if (
        !seriesMostRecentDate ||
        new Date(epMostRecentPlayedDate) > new Date(seriesMostRecentDate)
      ) {
        seriesMostRecentDate = epMostRecentPlayedDate
      }
    }

    const daysSinceLastPlayed = calculateDaysAgo(epMostRecentPlayedDate)

    return {
      id: ep.id,
      requestId: item.requestId,
      tmdbId: item.tmdbId,
      jellyfinItemId: ep.episodeId,
      title: `S${sNum}E${eNum}: ${ep.name}`,
      mediaType: "tv" as const,
      requestedAt: item.requestedAt,
      requester: item.requester,
      requesterState: epRequesterState,
      householdStates: epHouseholdStates,
      daysSinceLastPlayed,
      conflictStatus:
        epHouseholdStates.some((h) => h.status === "in_progress")
          ? "conflict"
          : ep.status === "in_progress"
            ? "conflict"
            : ep.status === "completed"
              ? "safe"
              : "ghost",
      conflictReason: `Episode status: ${ep.status}`,
      isWhitelisted: item.isWhitelisted,
      episodes: [ep],
      sizeBytes: ep.sizeBytes,
      quality: ep.quality,
      qualityFull: ep.qualityFull,
    }
  })

  const seriesDaysSinceLastPlayed =
    calculateDaysAgo(seriesMostRecentDate) ?? item.daysSinceLastPlayed

  return {
    subRows,
    seriesDaysSinceLastPlayed,
    requesterLastPlayedDate: reqLatestDate,
    householdLastPlayedDates: hhLatestDates,
  }
}
