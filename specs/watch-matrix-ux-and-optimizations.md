# Spec: Watch Matrix Covers, Toolbar, Per-User Sorting & Inspection Sheet

## Problem Statement

The Watch Matrix page (`app/matrix/page.tsx`) is currently a static, unpaginated Server Component table with several usability and performance shortcomings:
1. **Text-Only Media Column**: Rows only display plain title text and media type without cover poster thumbnails, release years, whitelist indicators, or retention status badges (`Safe`, `Conflict`, `Ghost`), and the media column scrolls off-screen horizontally on narrow viewports.
2. **Unpaginated Render without Search or Filters**: Every audited item (100+ rows) is rendered into the DOM simultaneously with no search bar, media-type toggle, requester filter, or retention status filter. Adding cover posters without pagination would trigger 100+ concurrent poster image requests on initial page load.
3. **Static User Headers without Summary Stats or Sorting**: User columns only show an avatar and name, offering no summary of how many items each user requested vs watched, and no way to sort rows by a specific user's watch progress.
4. **Non-Interactive Rows & Native Title Tooltips**: Cells rely on native browser `title` attributes instead of accessible shadcn `<Tooltip>` popovers, and clicking a row does nothing—forcing administrators to switch back to the Audit Queue and re-search a title just to inspect its details, whitelist it, or purge it.

## Solution

Refactor the Watch Matrix view into a rich, paginated client component (`components/matrix-table/watch-matrix.tsx`) rendered by `app/matrix/page.tsx`:
1. **Sticky Rich Media Column**: Render a `sticky left-0 z-10 bg-background` media column containing the `size-9` cover poster thumbnail (`/api/proxy/poster?jellyfinItemId=...&tag=...`), title, release year, media type, requester name, whitelist tag, and retention status badge (`Safe`, `Conflict`, `Ghost`), with clickable header sorting (`↑`/`↓`).
2. **User Column Headers with Household Stats & Progress Sorting**: Deduplicate household users by canonical `userId` (and Seerr display name), display `X req • Y watched` summary stats beneath each user's avatar/name, and allow clicking any user header to sort the matrix by that user's `progressPercent` (`asc`/`desc`).
3. **Toolbar Controls & Pagination (`25` Default)**: Add Title search `<Input>`, `All | Movie | TV` `<Tabs>`, Requester `<Select>`, Retention Status `<Select>` (`All / Safe / Conflict / Ghost`), a `Reset` button when filters are active, and pagination (`25` rows default with `10 / 25 / 50 / 100` selector) so only visible rows request poster thumbnails.
4. **Rich Cells, Shadcn Tooltips & Slide-Over Inspection Sheet**: Display `REQ` badges on requester cells, wrap each cell in a shadcn `<Tooltip>` showing last-played date and play count, and open the media detail `<Sheet>` (with hero poster, overview, size/quality, household breakdown, and Whitelist/Purge actions) when clicking any matrix row.

## User Stories

1. As an administrator, I want to see cover poster thumbnails, release years, and retention status badges (`Safe`, `Conflict`, `Ghost`) in the first column of the Watch Matrix, so that I can visually recognize media and its purge eligibility without leaving the matrix.
2. As an administrator, I want the `Requested Media` column to remain sticky on the left when scrolling horizontally across many household users, so that I never lose track of which movie or show a row corresponds to.
3. As an administrator, I want each household user's column header to display their total requests and total watched items (`X req • Y watched`), so that I can see at a glance who watches what they request.
4. As an administrator, I want to click any user's column header to sort the matrix by that user's watch progress (`asc` or `desc`), so that I can quickly see everything a specific person has completed or is currently watching.
5. As an administrator, I want to click the `Requested Media` column header to sort the matrix alphabetically by title, so that I can browse the matrix in title order.
6. As an administrator, I want to filter the Watch Matrix by title search, media type (`All`, `Movie`, `TV`), requester, and retention status (`All`, `Safe`, `Conflict`, `Ghost`), so that I can narrow down the matrix just like the Audit Queue.
7. As an administrator, I want a `Reset` button to appear whenever any search or filter is active on the Watch Matrix, so that I can return to the full matrix in one click.
8. As an administrator, I want the Watch Matrix to paginate at `25` rows by default with a `10 / 25 / 50 / 100` page-size selector, so that only the current page's poster images are fetched at once.
9. As an administrator, I want hovering a user's playback cell in the matrix to show a styled shadcn `<Tooltip>` with `Last played` date, `Play count`, and `[Requester]` role, so that playback metadata is easy to read.
10. As an administrator, I want clicking any row in the Watch Matrix to open the slide-over inspection `<Sheet>` with full media details and `Whitelist` / `Purge` buttons, so that I can act on media directly from the Watch Matrix.

## Implementation Decisions

### 1. Client Component Extraction & Pure Helpers (`components/matrix-table/watch-matrix.tsx`)
Extract the interactive matrix table into `components/matrix-table/watch-matrix.tsx` and export two pure helper functions for deterministic testing:

