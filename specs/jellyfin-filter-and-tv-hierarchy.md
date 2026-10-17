# Spec: Jellyfin-Only Audit Filter & TV Series Hierarchy

## Problem Statement

Users encounter two primary pain points in WatchedSeerr:
1. Media items that exist in Seerr or Arr databases as tracked requests/records—but have no actual downloaded files in Jellyfin (e.g. abandoned, unmonitored, or unacquired titles)—are displayed as "Ghost" requests. Because these items have no files in Jellyfin, auditing or purging them from a disk retention perspective creates noise and false alerts.
2. For TV series, individual requested entries display only repeated show titles without seasons or episodes, cluttering the view. Users cannot see which specific episodes are watched or unwatched, nor can they delete individual finished episodes without purging the entire series.

## Solution

1. **Jellyfin Existence Filter**: Filter the audit pipeline so that only media items with active, confirmed Jellyfin library items (`jellyfinItem !== undefined`) are included in the retention audit queue. Undownloaded/tracked-only items in Seerr/Arr are excluded from the active queue.
2. **TV Series Grouping & Sub-Rows**: Aggregate TV items at the Series parent level in TanStack Table. Provide an expandable chevron toggle on TV rows that reveals sub-rows representing seasons and episodes formatted as `SxxExx: [Episode Title]`.
3. **On-Demand Episode Fetching**: Load episodes and their per-user playback stats on demand when expanding a TV series row, keeping the initial scan instant.
4. **Scoped Purge Actions**:
   - Parent row action purges the entire series via Sonarr / Jellyfin.
   - Sub-row action purges only that specific episode file via Sonarr (`deleteEpisodeFile`).
5. **Aggregate Series Retention Status**: Compute the series parent retention status (Safe, Conflict, Ghost) from aggregate household playback across all episodes.

## User Stories

1. As an administrator, I want media that is tracked in Seerr/Arr but not downloaded in Jellyfin to be omitted from the audit queue, so that my retention table only contains items consuming actual storage.
2. As an administrator, I want TV series to display as a single consolidated row per show, so that my table is clean and not inundated with repeated series titles.
3. As an administrator, I want an expandable toggle on TV series rows, so that I can inspect seasons and individual episodes on demand.
4. As an administrator, I want episode sub-rows to display season and episode numbers alongside episode names (e.g., `S01E03: Five-O`), so that I can quickly identify individual episodes.
5. As an administrator, I want each episode sub-row to show its specific requester and household playback status, so that I can see who has watched each episode.
6. As an administrator, I want to delete a single completed episode file from Sonarr without removing the rest of the series, so that I can free disk space progressively.
7. As an administrator, I want the series parent row to have a "Purge Series" action, so that I can still remove an entire series and all its files with one action.
8. As an administrator, I want episode details to load asynchronously when I expand a row, so that the initial page load remains fast and lightweight.
9. As an administrator, I want a series parent row to reflect "Conflict" if any household member is currently partway through watching the season, so that I don't purge in-progress shows.
10. As an administrator, I want a series parent row to reflect "Safe" if all watched household members have completed the series and retention thresholds have passed, so that finished series are clear to purge.

## Implementation Decisions

### 1. Audit Filtering (`lib/audit.ts`)
Filter out any Seerr request where no corresponding Jellyfin item exists:
```ts
// In lib/audit.ts:
for (const req of requests) {
  const media = req.media
  if (!media || !media.tmdbId) continue
  const jellyfinItem = jfByTmdb.get(String(media.tmdbId))
  // Skip tracked/unacquired media that does not exist in Jellyfin
  if (!jellyfinItem) continue
  ...
}
```

### 2. On-Demand Episode Fetch Server Action (`lib/actions.ts`)
Add `getSeriesEpisodesAction(jellyfinItemId: string, seriesTmdbId: number)`:
- Calls Jellyfin `getEpisodes(seriesId)` to obtain episode metadata and user playback stats.
- Optionally fetches Sonarr episode files for file ID mapping (for single episode purging).
- Returns structured `AuditEpisodeItem[]`.

### 3. Domain Model Extension (`types/index.ts`)
```ts
export interface AuditEpisodeItem {
  id: string
  episodeId: string // Jellyfin Episode ID
  seriesId: string
  sonarrEpisodeFileId?: number
  seasonNumber: number
  episodeNumber: number
  name: string
  progressPercent: number
  status: WatchStatus
  lastPlayedDate?: string
}

export interface AuditMediaItem {
  ...
  episodes?: AuditEpisodeItem[] // Populated on expand
  subRows?: AuditMediaItem[]
}
```

### 4. Table UI Hierarchy (`components/audit-table/`)
- Enable TanStack Table `getExpandedRowModel()`, `getSubRows: row => row.subRows`.
- `columns.tsx`:
  - Title column adds an expandable arrow button (`IconChevronRight` / `IconChevronDown`) when `row.original.mediaType === "tv"`.
  - Sub-row title rendered with indent and badge: `S{season}E{episode}: {name}`.
  - Sub-row actions provide single episode delete button calling `deleteMediaAction` with `target: "single_episode"` and `episodeFileId`.

## Testing Decisions

- **Good Test Standard**: Test external contracts and outcomes:
  - Verify `auditMedia()` omits requests with no matching Jellyfin library item.
  - Verify `auditMedia()` includes requests that have matching Jellyfin library items.
  - Verify `deleteMediaAction` handles single episode file deletion vs full series deletion.
- **Modules Tested**: `lib/audit.ts` and `lib/actions.ts`.
- **Prior Art**: `tests/arr-clients.test.ts` and `tests/validation.test.ts`.

## Out of Scope

- Client-side virtualized infinite scrolling (standard pagination is retained).
- Automatic background unmonitoring of series in Sonarr when episodes are deleted.
- Modifying Jellyfin playback tracking database directly.

## Further Notes

- Sonarr API already provides `deleteEpisodeFile(id)` in `lib/clients/sonarr.ts`.
- Jellyfin API already supports `/Shows/{id}/Episodes` in `lib/clients/jellyfin.ts`.
