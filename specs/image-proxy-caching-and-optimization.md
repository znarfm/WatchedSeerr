# Spec: Image Proxy Caching, Sizing & Missing-Avatar Optimization

## Problem Statement

When loading the Audit Queue (`/`) or Watch Matrix (`/matrix`), server logs show three performance and network bottlenecks in the image proxy layer:
1. **Repeated 404 Avatar Requests**: Users without a Jellyfin profile picture (e.g., `jenna`, `userId=96a8251ca4c843779fb301b4d37e4ba6`) still receive a generated `/api/proxy/avatar?userId=...` URL on every row. Because `/api/proxy/avatar` returns `404` without a `Cache-Control` header, the browser fires duplicate `GET /api/proxy/avatar` requests across rows and re-renders, spamming server logs with 404s.
2. **Oversized Raw Poster Transfers (`300ms–673ms` per poster)**: `/api/proxy/poster` requests `/Items/{id}/Images/Primary` from Jellyfin with no dimension or quality parameters, streaming full-resolution 1000×1500+ source posters (often 500 KB–2 MB each) just to render `36×36px` (`size-9`) table thumbnails.
3. **Lack of In-Memory / Server-Side Image Caching & Immutable Tag Headers**: Both `/api/proxy/poster` and `/api/proxy/avatar` rely solely on browser `Cache-Control` headers without server-side caching (`next: { revalidate: 86400 }` and process-level negative/binary cache), causing cold or cache-disabled loads in `next dev` to hit upstream Jellyfin on every request.

## Solution

