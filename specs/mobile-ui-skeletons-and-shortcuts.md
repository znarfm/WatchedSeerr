# Spec: Mobile-Friendly Responsive UI, Project-Wide Skeleton Loaders, Keyboard Shortcuts & Toast Feedback

## Problem Statement

While WatchedSeerr provides rich desktop table and matrix views, several UI/UX gaps remain across mobile viewports, loading states, keyboard navigation, and action feedback:
1. **Unresponsive Mobile Layout (`<640px` / `<768px`)**:
   - The top header (`px-6 py-3`) and subtitle crowd narrow viewports alongside navigation buttons.
   - The metric cards stack into a tall 1-column list (`grid-cols-1`) on mobile, pushing the toolbar and table below the fold.
   - The toolbar filter controls (`<Input>`, `<Tabs>`, and multiple `<Select>` dropdowns) wrap awkwardly on small screens.
   - The Audit Queue table renders all 10 columns simultaneously on mobile viewports, cramping core columns (`Media`, `Requester`, `Progress`, `Inactive`, `Status`) alongside secondary metadata (`Household`, `Size`, `Requested`) that is already accessible inside `<MediaDetailSheet>`.
2. **Missing Skeleton Loaders Across Routes & Async Transitions**:
   - Navigating between `/` (Audit Queue) and `/matrix` (Watch Matrix) or loading initial SSR data has no `app/loading.tsx` or `app/matrix/loading.tsx` skeleton fallback.
   - Clicking `Refresh` to invalidate the audit cache or expanding a TV series row (`loadingEpisodes[item.id]`) provides no `<Skeleton>` row placeholders, and poster thumbnails lack an `animate-pulse` placeholder shimmer while loading.
3. **No Keyboard Shortcuts or `<Kbd>` Hints**:
   - Administrators cannot press `Ctrl+K` / `⌘K` or `/` to immediately focus the search bar, `Esc` to clear/blur search, or `Alt+R` to trigger a refresh, and there are no `<Kbd>` visual hints in the UI.
4. **Silent Server Actions**:
   - Toggling a media item's whitelist status, purging a media item or episode, or refreshing the audit cache completes without any `<Toast>` notification confirming success or reporting errors.

## Solution

1. **Mount `@base-ui/react/toast` `<Toaster>` & Action Notifications**:
   - Wrap `children` in `<Toaster>` from `@/components/ui/toast` inside `app/layout.tsx`.
   - Trigger `toast.add({ title, description, type })` notifications on Whitelist toggle (`"Added to Whitelist"` / `"Removed from Whitelist"`), Media/Episode Purge (`"Media Purged"` / `"Purge Failed"`), and Audit Cache Refresh (`"Audit Refreshed"`).
2. **Keyboard Shortcuts & `<Kbd>` Hints**:
   - Add global keyboard listener in `DataTable` (`components/audit-table/data-table.tsx`) and `WatchMatrix` (`components/matrix-table/watch-matrix.tsx`):
     - `Ctrl+K` / `⌘K` or `/` (when not typing in an input/textarea/select) focuses the search `<Input>`.
     - `Escape` inside the search `<Input>` clears `globalFilter` (if non-empty) and blurs the input.
     - `Alt+R` triggers the `Refresh` transition.
   - Render a right-aligned `<KbdGroup><Kbd>Ctrl</Kbd><Kbd>K</Kbd></KbdGroup>` badge inside the search input wrapper (or `<Kbd>Esc</Kbd>` when focused/populated), and include `<KbdGroup><Kbd>Alt</Kbd><Kbd>R</Kbd></KbdGroup>` inside the `Refresh` button's `<TooltipContent>`.
3. **Full `<Skeleton>` Loader Coverage**:
   - Create `app/loading.tsx` (Audit Queue route skeleton: header, 5 metric card skeletons, toolbar skeleton, and 10 table row skeletons with poster/title/avatar/progress/badge `<Skeleton>` blocks).
   - Create `app/matrix/loading.tsx` (Watch Matrix route skeleton: header, toolbar skeleton, and matrix table skeleton with sticky media column + user header avatar/stat skeletons + cell skeletons).
   - In `DataTable` and `WatchMatrix`, render `<Skeleton>` table rows when `isRefreshing` is active during a manual `Refresh`.
   - In `DataTable`, render 3 `<Skeleton>` sub-rows immediately beneath a TV series parent row while `loadingEpisodes[row.original.id]` is `true`.
