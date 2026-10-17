# Spec: TV Series Size Aggregation, Quality Badge Normalization, Fixed Column Widths & `"new"` Status

## Problem Statement

Live inspection of the Audit Queue and Watch Matrix revealed four issues affecting data accuracy, layout stability, and media retention safety:
1. **Missing `sizeBytes` and `quality` on All TV Series**: Every TV series (`mediaType === "tv"`, 15/15 series on the live server) displays `—` in the `Size` column and lacks a quality badge. In Jellyfin, `Series` items (`Type === "Series"`) are virtual containers that do not carry `Size` or `MediaSources`; file sizes and video streams live on child `Episode` items. Additionally, `SONARR_API_KEY` is not always configured, so TV series size and quality must be resolved directly from Jellyfin episodes.
2. **Oversized Quality Badges from Embedded MKV Track Titles**: `lib/audit.ts` sets `quality = videoStream.DisplayTitle`. When MKV files contain release-group strings in their video track title, Jellyfin's `DisplayTitle` returns strings like `"GalaxyRG265 - Inception.2010.1080p.BluRay.DDP5.1.x265.10bit-GalaxyRG265 - HEVC - SDR"` or `"Shake Rattle And Roll - Le origini del male (2025) MIRCrew - 1080p - H264 - SDR"`, stretching the `Size` column and breaking table proportions.
3. **Unconstrained Table Column Widths**: Columns in `components/audit-table/columns.tsx` and `components/audit-table/data-table.tsx` do not define explicit widths, allowing long titles or badges to shift column layout across pages.
4. **Freshly Requested Unwatched Media Marked `Safe to Purge`**: In `lib/audit.ts`, `conflictStatus` defaults to `"safe"` (`"No active household viewing detected"`). When an item is newly requested (`daysSinceAdded < ghostThreshold`, e.g. `< 30` days ago) and `requesterState.status === "unplayed"` with no active household viewers, it falls through all `if / else if` branches (`activeNonRequesters.length > 0`, `unplayed && daysSinceAdded >= ghostThreshold`, `in_progress`) and remains `"safe"`. On the live server, newly requested titles (`Agatha All Along` requested 1 day ago, `Study Group` requested 6 days ago, `Hidden Figures` requested 25 days ago) were erroneously flagged as `Safe to Purge` simply because nobody had started watching them yet.

## Solution

1. **Bulk Jellyfin Episode Size & Video Stream Aggregation**:
   - Add `getAllEpisodesMetadata(): Promise<JellyfinItem[]>` to `JellyfinClient` (`lib/clients/jellyfin.ts`) querying `/Items?Recursive=true&IncludeItemTypes=Episode&Fields=MediaSources,MediaStreams,Size&EnableUserData=false&EnableImages=false&EnableTotalRecordCount=false&Limit=10000` in parallel during `auditMedia()`.
   - Aggregate episode byte sizes (`ep.Size ?? ep.MediaSources?.[0]?.Size ?? 0`) and extract the first representative `Video` stream (`Width`, `Height`, `Codec`, `DisplayTitle`) per `SeriesId` so all TV series report total disk usage and video quality.
2. **Quality Badge Normalization (`quality` vs `qualityFull`)**:
   - Add a pure helper `normalizeVideoQuality(videoStream, is4k)` in `lib/audit.ts` that derives a compact resolution string (`"4K"`, `"1080p"`, `"720p"`, `"480p"`) from structured `Width`/`Height` (with a regex fallback `/\b(2160p|4k|1080p|720p|576p|480p)\b/i` on `DisplayTitle`) and a normalized codec (`"HEVC"`, `"H.264"`, `"AV1"`).
   - Store the compact resolution in `item.quality` (e.g. `"1080p"`) for the table `Size` column badge, and `item.qualityFull` (e.g. `"1080p HEVC"`) for `<MediaDetailSheet>`.
3. **Explicit Column Widths in Audit Queue**:
   - Define explicit column width classes (`meta: { className: "w-[...]" }`) on each column in `components/audit-table/columns.tsx` and apply `header.column.columnDef.meta?.className` and `cell.column.columnDef.meta?.className` in `components/audit-table/data-table.tsx`.
