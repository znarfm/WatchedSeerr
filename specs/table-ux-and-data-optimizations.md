# Spec: Table Display, Sorting, Filtering, Pagination & Data Retrieval Optimizations

## Problem Statement

1. **Missing Table Context & Sort Feedback**: The Audit Queue table (`components/audit-table/columns.tsx`) lacks at-a-glance columns for disk size (`sizeBytes` + quality badge), request age (`requestedAt`), and household viewer activity, forcing administrators to click open the detail sheet row-by-row. Moreover, Jellyfin's `getAllLibraryItems()` omits `MediaSources,Size` in its `Fields` query, so `sizeBytes` is always `undefined`. Sortable headers also display a static two-way icon (`IconArrowsSort`) regardless of sort direction, and only three columns are sortable.
2. **Limited Filtering & Fixed 10-Row Pagination**: Administrators can only filter by title, media type, and retention status, with no ability to filter by requester, requester watch status (`completed`, `in_progress`, `unplayed`), or whitelist protection state. Furthermore, pagination is hardcoded to 10 rows per page with no page-size selector.
3. **N+1 Metadata Requests & Repeated Cold Audits (`700ms–1450ms`)**: In `lib/audit.ts`, Step 4 fires batched `seerr.getMediaDetails()` HTTP requests for every item in Jellyfin (100+ calls on cold start) even though `getAllLibraryItems()` already returns `Name`, `ProductionYear`, `Overview`, `Genres`, and `ImageTags`. Additionally, navigating between `/` and `/matrix` re-runs the entire multi-endpoint audit pipeline on every click.

## Solution

1. **Richer Table Columns & Directional Sorting (`components/audit-table/columns.tsx`)**:
   - Add **Size** (`sizeBytes` formatted in GB/MB + `quality` badge), **Requested** (`requestedAt` formatted date + relative age), and **Household** (overlapping `<Avatar>` stack of active/completed household viewers with tooltip breakdown) columns.
   - Make all data columns sortable (`Media`, `Requester`, `Requester Progress`, `Household`, `Size`, `Requested`, `Inactive`, `Retention Status`) with directional sort icons (`IconArrowUp`, `IconArrowDown`, `IconArrowsSort`).
   - Sort `Inactive` (`daysSinceLastPlayed === null` / `"Never"`) as `Infinity` so unplayed items sort as longest-inactive.
2. **Expanded Faceted Filters & Page Size Selector (`components/audit-table/data-table.tsx`)**:
   - Add **Requester** `<Select>` (`All Requesters` + unique requesters from dataset), **Watch State** `<Select>` (`All Watch States`, `Completed`, `In Progress`, `Unplayed`), and **Whitelist** `<Select>` (`All Items`, `Whitelisted`, `Unprotected`), plus a **Reset** button when any filter/search is active.
   - Default table pagination to `25` rows per page and add a rows-per-page `<Select>` (`10`, `25`, `50`, `100`) in the pagination footer.
3. **Data Retrieval & Caching Optimizations (`lib/audit.ts`, `lib/clients/jellyfin.ts`, `lib/actions.ts`)**:
   - Skip `seerr.getMediaDetails()` whenever `jellyfinItem.Name` is already present on the matched Jellyfin library item.
   - Add `MediaSources,Size` (and `EnableUserData=false`) to `getAllLibraryItems()` so `sizeBytes` resolves from `jellyfinItem.Size ?? jellyfinItem.MediaSources?.[0]?.Size`, and add `EnableImages=false&EnableTotalRecordCount=false` to `getAllUserItems(userId)`.
   - Cache the computed `AuditReport` in process memory for 60 seconds (bypassed when custom test clients are injected), automatically invalidated by `deleteMediaAction`, `toggleWhitelistAction`, or a manual `refreshAuditAction` button in the header.

## User Stories