4. **Mobile-Friendly Responsive Layout**:
   - **Header & Main Padding**: Use `px-4 py-2.5 sm:px-6 sm:py-3` on `<header>` (hiding the tagline `<p>` on `<sm` viewports via `hidden sm:block`) and `p-3 sm:p-6` on `<main>`.
   - **Metric Cards Grid**: Use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4`, with the first card (`Total Audited`) using `col-span-2 sm:col-span-1` so all 5 cards fit compactly on mobile screens.
   - **Responsive Toolbar**: Make the search input container `w-full sm:w-64`, and group the filter `<Select>` controls so they wrap cleanly into a 2-column grid (`grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto`) on mobile.
   - **Responsive Table Columns**: Mark secondary columns (`household`, `size`, `requested`) with `hidden md:table-cell` in `columns.tsx` `meta.className` so mobile/tablet viewports focus on `Media`, `Requester`, `Progress`, `Inactive`, and `Status`, while clicking any row opens `<MediaDetailSheet>` (`w-full sm:max-w-md`) with full details.

## User Stories

1. As a mobile administrator (`<640px` viewport), I want the top navigation header to fit on a single clean row without wrapping or overflowing, so that switching between `Audit Queue` and `Watch Matrix` is effortless on a phone.
2. As a mobile administrator, I want the 5 summary metric cards to arrange in a compact 2-column grid (`Total Audited` spanning full width, followed by 2x2 status cards) with reduced padding on small screens, so that I can see all counts and still reach the search bar without scrolling past 5 stacked cards.
3. As a mobile administrator, I want the search bar to span full width (`w-full`) and filter dropdowns to arrange in a clean 2-column grid on mobile viewports, so that touch targets are wide and aligned.
4. As a mobile administrator, I want secondary Audit Queue columns (`Household`, `Size`, `Requested`) to hide on `<md` (`<768px`) screens while keeping `Media`, `Requester`, `Progress`, `Inactive`, and `Status` visible, so that the table remains readable on narrow screens while tapping any row opens the full `<MediaDetailSheet>`.
5. As an administrator, I want to see a structured skeleton page (`app/loading.tsx` and `app/matrix/loading.tsx`) while Next.js streams the initial server-rendered Audit Queue or Watch Matrix, so that the app feels fast and layout shift is eliminated.
6. As an administrator, I want clicking the `Refresh` button in the Audit Queue or Watch Matrix to display `<Skeleton>` rows in the table body while fresh data is being fetched, so that I have clear visual feedback that the table is reloading.
7. As an administrator, I want expanding a TV series row in the Audit Queue to display `<Skeleton>` episode sub-rows while `getSeriesEpisodesAction` is in flight, so that episode loading feels responsive in-place.
8. As an administrator, I want to press `Ctrl+K` (or `⌘K` on macOS, or `/`) from anywhere on the page to immediately focus and select the title search `<Input>`, so that I can filter media without reaching for the mouse.
9. As an administrator, I want to see a `<Kbd>Ctrl K</Kbd>` hint inside the search input (and `<Kbd>Esc</Kbd>` when the search input has text or focus), and press `Escape` to clear the search query and blur the input.
10. As an administrator, I want to press `Alt+R` to trigger an audit refresh and see `<Kbd>Alt R</Kbd>` inside the `Refresh` button tooltip.
11. As an administrator, I want toast notifications (`@base-ui/react/toast` via `components/ui/toast.tsx`) to appear in the bottom-right corner whenever I whitelist/unwhitelist an item, purge media or an episode, or refresh the audit data, so that every action gives immediate confirmation or error details.

## Implementation Decisions

### 1. Root Layout `<Toaster>` Integration (`app/layout.tsx`)
Wrap the application inside `<Toaster>` from `@/components/ui/toast`:
```tsx
import { Toaster } from "@/components/ui/toast"

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased font-sans">
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```
Note: Also guard `toast.add(...)` calls in client components so SSR or unit tests without a DOM portal never throw.

### 2. Route-Level Skeletons (`app/loading.tsx` & `app/matrix/loading.tsx`)
- **`app/loading.tsx`**:
  - Renders the top `<header>` shell, a 5-card metric skeleton grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4`), a toolbar skeleton (`<Skeleton className="h-8 w-full sm:w-64" />`, tabs/select skeletons), and a 10-row `<Table>` skeleton matching the Audit Queue columns.
- **`app/matrix/loading.tsx`**:
  - Renders the top `<header>` shell, toolbar skeleton, and a 10-row `<Table>` skeleton with a sticky left media column (`<Skeleton className="size-9" />` + title lines) and 4 user column header/cell skeletons.

### 3. Keyboard Shortcuts Helper & Search `<Kbd>` UI (`components/audit-table/data-table.tsx` & `components/matrix-table/watch-matrix.tsx`)
Export a pure helper `isSearchShortcut(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; targetTagName?: string })`:
```ts
export function isSearchShortcut(e: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  targetTagName?: string
}): boolean {
  const tag = (e.targetTagName || "").toUpperCase()
  const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
    return true
  }
  if (!isEditable && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "/") {
    return true
  }
  return false
}
```
- Attach a `window` `keydown` listener in both `DataTable` and `WatchMatrix`:
  - When `isSearchShortcut` matches: `e.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select()`.
  - When `e.altKey && e.key.toLowerCase() === "r"`: `e.preventDefault(); handleRefresh()`.