4. **4th Conflict Status `"new"` (`New / Unwatched`)**:
   - Extend `ConflictStatus` to `"safe" | "conflict" | "ghost" | "new"`, and add `newCount: number` to `AuditReport` (`types/index.ts`) and `MetricCounts` (`components/audit-table/data-table.tsx`).
   - In `lib/audit.ts`, when `activeNonRequesters.length === 0` and `requesterState.status === "unplayed"` and `daysSinceAdded < ghostThreshold`, set `conflictStatus = "new"` and `conflictReason = "Recently requested (${daysSinceAdded} days ago) — awaiting first watch"`.
   - Render a 5-card clickable metric grid in `DataTable` (`Total Audited`, `Safe to Purge`, `New / Unwatched` in sky-blue `text-sky-500 ring-sky-500 bg-sky-500/15`, `Active Conflicts`, `Ghost Requests`), a sky-blue `New` status badge in `columns.tsx`, `watch-matrix.tsx`, and `<MediaDetailSheet>`, and a `New` option in the Watch Matrix status dropdown.

## User Stories

1. As an administrator, I want TV series rows in the Audit Queue and detail sheet to display their total disk size (summed across all downloaded episodes in Jellyfin), so that I can see how much storage each TV series consumes even when Sonarr is not configured.
2. As an administrator, I want TV series rows to display a video resolution badge (`4K`, `1080p`, `720p`) derived from their episode media streams, so that TV series have the same quality metadata as movies.
3. As an administrator, I want the quality badge in the `Size` column to always be a short, normalized resolution label (`4K`, `1080p`, `720p`, `480p`) rather than raw MKV track titles containing release group names, so that the `Size` column never stretches horizontally.
4. As an administrator, I want to see both resolution and video codec (`1080p HEVC`, `1080p H.264`, `4K HEVC`, `1080p AV1`) when inspecting an item in `<MediaDetailSheet>`, so that I still have access to codec details without cluttering the table.
5. As an administrator, I want each column in the Audit Queue table to have a predictable width (`w-[...]`), so that sorting or paging through items with long titles does not cause columns to jump or reflow.
6. As an administrator, I want newly requested media (`daysSinceAdded < ghostThreshold`, default `< 30` days) that the requester has not started watching yet (`status === "unplayed"`) and has no active household viewers to be classified as `"new"` instead of `"safe"`, so that I never accidentally purge a movie or show that was just downloaded and is awaiting its first watch.
7. As an administrator, I want unplayed media that has exceeded `ghostThreshold` days (`daysSinceAdded >= 30`) to continue transitioning from `"new"` to `"ghost"` (`Ghost Requests`), so that abandoned requests are still flagged for cleanup.
8. As an administrator, I want a 5th clickable metric card (`New / Unwatched`) in the top summary bar with a sky-blue highlight (`ring-1 ring-sky-500 bg-sky-500/15`), so that I can see the count of fresh unwatched requests and click the card to filter the Audit Queue to only `"new"` items.
9. As an administrator, I want `"new"` items to render a sky-blue `New` badge in both the Audit Queue `Status` column and the Watch Matrix `Requested Media` column, as well as a sky-blue status banner inside `<MediaDetailSheet>`.
10. As an administrator, I want the Watch Matrix status dropdown filter to include `New` alongside `Safe`, `Conflict`, and `Ghost`, so that I can filter the matrix by all four retention states.

## Implementation Decisions

### 1. Domain Types (`types/index.ts`)
- Update `ConflictStatus`:
  ```ts
  export type ConflictStatus = "safe" | "conflict" | "ghost" | "new"
  ```
- Extend `JellyfinItem.MediaSources[number].MediaStreams[number]` with optional structured video properties:
  ```ts
  Width?: number
  Height?: number
  Codec?: string
  VideoRange?: string
  ```
- Add `qualityFull?: string` to `AuditMediaItem`.
- Add `newCount: number` to `AuditReport`.