1. As an administrator, I want to see each media item's disk size (e.g. `14.2 GB`) and video quality badge (e.g. `4K`, `1080p`) directly in the table, so that I can prioritize purging the largest files first.
2. As an administrator, I want to sort by the Size column, so that the largest space-consuming movies and shows rise to the top of the queue.
3. As an administrator, I want to see when each item was requested (`Requested` column) and sort by request date, so that I can audit older requests first.
4. As an administrator, I want to see an avatar stack or count of household viewers in a `Household` column with a hover tooltip showing their watch progress, so that I know who else has watched or is watching an item without opening the side sheet.
5. As an administrator, I want every data column header to show an up arrow (`↑`) when sorted ascending and a down arrow (`↓`) when sorted descending, so that the current sort state is unmistakable.
6. As an administrator, I want items that have `"Never"` been played (`daysSinceLastPlayed: null`) to sort as the most inactive (`Infinity`) when sorting the `Inactive` column, so that completely unwatched items appear at the top of descending inactivity sorts.
7. As an administrator, I want to filter the table by Requester via a dropdown, so that I can review all requests from a specific household member (e.g. `Meinard`, `Family`, `jenna`).
8. As an administrator, I want to filter the table by Requester Watch State (`Completed`, `In Progress`, `Unplayed`), so that I can isolate completed items vs abandoned in-progress items.
9. As an administrator, I want to filter the table by Whitelist status (`All Items`, `Whitelisted`, `Unprotected`), so that I can hide whitelisted media while deciding what to purge or review my protected list.
10. As an administrator, I want a single `Reset` button in the toolbar whenever any search or dropdown filter is active, so that I can clear all filters in one click.
11. As an administrator, I want the table to display `25` rows per page by default and let me switch between `10`, `25`, `50`, and `100` rows via a pagination dropdown, so that I can scan larger queues with fewer page flips.
12. As an administrator, I want `auditMedia()` to use Jellyfin's bulk library metadata (`Name`, `ProductionYear`, `Overview`, `Genres`, `Size`) without firing 100+ redundant `seerr.getMediaDetails()` calls, so that cold server loads complete significantly faster.
13. As an administrator, I want a 60-second server-side cache on `auditMedia()` paired with automatic invalidation on purge/whitelist and a manual `Refresh` button in the header, so that switching between Audit Queue (`/`) and Watch Matrix (`/matrix`) is instantaneous (`<5ms`).

## Implementation Decisions

