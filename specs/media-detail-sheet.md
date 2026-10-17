# Spec: Shared `<MediaDetailSheet>` with Pinned Header/Footer, Scrollbar Gutter Fix & External Links

## Problem Statement

The media inspection `<Sheet>` used in both the Audit Queue (`components/audit-table/data-table.tsx`) and Watch Matrix (`components/matrix-table/watch-matrix.tsx`) currently suffers from several layout, styling, and maintainability issues:
1. **Right-Edge Scrollbar Gutter Gap**: When `@base-ui/react/dialog` (`useScrollLock`) locks page scrolling on browsers supporting `scrollbar-gutter: stable`, it sets inline `html.style.scrollbarGutter = "stable"` while locking `body` overflow. In CSS, `scrollbar-gutter: stable` on `<html>` reserves a `~15px` vertical strip outside the layout viewport for `position: fixed; right: 0` elements, leaving an unsightly gap to the right of the open `<Sheet>` where the webpage scrollbar used to be.
2. **Broken Sheet Padding & Narrow Width Constraint**:
   - In `components/ui/sheet.tsx`, `SheetContent` defines `data-[side=right]:sm:max-w-sm` (`384px`). Because of the `data-[side=right]:` modifier prefix, passing `sm:max-w-md` (`448px`) in `className` is not deduplicated by `twMerge` and loses by CSS specificity.
   - In `components/audit-table/data-table.tsx`, `SheetHeader` has `p-4` while the body `<div className="mt-6 space-y-5">` has zero horizontal padding (`px-0`), causing the overview card, status banner, household cards, and action buttons to sit flush against the left and right borders of the drawer.
   - In `components/matrix-table/watch-matrix.tsx`, `SheetContent` applies `p-6` while `SheetHeader` applies `p-4`, creating mismatched double padding (`40px` inset) on the header, and neither table uses `<SheetFooter>`.
3. **Unpinned Header & Footer**: The entire `SheetContent` scrolls (`overflow-y-auto`), scrolling the media header and bottom action buttons out of view instead of keeping `SheetHeader` and `SheetFooter` pinned (`shrink-0`) around a scrollable middle body (`flex-1 overflow-y-auto`).
4. **Missing External Service Hyperlinks**: Administrators inspecting a movie or TV series have no quick links from the sheet to open the item in **IMDb**, **Letterboxd**, **Radarr** / **Sonarr**, **Jellyfin**, or **Seerr**.
5. **Duplicated Sheet & Purge Dialog Markup**: ~200 lines of `<Sheet>` and Confirm Purge `<Dialog>` JSX and action state are duplicated across `DataTable` and `WatchMatrix`.

## Solution

1. **Fix Right-Edge Scrollbar Gap & Sheet Width**:
   - Add `html { scrollbar-gutter: auto !important; }` in `app/globals.css` so `@base-ui`'s scroll lock never reserves an external gutter to the right of `fixed right-0` drawers.
   - Update `SheetContent` in `components/ui/sheet.tsx` so `data-[side=right]:sm:max-w-md` (`448px`) is the default right-drawer max width.
2. **Enrich `AuditMediaItem` with External Links (`externalLinks` & `imdbId`)**:
   - Extend `SeerrMediaInfo` (`imdbId`, `externalServiceSlug`, `serviceUrl`) and `AuditMediaItem` (`imdbId`, `externalLinks`) in `types/index.ts`.
   - In `lib/audit.ts`, construct `externalLinks` (`imdb`, `letterboxd`, `arr`, `jellyfin`, `seerr`) for every audited item using `jellyfinItem.ProviderIds`, `req.media`, and configured base URLs (`JELLYFIN_URL`, `SEERR_URL`, `RADARR_URL`, `SONARR_URL`).