### 2. Bulk Episode Metadata Query (`lib/clients/jellyfin.ts`)
Add `getAllEpisodesMetadata()` to `JellyfinClient`:
```ts
  /**
   * Fetches episode size and media stream metadata across the library in a single call
   * so parent TV Series items can aggregate total disk size and video resolution/codec.
   */
  async getAllEpisodesMetadata(): Promise<JellyfinItem[]> {
    const res = await this.request<JellyfinItemsResponse>(
      "/Items?Recursive=true&IncludeItemTypes=Episode&Fields=MediaSources,MediaStreams,Size&EnableUserData=false&EnableImages=false&EnableTotalRecordCount=false&Limit=10000"
    )
    return res.Items || []
  }
```

### 3. Quality Normalization, Episode Aggregation & `"new"` Status (`lib/audit.ts`)
Export `normalizeVideoQuality`:
```ts
export function normalizeVideoQuality(
  videoStream?: {
    Width?: number
    Height?: number
    Codec?: string
    DisplayTitle?: string
  },
  is4k?: boolean
): { quality?: string; qualityFull?: string } {
  let resolution: string | undefined
  const w = videoStream?.Width || 0
  const h = videoStream?.Height || 0
  const display = videoStream?.DisplayTitle || ""

  if (w >= 3800 || h >= 2100 || /\b(2160p|4k|uhd)\b/i.test(display)) {
    resolution = "4K"
  } else if (w >= 1900 || h >= 900 || /\b1080[pi]\b/i.test(display)) {
    resolution = "1080p"
  } else if (w >= 1200 || h >= 680 || /\b720p\b/i.test(display)) {
    resolution = "720p"
  } else if (w > 0 || h > 0 || /\b(576p|480p|sd)\b/i.test(display)) {
    const match = display.match(/\b(576p|480p)\b/i)
    resolution = match ? match[1].toLowerCase() : "480p"
  } else if (is4k) {
    resolution = "4K"
  }

  let codec: string | undefined
  const rawCodec = (videoStream?.Codec || "").toLowerCase()
  if (rawCodec === "hevc" || rawCodec === "h265" || /\b(hevc|x265|h\.?265)\b/i.test(display)) {
    codec = "HEVC"
  } else if (rawCodec === "h264" || rawCodec === "avc" || /\b(h\.?264|x264|avc)\b/i.test(display)) {
    codec = "H.264"
  } else if (rawCodec === "av1" || /\bav1\b/i.test(display)) {
    codec = "AV1"
  } else if (rawCodec) {
    codec = rawCodec.toUpperCase()
  }

  const quality = resolution || codec
  const qualityFull = resolution && codec ? `${resolution} ${codec}` : quality

  return { quality, qualityFull }
}
```
In `auditMedia()`:
- Fetch `typeof (jellyfin as any).getAllEpisodesMetadata === "function" ? jellyfin.getAllEpisodesMetadata().catch(() => []) : Promise.resolve([])` in `Promise.all`.
- Build a `seriesEpisodeStats = new Map<string, { totalSize: number; videoStream?: any }>()` indexed by `ep.SeriesId` summing `ep.Size ?? ep.MediaSources?.[0]?.Size ?? 0` and capturing the first `Video` stream.
- For each audited item:
  - `const epStats = jellyfinItem ? seriesEpisodeStats.get(jellyfinItem.Id) : undefined`
  - `const videoStream = jellyfinItem.MediaSources?.[0]?.MediaStreams?.find((s) => s.Type === "Video") || epStats?.videoStream`
  - `const { quality, qualityFull } = normalizeVideoQuality(videoStream, req.is4k)`
  - `const sizeBytes = jellyfinItem?.Size ?? jellyfinItem?.MediaSources?.[0]?.Size ?? (epStats && epStats.totalSize > 0 ? epStats.totalSize : undefined)`