```ts
export interface MatrixUserColumn {
  key: string // userId or lowercase username
  userId?: string
  username: string
  avatarUrl?: string
  requestedCount: number
  watchedCount: number
}

export function deriveMatrixUsers(items: AuditMediaItem[]): MatrixUserColumn[] {
  const map = new Map<string, MatrixUserColumn>()

  const ensureUser = (userId: string | undefined, username: string, avatarUrl?: string) => {
    const key = (userId && userId !== "unknown" ? userId : username).toLowerCase()
    let entry = map.get(key)
    if (!entry) {
      entry = {
        key,
        userId: userId && userId !== "unknown" ? userId : undefined,
        username,
        avatarUrl,
        requestedCount: 0,
        watchedCount: 0,
      }
      map.set(key, entry)
    } else if (!entry.avatarUrl && avatarUrl) {
      entry.avatarUrl = avatarUrl
    }
    return entry
  }

  for (const item of items) {
    const reqEntry = ensureUser(
      item.requester.matchedJellyfinUserId || item.requesterState.userId,
      item.requester.username,
      item.requester.requesterAvatarUrl || item.requesterState.avatarUrl
    )
    reqEntry.requestedCount++
    if (item.requesterState.status === "completed") {
      reqEntry.watchedCount++
    }

    for (const h of item.householdStates) {
      const hEntry = ensureUser(h.userId, h.username, h.avatarUrl)
      if (h.status === "completed") {
        hEntry.watchedCount++
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username))
}

export function getUserCellState(
  item: AuditMediaItem,
  col: MatrixUserColumn
): { state?: UserPlaybackState; isRequester: boolean } {
  const reqId = (item.requester.matchedJellyfinUserId || item.requesterState.userId || "").toLowerCase()
  const isRequester =
    (!!col.userId && reqId === col.userId.toLowerCase()) ||
    item.requester.username.toLowerCase() === col.username.toLowerCase()

  if (isRequester) {
    return { state: item.requesterState, isRequester: true }
  }

  const state = item.householdStates.find(
    (h) =>
      (!!col.userId && h.userId.toLowerCase() === col.userId.toLowerCase()) ||
      h.username.toLowerCase() === col.username.toLowerCase()
  )
  return { state, isRequester: false }
}
```

### 2. Sorting, Filtering & Pagination State (`components/matrix-table/watch-matrix.tsx`)
- Maintain client state:
  - `data: AuditMediaItem[]` (mutated optimistically on Whitelist toggle or Purge confirmation, identical to `DataTable`)
  - `search: string`
  - `mediaTypeFilter: "all" | "movie" | "tv"`
  - `requesterFilter: string` (`"all"` or requester username)
  - `statusFilter: "all" | ConflictStatus`
  - `sortField: "default" | "title" | string` (where `string` is a `MatrixUserColumn.key`)
  - `sortDir: "asc" | "desc"`
  - `pageIndex: number` (`0`) and `pageSize: number` (`25`, selectable `10 | 25 | 50 | 100`)
  - `selectedItem: AuditMediaItem | null` and `deleteCandidate: AuditMediaItem | null`

### 3. Sticky Media Cell & User Cells (`components/matrix-table/watch-matrix.tsx`)
- `TableHead` and `TableCell` for `Requested Media` use `sticky left-0 z-10 bg-background border-r border-border min-w-[260px]`.
- Media cell renders `size-9` thumbnail (`loading="lazy"`), title, year, `mediaType`, `Req: {username}`, and compact retention badge (`Safe` / `Conflict` / `Ghost`).
- User cell renders progress percentage, status label (`completed`, `in-prog`, `unplayed`), and a `REQ` badge on the requester's cell, wrapped in `<Tooltip>` / `<TooltipTrigger>` / `<TooltipContent>` displaying last-played date and play count.

### 4. Server Page Integration (`app/matrix/page.tsx`)
- `app/matrix/page.tsx` calls `auditMedia()` (which hits the 60s server cache when navigating from `/`) and renders `<WatchMatrix initialData={report.items} />`.

## Testing Decisions

- **Good Test Standard**: Test external behavior at the `WatchMatrix` / `deriveMatrixUsers` seam rather than internal React hook state.
- **Single Seam (`components/matrix-table/watch-matrix.tsx`)**:
  1. Verify `deriveMatrixUsers(items)` reconciles users by `userId`/username into unique columns and accurately counts `requestedCount` and `watchedCount`.
  2. Verify `getUserCellState(item, col)` returns `item.requesterState` with `isRequester: true` for the requester column (even if matched by `userId`) and returns the matching `householdStates` entry for non-requesters.
  3. Verify `renderToStaticMarkup(<WatchMatrix initialData={mockItems} />)` renders cover poster `<img>` tags, user header stats (`req •`), search/filter controls, and default `25` page size pagination.
- **Prior Art**: `tests/jellyfin-filter-and-tv-hierarchy.test.ts` and `tests/audit-enrichment.test.ts`.

## Out of Scope

- Episode-level sub-row expansion inside the 2D Watch Matrix grid (episode expansion remains on the Audit Queue table).
- Exporting the Watch Matrix to CSV.

## Further Notes

- Sharing the slide-over inspection `<Sheet>` and purge `<Dialog>` pattern between `DataTable` and `WatchMatrix` gives administrators a consistent workflow across both views.
