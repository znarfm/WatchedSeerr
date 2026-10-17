# Spec: Clickable Metric Cards & Status Filter Consolidation

## Problem Statement

On the main Audit Queue dashboard (`app/page.tsx` and `components/audit-table/data-table.tsx`), summary metrics (`Total Audited`, `Safe to Purge`, `Active Conflicts`, `Ghost Requests`) are rendered as static, non-interactive cards in the server component while a duplicate set of status filter tabs (`All`, `Safe`, `Conflict`, `Ghost`) sits directly below them inside the table toolbar. This creates two issues for the administrator:
1. Redundant UI controls that repeat the exact same four retention categories (`All`/`Total`, `Safe`, `Conflict`, `Ghost`).
2. Static server-rendered metric counts that do not reactively decrement when an administrator purges media items from the client-side table.

## Solution

Consolidate retention status filtering directly into the four metric summary cards and remove the duplicate status filter tabs from the toolbar:
1. Move the four metric cards from `app/page.tsx` into `components/audit-table/data-table.tsx` above the `<Separator />` and search/media-type toolbar.
2. Compute metric card counts (`total`, `safe`, `conflict`, `ghost`) directly from the client `data` state in `DataTable`, so counts immediately update when items are purged while remaining unaffected by search queries or `Movie`/`TV` media type filters.
3. Make each metric card an interactive button (`aria-pressed`) that filters the TanStack table's `status` column:
   - Clicking `Total Audited` clears the status filter (`all`).
   - Clicking `Safe to Purge`, `Active Conflicts`, or `Ghost Requests` filters the table to that status, or toggles back to `all` (`Total Audited`) when clicking an already-active status card.
4. Highlight the currently active metric card with a stronger semantic ring and background tint while keeping all cards at full opacity.
5. Remove the redundant `All | Safe | Conflict | Ghost` `<Tabs>` from the `DataTable` toolbar while retaining the search input and `All | Movie | TV` media type `<Tabs>`.

## User Stories

1. As an administrator, I want to click the "Safe to Purge" metric card, so that the audit table immediately filters to only media items safe for deletion.
2. As an administrator, I want to click the "Active Conflicts" metric card, so that the audit table immediately filters to only media items currently being watched or with playback conflicts.
3. As an administrator, I want to click the "Ghost Requests" metric card, so that the audit table immediately filters to unplayed requests exceeding the inactivity threshold.
4. As an administrator, I want to click the "Total Audited" metric card, so that any active retention status filter is cleared and all audited media items are shown.
5. As an administrator, I want clicking an already-active status metric card (`Safe to Purge`, `Active Conflicts`, or `Ghost Requests`) a second time to toggle the status filter off back to `Total Audited`, so that I can quickly reset my view without moving my cursor to the first card.
6. As an administrator, I want the active metric card to display a distinct semantic ring and background highlight (`ring-primary`, `ring-emerald-500`, `ring-amber-500`, or `ring-rose-500` with `bg-*/15`), so that I can immediately tell which status filter is currently applied.
7. As an administrator, I want inactive metric cards to remain at full opacity, so that summary numbers across all categories stay legible at a glance regardless of the active filter.
8. As an administrator, I want the duplicate `All / Safe / Conflict / Ghost` status tabs removed from the table toolbar, so that the interface has a single, unambiguous control for status filtering.
9. As an administrator, I want the `All / Movie / TV` media type tabs and title search input to remain in the toolbar, so that I can combine media-type and title filtering with the clickable status metric cards.
10. As an administrator, I want the counts on the four metric cards to automatically decrement when I confirm a media purge, so that the dashboard summary stays accurate without requiring a full page reload.
11. As an administrator, I want the counts on the four metric cards to reflect the total client dataset even when I type a search query or switch between `Movie` and `TV` tabs, so that global library health metrics remain stable while I drill down.
12. As a keyboard/screen-reader user, I want each metric card to be focusable, operable via `Enter`/`Space`, and expose `aria-pressed`, so that filtering by metric card is fully accessible.

## Implementation Decisions

### 1. Server Page Simplification (`app/page.tsx`)
Remove the static metric cards block and `<Separator />` from `app/page.tsx`, delegating both the metric summary bar and table rendering to `<DataTable initialData={report.items} />`.