3. **Extract Shared `<MediaDetailSheet>` (`components/media-detail-sheet.tsx`)**:
   - Implement a flex-column `<SheetContent className="w-full sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col">`:
     - **Pinned `<SheetHeader>`** (`shrink-0 border-b border-border p-5 pr-10 text-left bg-popover`): poster thumbnail (`w-20 h-28`), title, `year • mediaType • sizeGb`, quality + genre badges, and a row of external service link pills (**IMDb**, **Letterboxd**, **Radarr**/**Sonarr**, **Jellyfin**, **Seerr**).
     - **Scrollable Body** (`flex-1 overflow-y-auto p-5 space-y-5`):
       - **Compact Metadata Strip**: 3-column grid displaying **Requested** date, **Inactive** (`Xd` / `Never`), and **Protection** (`Whitelisted` / `Unprotected`).
       - **Retention Status Banner**: Semantic emerald/amber/rose box with status and `conflictReason`.
       - **Synopsis Overview**: Clean bordered card when `overview` is present.
       - **Household Playback Breakdown**: Requester card (`border-primary/40`) and household member cards with safe avatar rendering, progress bar, status, play count, and last played date.
     - **Pinned `<SheetFooter>`** (`shrink-0 border-t border-border p-4 bg-popover flex-row items-center justify-between gap-2`): `Whitelist Media` / `Remove Whitelist` (`variant="outline"`) and `Purge Media` (`variant="destructive"`).
   - Encapsulate `toggleWhitelistAction`, `deleteMediaAction`, and the Confirm Purge `<Dialog>` inside `<MediaDetailSheet>` (also supporting external `deleteCandidate` trigger from `DataTable` row action menus) and notify parents via `onItemUpdated` / `onItemDeleted`.

## User Stories

1. As an administrator, I want the media detail `<Sheet>` to sit flush against the right edge of the browser window without a leftover scrollbar gap on the right.
2. As an administrator, I want the `<SheetHeader>` (poster, title, badges, external links) and `<SheetFooter>` (`Whitelist Media` and `Purge Media` buttons) to remain pinned at the top and bottom of the drawer while the middle body scrolls smoothly.
3. As an administrator, I want consistent horizontal and vertical spacing throughout the `<Sheet>` so no cards or text touch the raw edges of the drawer or collide with the top-right close (`X`) button.
4. As an administrator, I want clickable external links in the `<Sheet>` for **IMDb**, **Letterboxd**, **Radarr** (for movies) / **Sonarr** (for TV series), **Jellyfin**, and **Seerr**, opening in a new tab (`target="_blank" rel="noopener noreferrer"`), so that I can jump directly to the media item in any connected tool or public database.
5. As an administrator, I want a compact metadata summary strip inside the `<Sheet>` body showing **Requested** date, **Inactive** days (`Xd` or `Never`), and **Protection** status (`Whitelisted` vs `Unprotected`).
6. As a developer, I want a single shared `<MediaDetailSheet>` component used by both `DataTable` (`components/audit-table/data-table.tsx`) and `WatchMatrix` (`components/matrix-table/watch-matrix.tsx`) that encapsulates the inspection sheet and purge confirmation dialog.

## Implementation Decisions

### 1. Scrollbar Gutter Fix (`app/globals.css`) & Sheet Sizing (`components/ui/sheet.tsx`)
In `app/globals.css` inside `@layer base`:
```css
  html {
    @apply font-sans;
    scrollbar-gutter: auto !important;
  }
```
In `components/ui/sheet.tsx`:
- Update `SheetContent` default right-side max width from `data-[side=right]:sm:max-w-sm` to `data-[side=right]:sm:max-w-md` (`448px`).

### 2. External Service Links in `types/index.ts` and `lib/audit.ts`
Extend `SeerrMediaInfo` and `AuditMediaItem` in `types/index.ts`:
```ts
export interface SeerrMediaInfo {
  id: number
  tmdbId: number
  tvdbId?: number
  imdbId?: string
  status: number
  mediaType: MediaType
  serviceUrl?: string
  externalServiceSlug?: string
  createdAt: string
  updatedAt: string
}

export interface MediaExternalLinks {
  imdb?: string
  letterboxd?: string
  arr?: string
  jellyfin?: string
  seerr?: string
}
```
Add `imdbId?: string` and `externalLinks?: MediaExternalLinks` to `AuditMediaItem`.

In `lib/audit.ts`, export a pure helper `buildMediaExternalLinks` and call it for each `AuditMediaItem`:
```ts
export function buildMediaExternalLinks(params: {
  mediaType: MediaType
  tmdbId: number
  imdbId?: string
  jellyfinItemId?: string
  jellyfinServerId?: string
  externalServiceSlug?: string
  serviceUrl?: string
  jellyfinBaseUrl?: string
  seerrBaseUrl?: string
  radarrBaseUrl?: string
  sonarrBaseUrl?: string
}): MediaExternalLinks {
  const {
    mediaType,
    tmdbId,
    imdbId,
    jellyfinItemId,
    jellyfinServerId,
    externalServiceSlug,
    serviceUrl,
    jellyfinBaseUrl = process.env.JELLYFIN_URL || "",
    seerrBaseUrl = process.env.SEERR_URL || "",
    radarrBaseUrl = process.env.RADARR_URL || "",
    sonarrBaseUrl = process.env.SONARR_URL || "",
  } = params

  const cleanUrl = (u: string) => u.replace(/\/+$/, "")
  const jfBase = cleanUrl(jellyfinBaseUrl)
  const seerrBase = cleanUrl(seerrBaseUrl)
  const radarrBase = cleanUrl(radarrBaseUrl)
  const sonarrBase = cleanUrl(sonarrBaseUrl)

  const imdb = imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined
  const letterboxd =
    mediaType === "movie"
      ? `https://letterboxd.com/tmdb/${tmdbId}/`
      : undefined

  let arr: string | undefined
  if (serviceUrl) {
    arr = serviceUrl
  } else if (mediaType === "movie" && radarrBase) {
    arr = `${radarrBase}/movie/${externalServiceSlug || tmdbId}`
  } else if (mediaType === "tv" && sonarrBase) {
    arr = externalServiceSlug
      ? `${sonarrBase}/series/${externalServiceSlug}`
      : sonarrBase
  }

  const jellyfin =
    jfBase && jellyfinItemId
      ? `${jfBase}/web/index.html#!/details?id=${jellyfinItemId}${
          jellyfinServerId ? `&serverId=${jellyfinServerId}` : ""
        }`
      : undefined

  const seerr = seerrBase ? `${seerrBase}/${mediaType}/${tmdbId}` : undefined

  return { imdb, letterboxd, arr, jellyfin, seerr }
}
```
Note: `MediaDetailSheet` will also call `buildMediaExternalLinks` as a fallback if `item.externalLinks` is not pre-populated (e.g., in unit tests with minimal fixtures), so **IMDb** (when `imdbId` is present) and **Letterboxd** (for movies via `tmdbId`) always render even without server env vars.

### 3. Shared `<MediaDetailSheet>` Component (`components/media-detail-sheet.tsx`)
Create `components/media-detail-sheet.tsx`:
```tsx
export interface DeleteTarget {
  item: AuditMediaItem
  target: "all" | "single_episode"
  episodeFileId?: number
}

export interface MediaDetailSheetProps {
  selectedItem: AuditMediaItem | null
  onClose: () => void
  onItemUpdated: (itemId: string, updates: Partial<AuditMediaItem>) => void
  onItemDeleted: (target: DeleteTarget) => void
  deleteCandidate?: DeleteTarget | null
  onDeleteCandidateChange?: (candidate: DeleteTarget | null) => void
}
```
- **Pinned Header (`<SheetHeader className="shrink-0 border-b border-border p-5 pr-10 text-left bg-popover space-y-3">`)**:
  - Top row: `w-20 h-28` poster (`&w=400&tag=...`) + title (`text-base font-semibold leading-snug line-clamp-2`), subtitle (`year • mediaType • sizeGb`), and `quality` + `genres` badges.
  - External links row: flex-wrap row of compact external link pills (`<a href={...} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors">`) with `IconExternalLink`:
    - **Jellyfin** (`links.jellyfin`)
    - **Seerr** (`links.seerr`)
    - **Radarr** (`mediaType === "movie"` & `links.arr`) / **Sonarr** (`mediaType === "tv"` & `links.arr`)
    - **IMDb** (`links.imdb`)
    - **Letterboxd** (`links.letterboxd`)
- **Scrollable Middle Body (`<div className="flex-1 overflow-y-auto p-5 space-y-5">`)**:
  - **Compact Metadata Strip**: 3-column grid (`grid grid-cols-3 gap-2`):
    - `Requested`: formatted `requestedAt` date
    - `Inactive`: `${daysSinceLastPlayed}d` or `"Never"`
    - `Protection`: `"Whitelisted"` (emerald text) or `"Unprotected"` (muted text)
  - **Retention Status Banner**: `safe` / `conflict` / `ghost` box with status label and `conflictReason`.
  - **Overview**: rendered when `selectedItem.overview` is truthy.
  - **Household Playback Breakdown**: Requester card + `householdStates` cards, rendering `<AvatarImage>` only when `avatarUrl` is defined, plus `Progress`, status, play count, and last played date.
- **Pinned Footer (`<SheetFooter className="shrink-0 border-t border-border p-4 bg-popover flex-row items-center justify-between gap-2">`)**:
  - `Whitelist Media` / `Remove Whitelist` button (`variant="outline"`, `size="sm"`)
  - `Purge Media` button (`variant="destructive"`, `size="sm"`)
- **Confirm Purge `<Dialog>`**:
  - Uses either controlled `deleteCandidate` / `onDeleteCandidateChange` (if provided by `DataTable`) or internal state (used by `WatchMatrix`), executes `deleteMediaAction`, closes the dialog/sheet on success, and invokes `onItemDeleted(candidate)`.

### 4. Integration in `DataTable` & `WatchMatrix`
- Replace the inline `<Sheet>` and `<Dialog>` blocks in `components/audit-table/data-table.tsx` and `components/matrix-table/watch-matrix.tsx` with `<MediaDetailSheet ... />`.

## Testing Strategy

Create `tests/media-detail-sheet.test.ts` and verify with `./node_modules/.bin/tsx --test tests/*.test.ts`:
1. **`buildMediaExternalLinks` Unit Tests**:
   - Builds `imdb` (`https://www.imdb.com/title/tt1375666/`), `letterboxd` (`https://letterboxd.com/tmdb/27205/`), `arr` (`${radarrUrl}/movie/27205`), `jellyfin` (`${jfUrl}/web/index.html#!/details?id=jf-1&serverId=srv-1`), and `seerr` (`${seerrUrl}/movie/27205`) for movies.
   - Builds `arr` (`${sonarrUrl}/series/breaking-bad`), `seerr` (`${seerrUrl}/tv/1396`), and omits `letterboxd` for TV series.
   - Prefers `serviceUrl` when provided on Seerr media.
2. **`<MediaDetailSheet>` SSR Markup Tests**:
   - Renders pinned `data-slot="sheet-header"`, scrollable body with the 3-column metadata strip (`Requested`, `Inactive`, `Protection`), external service links (`IMDb`, `Letterboxd`, `Radarr`/`Sonarr`, `Jellyfin`, `Seerr`) with `target="_blank"`, household playback breakdown, and pinned `data-slot="sheet-footer"` with `Whitelist Media` and `Purge Media` actions.
3. **Regression Suite**:
   - Run `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/tsx --test tests/*.test.ts`.

## Out of Scope

- Fetching additional external IDs via extra network calls when `ProviderIds.Imdb` is absent from Jellyfin.
- Embedding an interactive episode tree inside `<MediaDetailSheet>` (already supported via expandable sub-rows in the Audit Queue table).
