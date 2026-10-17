# Spec: Media Posters, User Avatars, and Rich Media Details

## Problem Statement

WatchedSeerr's table view is currently text-heavy, showing only titles and icon placeholders. Users cannot quickly identify media at a glance through cover posters. Clicking a row opens a slide-over sheet that only displays playback percentages without media plot summaries, technical specs (e.g. 4K, 1080p, HDR), file size breakdown, or genres. Furthermore, household members and requesters are represented solely by generic icons rather than their actual Jellyfin or Seerr profile avatars.

## Solution

1. **Cover Posters in Table Rows**: Render a compact 36x54px aspect-ratio poster thumbnail in each media table row with fallback placeholder icons.
2. **Server-Side Image Proxy Routes**: Serve posters and avatars via secure internal proxy endpoints (`/api/proxy/poster` and `/api/proxy/avatar`) to avoid exposing Jellyfin/Seerr API keys to the browser, prevent mixed-content warnings, and add browser HTTP caching headers.
3. **User Profile Avatars**: Use shadcn `Avatar`, `AvatarImage`, and `AvatarFallback` components to display Jellyfin and Seerr user profile pictures across table rows, matrix columns, and playback breakdown cards.
4. **Rich Inspection Sheet**: In the slide-over Sheet, show a full hero poster cover, overview plot synopsis, release year, genres, total size on disk (formatted in GB), resolution/quality tags, and direct links to Jellyfin/Seerr.

## User Stories

1. As an administrator, I want to see a thumbnail poster next to each media title in the audit table, so that I can immediately recognize the movie or show.
2. As an administrator, I want poster images to load through a proxy API, so that my internal Jellyfin and Seerr API tokens are never exposed in browser HTML or network requests.
3. As an administrator, I want user avatars to appear next to requester names and in household breakdowns, so that I can see who requested or watched what.
4. As an administrator, I want fallback initials when a user does not have a profile picture, so that the UI never displays broken image icons.
5. As an administrator, I want clicking a media row to reveal its plot overview synopsis in the detail sheet, so that I can remember what the show or movie is about before deciding to purge it.
6. As an administrator, I want to see the total file size (e.g., "14.2 GB") and quality details (e.g., "1080p Web-DL") in the detail sheet, so that I understand how much disk space will be reclaimed by purging.
7. As an administrator, I want media genres (e.g., "Action", "Sci-Fi") displayed as badges in the detail sheet, so that I have complete context on the item.
8. As an administrator, I want the watch matrix table header to display user avatars above each column, so that the household matrix is visually personalized.

## Implementation Decisions

### 1. Image Proxy API Endpoints (`app/api/proxy/`)

- `app/api/proxy/poster/route.ts`:
  - Accepts `?tmdbId=...&mediaType=...&jellyfinItemId=...`
  - Fetches primary image from Jellyfin (`/Items/{id}/Images/Primary`) or TMDB CDN (`https://image.tmdb.org/t/p/w300{posterPath}`) using server-side credentials.
  - Streams response with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.
- `app/api/proxy/avatar/route.ts`:
  - Accepts `?userId=...` (Jellyfin User ID) or `?avatar=...` (Seerr avatar path)
  - Fetches avatar binary from Jellyfin (`/Users/{userId}/Images/Primary`) or Seerr avatar url.
  - Streams response with `Cache-Control: public, max-age=86400`.

### 2. Domain Model Enrichment (`types/index.ts`)
Extend `AuditMediaItem`:
```ts
export interface AuditMediaItem {
  ...
  overview?: string
  genres?: string[]
  quality?: string // e.g. "1080p", "4K", "720p"
  jellyfinImageTag?: string
  requesterAvatarUrl?: string
}
```

### 3. Component Architecture & shadcn Primitives
- **Table Row Poster**: In `components/audit-table/columns.tsx`, render thumbnail:
  ```tsx
  <div className="relative size-9 shrink-0 overflow-hidden bg-muted border border-border">
    {posterUrl ? (
      <img src={posterUrl} alt={item.title} className="size-full object-cover" />
    ) : (
      <IconMovie className="size-4" />
    )}
  </div>
  ```
- **Avatars**: In `columns.tsx`, `data-table.tsx`, and `app/matrix/page.tsx`:
  ```tsx
  <Avatar className="size-5 shrink-0">
    <AvatarImage src={`/api/proxy/avatar?userId=${user.userId}`} />
    <AvatarFallback className="text-[10px] uppercase font-mono">
      {user.username.slice(0, 2)}
    </AvatarFallback>
  </Avatar>
  ```
- **Detail Sheet Hero & Overview**: In `components/audit-table/data-table.tsx`:
  - Hero banner with poster thumbnail, title, year, size, and genre badges.
  - Synopsis text block under `<CardDescription className="text-xs text-foreground/90">`.

## Testing Decisions

- **Good Test Standard**: Test external HTTP proxy behavior and image URL resolution:
  - Verify `/api/proxy/poster` returns 400 when missing required query parameters.
  - Verify `auditMedia()` extracts and forwards `overview`, `genres`, and `posterPath`.
- **Modules Tested**: `lib/audit.ts` and `app/api/proxy/` routes.
- **Prior Art**: `tests/arr-clients.test.ts`.

## Out of Scope

- User avatar uploading or editing (avatar source is strictly Jellyfin / Seerr).
- Custom client-side image cropping or canvas filters.

## Further Notes

- Installed `@/components/ui/avatar.tsx` supports standard accessible Radix/Base-UI primitives with automatic fallback.