- Inside the search `<Input>` container (`relative w-full sm:w-64`):
  - Render `<Input ref={searchInputRef} ... className="pl-8 pr-16 h-8 text-xs" onKeyDown={(e) => { if (e.key === "Escape") { setGlobalFilter(""); e.currentTarget.blur() } }} />`.
  - Render `<div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">` with `<Kbd>Esc</Kbd>` when `globalFilter` is non-empty, or `<KbdGroup><Kbd className="text-[10px] h-4 px-1">Ctrl</Kbd><Kbd className="text-[10px] h-4 px-1">K</Kbd></KbdGroup>` when empty.
- Add a `Refresh` button with `<Tooltip>` + `<KbdGroup><Kbd>Alt</Kbd><Kbd>R</Kbd></KbdGroup>` to both `DataTable` and `WatchMatrix`.

### 4. In-Place Skeletons (`isRefreshing` & `loadingEpisodes`)
- Track `const [isRefreshing, setIsRefreshing] = React.useState(false)` when `handleRefresh` runs:
  - While `isRefreshing` is `true`, render 8 `<TableRow>` skeleton placeholders inside `<TableBody>` in both `DataTable` and `WatchMatrix`.
- In `DataTable`, when `loadingEpisodes[row.original.id]` is `true` for a parent TV row, render 3 skeleton sub-rows (`<TableRow className="bg-muted/10">`) directly below that parent row with `<Skeleton>` bars for episode title, progress, and status.

### 5. Mobile-Responsive Column Visibility & Layout
- In `components/audit-table/columns.tsx`:
  - `household`: `meta: { className: "w-28 hidden md:table-cell" }`
  - `size`: `meta: { className: "w-36 whitespace-nowrap hidden md:table-cell" }`
  - `requested`: `meta: { className: "w-28 whitespace-nowrap hidden lg:table-cell" }`
  - `inactive`: `meta: { className: "w-24 whitespace-nowrap hidden sm:table-cell" }`
- In `app/page.tsx` and `app/matrix/page.tsx`:
  - Update `<header className="border-b border-border bg-muted/20 px-4 py-2.5 sm:px-6 sm:py-3">` and `<main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">`.
  - Hide header subtitle on mobile (`className="text-[11px] text-muted-foreground hidden sm:block"`).

### 6. Toast Notifications on User Actions
Call `toast.add({ ... })` from `@/components/ui/toast` on:
- **Whitelist Toggle**:
  - Success: `toast.add({ title: res.isWhitelisted ? "Media Whitelisted" : "Removed from Whitelist", description: item.title, type: "success" })`
  - Error: `toast.add({ title: "Whitelist Update Failed", description: res.error, type: "error" })`
- **Media / Episode Purge**:
  - Success: `toast.add({ title: "Media Purged", description: `${item.title} was removed.`, type: "success" })`
  - Error: `toast.add({ title: "Purge Failed", description: res.error, type: "error" })`
- **Audit Refresh**:
  - Success: `toast.add({ title: "Audit Refreshed", description: "Latest playback and request states loaded.", type: "info" })`

## Testing Decisions

- **What makes a good test**: Test observable behavior and rendered output via pure helpers (`isSearchShortcut`) and SSR component rendering (`renderToStaticMarkup` for `Loading`, `MatrixLoading`, `DataTable`, and `WatchMatrix`).
- **Modules to test**:
  1. `app/loading.tsx` and `app/matrix/loading.tsx` (verify `data-slot="skeleton"` placeholders render without error).
  2. `components/audit-table/data-table.tsx` and `components/matrix-table/watch-matrix.tsx` (`isSearchShortcut` behavior for `Ctrl+K`, `⌘K`, `/`, and ignored `/` inside `<INPUT>`, plus `<Kbd>` shortcut hint rendering and responsive `hidden md:table-cell` classes).
- **Prior art**: Existing SSR markup and pure logic tests in `tests/clickable-metric-cards.test.ts` and `tests/watch-matrix.test.ts`.

## Out of Scope

- Installing additional third-party packages (`skeleton`, `kbd`, and `toast` are already installed in `components/ui/`).
- Replacing the `<Table>` with a separate card-only component tree on mobile (responsive column hiding + horizontal overflow scroll + `<MediaDetailSheet>` covers mobile inspection cleanly).

## Further Notes

- `@base-ui/react/toast`'s `toast.add()` can be called directly from any client event handler since `toast` is a singleton `ToastManager` instance exported by `components/ui/toast.tsx` and passed to `<Toaster toastManager={toast}>` in `app/layout.tsx`.