### 1. Jellyfin Query Optimization & `sizeBytes` Extraction (`lib/clients/jellyfin.ts` & `lib/audit.ts`)
- In `lib/clients/jellyfin.ts`:
  ```ts
  async getAllLibraryItems(): Promise<JellyfinItem[]> {
    const res = await this.request<JellyfinItemsResponse>(
      "/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,ProductionYear,RunTimeTicks,Path,Overview,Genres,MediaStreams,MediaSources,Size,ImageTags&EnableUserData=false&Limit=5000"
    )
    return res.Items || []
  }

  async getAllUserItems(userId: string): Promise<JellyfinItem[]> {
    const res = await this.request<JellyfinItemsResponse>(
      `/Users/${userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=UserData&EnableImages=false&EnableTotalRecordCount=false&Limit=5000`
    )
    return res.Items || []
  }
  ```
- In `types/index.ts`, add `Size?: number` to `JellyfinMediaSource`:
  ```ts
  export interface JellyfinMediaSource {
    Size?: number
    MediaStreams?: JellyfinMediaStream[]
  }
  ```
- In `lib/audit.ts`:
  - Resolve `sizeBytes = jellyfinItem.Size ?? jellyfinItem.MediaSources?.[0]?.Size`.
  - In Step 4 (`missingRequests`), only fetch `seerr.getMediaDetails(mediaType, tmdbId)` when `!jellyfinItem?.Name` and `!titleDetailsCache.has(key)`.

### 2. 60-Second `auditMedia` Report Cache & Invalidation (`lib/audit.ts` & `lib/actions.ts`)
- In `lib/audit.ts`:
  ```ts
  const AUDIT_CACHE_TTL_MS = 60_000
  let cachedAuditReport: { report: AuditReport; expiresAt: number } | null = null

  export function invalidateAuditCache() {
    cachedAuditReport = null
  }
  ```
  - When `auditMedia(options)` is called with default options (no custom `seerrClient`, `jellyfinClient`, `ghostThresholdDays`, or `conflictThresholdDays`) and `cachedAuditReport && Date.now() < cachedAuditReport.expiresAt`, return `cachedAuditReport.report`.
- In `lib/actions.ts`:
  - Call `invalidateAuditCache()` inside `toggleWhitelistAction`, `deleteMediaAction`, and a new `refreshAuditAction()` server action.

### 3. Table Columns & Custom Sorting (`components/audit-table/columns.tsx`)
- Add reusable `SortableHeader` helper rendering `IconArrowUp` (`asc`), `IconArrowDown` (`desc`), or `IconArrowsSort` (unsorted).
- Columns and sorting rules:
  - `title` (`Media`): case-insensitive string sort.
  - `requester` (`accessorFn: (row) => row.requester.username`): string sort.
  - `progress` (`accessorFn: (row) => row.requesterState.progressPercent`): numeric sort; also supports column filter by `row.requesterState.status` (`completed` | `in_progress` | `unplayed`).
  - `household` (`id: "household"`): displays overlapping `<Avatar>` stack for `householdStates` where `status !== "unplayed"` (or `"—"` if none), sorting by active/completed household viewer count.
  - `sizeBytes` (`id: "size"`, `accessorFn: (row) => row.sizeBytes ?? 0`): formats bytes into `GB` / `MB` alongside `row.quality` badge; numeric sort.
  - `requestedAt` (`id: "requested"`, `accessorFn: (row) => new Date(row.requestedAt).getTime() || 0`): displays formatted short date (`YYYY-MM-DD` or `MMM D, YYYY`); numeric timestamp sort.
  - `inactive` (`id: "inactive"`): custom `sortingFn` mapping `daysSinceLastPlayed === null` to `Number.POSITIVE_INFINITY`.
  - `status` (`id: "status"`, `accessorKey: "conflictStatus"`): sortable by status rank (`safe` -> `ghost` -> `conflict`) and filterable by exact `conflictStatus`.
  - Hidden filter column `whitelisted` (`accessorKey: "isWhitelisted"`): filterable by `"whitelisted"` (`true`) or `"unprotected"` (`false`).

### 4. Toolbar Faceted Filters & Pagination Page Size (`components/audit-table/data-table.tsx`)
- Initialize `pagination` state with `{ pageIndex: 0, pageSize: 25 }`.
- In the toolbar (`components/audit-table/data-table.tsx`):
  - Search `<Input>` (`globalFilter`)
  - Media Type `<Tabs>` (`All | Movie | TV`)
  - Requester `<Select>` (`all` + sorted unique `item.requester.username` values)
  - Watch State `<Select>` (`all`, `completed`, `in_progress`, `unplayed`)
  - Whitelist `<Select>` (`all`, `whitelisted`, `unprotected`)
  - Conditional `Reset` `<Button variant="ghost" size="xs">` when `globalFilter !== ""` or any toolbar column filter is active.
- In the pagination bar:
  - Add `<Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>` with options `10`, `25`, `50`, `100`.

## Testing Decisions

- **Good Test Standard**: Test observable behavior at the `auditMedia` seam and `DataTable` / `columns` seam rather than internal component state.
- **Seams (`lib/audit.ts` & `components/audit-table/data-table.tsx`)**:
  1. Verify `auditMedia()` skips `seerr.getMediaDetails()` when `jellyfinItem.Name` is present, and populates `sizeBytes` from `jellyfinItem.MediaSources[0].Size` or `jellyfinItem.Size`.
  2. Verify `invalidateAuditCache()` clears the cached report so subsequent `auditMedia()` calls fetch fresh data.
  3. Verify `DataTable` renders with default page size `25`, renders the `Size`, `Requested`, and `Household` columns, and sorts `daysSinceLastPlayed: null` (`"Never"`) as `Infinity`.
- **Prior Art**: `tests/jellyfin-filter-and-tv-hierarchy.test.ts` and `tests/audit-enrichment.test.ts`.

## Out of Scope

- Server-side SQL/API pagination (all items remain client-side paginated in TanStack Table after bulk fetch).
- Persisting filter/sort preferences in SQLite.

## Further Notes

- Passing `seerrClient` or `jellyfinClient` in `auditMedia(options)` automatically bypasses the 60s report cache so all existing unit tests remain isolated and deterministic.