1. **Skip Avatar URLs When User Has No Avatar (`PrimaryImageTag`)**:
   - Extend `JellyfinUser` in `types/index.ts` with `PrimaryImageTag?: string` and `UserPlaybackState` with `avatarUrl?: string`.
   - In `auditMedia()`, only construct `/api/proxy/avatar?userId=${jUser.Id}&tag=${jUser.PrimaryImageTag}` when `jUser.PrimaryImageTag` is present (falling back to Seerr's `avatar` only when non-empty and not pointing to a tagless Jellyfin user). Users without an avatar get `avatarUrl: undefined`, so `<AvatarFallback>` renders their 2-letter initials immediately with **zero** network requests.
2. **Request Pre-Scaled Thumbnails from Jellyfin & TMDB**:
   - In `/api/proxy/poster/route.ts`, forward `?maxWidth=240&quality=80` (configurable via optional `?w=` query param, e.g. `w=400` for detail sheet hero) and optional `tag` to Jellyfin `/Items/{id}/Images/Primary`, and request `maxWidth=96&quality=80` on `/Users/{userId}/Images/Primary` in `/api/proxy/avatar/route.ts`.
3. **Server-Side Cache + Immutable & Negative Caching Headers**:
   - Add an in-memory LRU/TTL cache in the proxy routes (caching both `200` image buffers and `404` misses) alongside `next: { revalidate: 86400 }` on upstream `fetch()` calls.
   - When `?tag=` (`jellyfinImageTag` or `PrimaryImageTag`) is present on a `200` response, return `Cache-Control: public, max-age=31536000, immutable` (otherwise `public, max-age=86400, stale-while-revalidate=604800`).
   - On `404` responses in both `/api/proxy/poster` and `/api/proxy/avatar`, return `Cache-Control: public, max-age=3600` so browsers never re-fetch known missing images within the session.

## User Stories

1. As an administrator, I want users without a Jellyfin profile image to immediately render their `<AvatarFallback>` initials without triggering `/api/proxy/avatar` network requests, so that the dev server and browser console are never spammed with 404s.
2. As an administrator, I want any 404 response from `/api/proxy/avatar` or `/api/proxy/poster` to include `Cache-Control: public, max-age=3600`, so that even if a missing image URL is requested once, the browser does not repeat the failed request across table rows.
3. As an administrator, I want table row posters to request scaled images (`maxWidth=240&quality=80`) from Jellyfin instead of multi-megabyte originals, so that poster thumbnails load in tens of milliseconds instead of 400–700ms.
4. As an administrator, I want the slide-over detail sheet to be able to request a slightly larger poster (`?w=400`) when needed while still avoiding uncompressed multi-megabyte raw images, so that the hero cover looks crisp and loads fast.
5. As an administrator, I want poster and avatar URLs to include Jellyfin's image tag (`?tag=...`) when available and return `Cache-Control: public, max-age=31536000, immutable`, so that browsers cache tagged images indefinitely until the image changes in Jellyfin.
6. As an administrator, I want the proxy routes to cache upstream responses in server memory (including negative 404 entries with a TTL), so that repeated requests across pages (`/`, `/matrix`) or during `next dev` are served instantaneously in `<1ms` without re-querying Jellyfin.

## Implementation Decisions

### 1. Type Additions (`types/index.ts`)
- Add `PrimaryImageTag?: string` to `JellyfinUser`:
  ```ts
  export interface JellyfinUser {
    Id: string
    Name: string
    ServerId?: string
    PrimaryImageTag?: string
  }
  ```
- Add `avatarUrl?: string` to `UserPlaybackState`:
  ```ts
  export interface UserPlaybackState {
    ...
    avatarUrl?: string
  }
  ```

### 2. Avatar Presence Resolution (`lib/audit.ts`, `components/audit-table/columns.tsx`, `components/audit-table/data-table.tsx`, `app/matrix/page.tsx`)
- In `auditMedia()`:
  - For each `jUser`, resolve `avatarUrl`:
    ```ts
    const jfAvatarUrl = jUser.PrimaryImageTag
      ? `/api/proxy/avatar?userId=${jUser.Id}&tag=${jUser.PrimaryImageTag}`
      : undefined
    ```
  - For `requester.requesterAvatarUrl`:
    - If `matchedJellyfinUser` exists: use `jfAvatarUrl` (if `matchedJellyfinUser.PrimaryImageTag` is undefined, the user has no Jellyfin avatar, so `requesterAvatarUrl` is `undefined` rather than falling back to a broken `/avatarproxy/{jellyfinUserId}` URL).
    - If `matchedJellyfinUser` does NOT exist and `req.requestedBy?.avatar` is a non-Jellyfin external/local avatar: use `/api/proxy/avatar?avatar=${encodeURIComponent(req.requestedBy.avatar)}`.
- In `columns.tsx`, `data-table.tsx`, and `app/matrix/page.tsx`:
  - Render `<AvatarImage src={...} />` only when `requester.requesterAvatarUrl` or `user.avatarUrl` is defined; do not synthesize blind `/api/proxy/avatar?userId=...` URLs when `avatarUrl` is `undefined`.
  - Append `&tag=${item.jellyfinImageTag}` to `/api/proxy/poster?jellyfinItemId=...` when `item.jellyfinImageTag` is defined.

### 3. Poster & Avatar Proxy Optimization (`app/api/proxy/poster/route.ts` & `app/api/proxy/avatar/route.ts`)
- **Upstream query sizing**:
  - In `poster/route.ts`: parse `w = Number(searchParams.get("w")) || 240` (clamped between `64` and `800`) and `tag = searchParams.get("tag")`. Call Jellyfin with:
    `${jfUrl}/Items/${jellyfinItemId}/Images/Primary?maxWidth=${w}&quality=80${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`
  - In `avatar/route.ts`: parse `tag = searchParams.get("tag")`. Call Jellyfin with:
    `${jfUrl}/Users/${userId}/Images/Primary?maxWidth=96&quality=80${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`
- **Process-level memory cache & headers**:
  - Maintain a bounded `Map<string, { status: 200 | 404; body?: ArrayBuffer; contentType?: string; expiresAt: number }>` (max 500 entries, 24h TTL for 200s, 10m TTL for 404s) keyed by request query string, bypassed or cleared automatically when `globalThis.fetch` is swapped in unit tests (or keyed per upstream URL).
  - Return `Cache-Control: public, max-age=31536000, immutable` when `tag` is provided on `200`, `public, max-age=86400, stale-while-revalidate=604800` otherwise, and `public, max-age=3600` on `404`.

## Testing Decisions

- **Good Test Standard**: Test external HTTP response status, headers, and upstream URL query parameters at the existing `GET` route handler seam (`tests/proxy.test.ts`) and `auditMedia` seam (`lib/audit.ts`).
- **Seams (`app/api/proxy/poster/route.ts`, `app/api/proxy/avatar/route.ts`, `lib/audit.ts`)**:
  1. Verify `GET /api/proxy/poster?jellyfinItemId=jf-item-123` requests `/Items/jf-item-123/Images/Primary?maxWidth=240&quality=80` from Jellyfin and sets `Cache-Control` with `max-age=86400` (or `immutable` when `tag` is passed).
  2. Verify `GET /api/proxy/avatar?userId=missing` returns `404` with `Cache-Control: public, max-age=3600`.
  3. Verify `auditMedia()` sets `requesterAvatarUrl` and `householdStates[].avatarUrl` to `undefined` when `JellyfinUser.PrimaryImageTag` is absent, and populates it when `PrimaryImageTag` is present.
- **Prior Art**: `tests/proxy.test.ts` and `tests/audit-enrichment.test.ts`.

## Out of Scope

- Storing cached image binaries on disk or in SQLite.
- Using `next/image` client domain whitelisting (proxies remain the single image origin).

## Further Notes

- Keeping `max-age=86400` on untagged `200` responses preserves backward compatibility with existing assertions in `tests/proxy.test.ts`.