### 2. Pure Helper Exports (`components/audit-table/data-table.tsx`)
Export two pure functions from `components/audit-table/data-table.tsx` to encapsulate count derivation and card toggle state transitions:

```ts
export interface MetricCounts {
  total: number
  safe: number
  conflict: number
  ghost: number
}

export function computeMetricCounts(items: AuditMediaItem[]): MetricCounts {
  let safe = 0
  let conflict = 0
  let ghost = 0
  for (const item of items) {
    if (item.conflictStatus === "safe") safe++
    else if (item.conflictStatus === "conflict") conflict++
    else if (item.conflictStatus === "ghost") ghost++
  }
  return { total: items.length, safe, conflict, ghost }
}

export function resolveStatusCardClick(
  currentFilter: ConflictStatus | "all",
  clickedCard: ConflictStatus | "all"
): ConflictStatus | undefined {
  if (clickedCard === "all") return undefined
  return currentFilter === clickedCard ? undefined : clickedCard
}
```

### 3. Clickable Metric Cards & Active Styling (`components/audit-table/data-table.tsx`)
Render the 4-card grid at the top of `DataTable` (followed by `<Separator />`):
- Each card is rendered as a `<button type="button" aria-pressed={isActive} onClick={...} className="text-left cursor-pointer focus-visible:outline-none">` wrapping `<Card>` (or applying button semantics directly).
- Active vs default visual classes per card:
  - `Total Audited` (`"all"`):
    - Default: `bg-muted/10 hover:bg-muted/20 transition-colors`
    - Active (`currentStatusFilter === "all"`): `ring-1 ring-primary bg-muted/25`
  - `Safe to Purge` (`"safe"`):
    - Default: `border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors`
    - Active (`currentStatusFilter === "safe"`): `ring-1 ring-emerald-500 bg-emerald-500/15`
  - `Active Conflicts` (`"conflict"`):
    - Default: `border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors`
    - Active (`currentStatusFilter === "conflict"`): `ring-1 ring-amber-500 bg-amber-500/15`
  - `Ghost Requests` (`"ghost"`):
    - Default: `border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors`
    - Active (`currentStatusFilter === "ghost"`): `ring-1 ring-rose-500 bg-rose-500/15`

### 4. Toolbar Filter Cleanup (`components/audit-table/data-table.tsx`)
Delete the second `<Tabs>` block (`value={currentStatusFilter}`) from the search/filter bar in `components/audit-table/data-table.tsx`, leaving the search `<Input>` and the `mediaType` `<Tabs>` (`All | Movie | TV`).

## Testing Decisions

- **Good Test Standard**: Test external behavior at the `DataTable` seam rather than internal React state hooks or CSS implementation details.
- **Single Seam (`components/audit-table/data-table.tsx`)**:
  1. Verify `computeMetricCounts(items)` accurately tallies `total`, `safe`, `conflict`, and `ghost` items and reflects item removal.
  2. Verify `resolveStatusCardClick(current, clicked)` selects a status filter, clears back to `undefined` when clicking the already-active status card, and clears to `undefined` when clicking `"all"`.
  3. Verify SSR output via `renderToStaticMarkup(<DataTable initialData={mockItems} />)` renders the four interactive metric card buttons (`aria-pressed`) with their computed counts and omits the old status filter `<Tabs>` while preserving the `Movie`/`TV` media type tabs.
- **Prior Art**: `tests/jellyfin-filter-and-tv-hierarchy.test.ts` and `tests/audit-enrichment.test.ts` executed via `./node_modules/.bin/tsx --test tests/*.test.ts`.

## Out of Scope

- Adding a 5th metric card for whitelisted items.
- Modifying the `/matrix` page (`app/matrix/page.tsx`).
- Changing how `conflictStatus` (`safe`, `conflict`, `ghost`) is calculated on the backend (`lib/audit.ts`).

## Further Notes

- Pagination automatically resets to page 1 when `columnFilters` change via TanStack Table's built-in `getFilteredRowModel` / `onColumnFiltersChange` pipeline.