- In the conflict resolution logic:
  ```ts
    if (activeNonRequesters.length > 0) {
      conflictStatus = "conflict"
      conflictReason = `Active viewer(s) in household: ${activeNonRequesters.map((u) => u.username).join(", ")}`
    } else if (requesterState.status === "unplayed") {
      if (daysSinceAdded >= ghostThreshold) {
        conflictStatus = "ghost"
        conflictReason = `Requester has never watched item (${daysSinceAdded} days since requested)`
      } else {
        conflictStatus = "new"
        conflictReason = `Recently requested (${daysSinceAdded} days ago) — awaiting first watch`
      }
    } else if (requesterState.status === "in_progress") {
      ...
    }
  ```

### 4. Fixed Column Widths & 5-Card Metric Grid (`components/audit-table/columns.tsx`, `components/audit-table/data-table.tsx`, `components/matrix-table/watch-matrix.tsx`, `components/media-detail-sheet.tsx`)
- In `columns.tsx`:
  - Add `meta: { className: ... }` to each column definition:
    - `select`: `"w-10"`
    - `title`: `"min-w-[240px] max-w-[340px]"`
    - `requester`: `"w-36"`
    - `progress`: `"w-44"`
    - `household`: `"w-28"`
    - `size`: `"w-36 whitespace-nowrap"`
    - `requested`: `"w-28 whitespace-nowrap"`
    - `inactive`: `"w-24 whitespace-nowrap"`
    - `status`: `"w-28 whitespace-nowrap"`
    - `actions`: `"w-12 text-right"`
  - Render a sky-blue badge for `status === "new"`:
    ```tsx
    if (status === "new") {
      return (
        <Badge className="bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20">
          <IconSparkles className="size-3 mr-1" /> New
        </Badge>
      )
    }
    ```
- In `data-table.tsx`:
  - Update `MetricCounts` and `computeMetricCounts` to include `newCount: items.filter((i) => i.conflictStatus === "new").length`.
  - Render 5 metric cards in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`: `Total Audited`, `Safe to Purge`, `New / Unwatched` (`ring-1 ring-sky-500 bg-sky-500/15`, `text-sky-500`), `Active Conflicts`, `Ghost Requests`.
  - Pass `(header.column.columnDef.meta as any)?.className` to `<TableHead>` and `(cell.column.columnDef.meta as any)?.className` to `<TableCell>`.
- In `watch-matrix.tsx` and `media-detail-sheet.tsx`:
  - Render the sky-blue `New` badge and status banner (`bg-sky-500/10 border-sky-500/30 text-sky-400`), add `<SelectItem value="new">New</SelectItem>` to the Watch Matrix status dropdown, and display `selectedItem.qualityFull || selectedItem.quality` in `<MediaDetailSheet>`.

## Testing Decisions

- **What makes a good test**: Test external behavior through the public `auditMedia()`, `normalizeVideoQuality()`, `computeMetricCounts()`, `resolveStatusCardClick()`, and SSR component rendering seams without coupling to internal variables.
- **Modules to test**:
  1. `lib/audit.ts` (`normalizeVideoQuality`, TV series episode size/quality aggregation, and `"new"` vs `"ghost"` vs `"safe"` classification for unplayed items).
  2. `components/audit-table/data-table.tsx` & `components/audit-table/columns.tsx` (`computeMetricCounts` with `newCount`, 5-card grid rendering, `"new"` badge rendering, and column width classes).
  3. `components/matrix-table/watch-matrix.tsx` & `components/media-detail-sheet.tsx` (`"new"` status badge/filter and `qualityFull` badge in detail sheet).
- **Prior art**: Follow existing node test runner suites in `tests/user-reconciliation-and-watch-status.test.ts`, `tests/clickable-metric-cards.test.ts`, and `tests/watch-matrix.test.ts`.

## Out of Scope

- Querying Sonarr/Radarr APIs for disk sizes during initial page load when Jellyfin already provides episode/movie file sizes.
- Custom per-item grace period overrides in the database.

## Further Notes

- Existing tests that construct unplayed mock items with recent `createdAt` timestamps (such as `new Date().toISOString()`) expecting `"safe"` should be aware that unplayed items with `daysSinceAdded < ghostThreshold` now accurately classify as `"new"`, while completed items (`Played: true` or `PlayCount > 0`) or abandoned `in_progress` items (`daysSinceLastPlayed > conflictThreshold`) classify as `"safe"`.
