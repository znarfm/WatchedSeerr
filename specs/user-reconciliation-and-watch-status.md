# Spec: Seerr/Jellyfin User Reconciliation & Watch Status Accuracy

## Problem Statement

Media items that the user has already watched in Jellyfin are erroneously appearing as `unplayed (0%)` in the Audit Queue and Watch Matrix, and duplicate columns appear on the Watch Matrix for the same household members (e.g., `"Meinard"` alongside `"nard"`, and `"Family"` alongside `"fam"`).

Investigation against live Seerr and Jellyfin data identified three root causes:
1. **Split User Identities (`Meinard` ↔ `nard`, `Family` ↔ `fam`)**: Seerr users have custom display names (`displayName: "Meinard"`, `"Family"`) linked to Jellyfin accounts with different usernames (`jellyfinUsername: "nard"`, `"fam"` and `jellyfinUserId`). While `auditMedia()` links the requester via `jellyfinUserId`, it keeps Seerr's `displayName` on `item.requester.username` while populating `requesterState.username` and `householdStates[].username` with Jellyfin's `Name` (`"nard"`, `"fam"`). On the Watch Matrix (`app/matrix/page.tsx`), columns are keyed by `username` string, creating two columns per person and causing lookup misses (`0% unplayed`) whenever an item's requester name (`"Meinard"`) differs from their Jellyfin username (`"nard"`).
2. **Movies with `PlayCount > 0` and `Played: false` Ignored**: In Jellyfin, 30+ watched movies have `PlayCount > 0` and a valid `LastPlayedDate`, but `Played: false` and `PlaybackPositionTicks: 0` (e.g., when playback stopped during end credits before Jellyfin's 90% auto-mark threshold). `mapUserWatchStatus()` only checks `Played === true` or `PlaybackPositionTicks > 0`, misclassifying all of them as `unplayed (0%)`.
3. **TV Series `PlayedPercentage` Ignored**: For `Type: "Series"` items, Jellyfin's `/Users/{userId}/Items` endpoint returns `PlaybackPositionTicks: 0` on the series container and reports progress via `UserData.PlayedPercentage`. Because `mapUserWatchStatus()` ignores `PlayedPercentage`, any partially watched TV series (or series with unwatched specials) is reported as `unplayed (0%)`. Additionally, `getSeriesEpisodesAction` does not pass the requester's `userId` when fetching episode-level `UserData`.

## Solution

1. **Canonical Seerr Display Name & User ID Reconciliation**:
   - Build a mapping from Jellyfin User ID (normalized lowercase without dashes) and Jellyfin Username to the user's Seerr display name (`displayName || username`) using Seerr users (`/api/v1/user`) and request `requestedBy` payloads.
   - Use the canonical Seerr display name (`"Meinard"`, `"Family"`, `"jenna"`) across `item.requester.username`, `item.requesterState.username`, and every entry in `item.householdStates[].username`.
   - In `app/matrix/page.tsx`, deduplicate and match user columns by `userId` (falling back to normalized `username`) so each household member appears once under their Seerr name with complete watch history across both requested and non-requested media.
2. **Treat `PlayCount > 0` Movies as Completed**:
   - In `mapUserWatchStatus()`, when an item has `PlayCount > 0` and `PlaybackPositionTicks === 0` (and no partial series `PlayedPercentage`), classify it as `status: "completed"` with `progressPercent: 100`.
3. **Support Jellyfin `PlayedPercentage` on TV Series & Episode User Context**:
   - Extend `JellyfinUserData` in `types/index.ts` with `PlayedPercentage?: number` and `UnplayedItemCount?: number`.
   - In `mapUserWatchStatus()`, read `userData.PlayedPercentage` so series progress (`0–100%`) maps accurately to `completed` (`>= 100` or `> 90`) or `in_progress` (`1–90%`).
   - Pass the requester's `matchedJellyfinUserId` into `getSeriesEpisodesAction` so expanded TV episode rows reflect the requester's actual episode watch states.

## User Stories

1. As an administrator, I want my Seerr display name (e.g. `"Meinard"`, `"Family"`) to be used consistently across the Audit Queue, detail sheet, and Watch Matrix instead of my raw Jellyfin username (`"nard"`, `"fam"`), so that every person is represented by a single recognizable identity.
2. As an administrator, I want the Watch Matrix to show a single column per person (e.g. `"Meinard"`, `"Family"`, `"jenna"`) rather than duplicate columns for Seerr and Jellyfin names, so that the household matrix is accurate and clutter-free.
3. As an administrator, I want my watch progress to appear in my Watch Matrix column both for media I requested and for media requested by other household members, so that my column never falsely shows `0% unplayed` on my own requests.
4. As an administrator, I want movies that have `PlayCount > 0` (with `PlaybackPositionTicks === 0`) in Jellyfin to be marked as `completed (100%)`, so that movies I watched and stopped during the credits are not flagged as unplayed or ghost requests.
5. As an administrator, I want TV series with `UserData.PlayedPercentage > 0` in Jellyfin to show their actual completion percentage and `in_progress` or `completed` status, so that partially watched shows are not misclassified as `0% unplayed`.
6. As an administrator, I want TV series where `PlayedPercentage > 90` or `Played === true` to be marked as `completed`, so that finished shows with unaired specials do not stay stuck as unplayed.
7. As an administrator, I want expanding a TV series row in the Audit Queue to fetch episode watch states for the series requester's Jellyfin `userId`, so that individual episodes accurately reflect what the requester has watched.
8. As an administrator, I want conflict and ghost detection in `auditMedia()` to use the reconciled user states and updated `completed`/`in_progress` statuses, so that watched items move out of `Ghost Requests` and into `Safe to Purge` or `Active Conflicts` appropriately.

## Implementation Decisions

### 1. Type Updates (`types/index.ts`)
Extend `JellyfinUserData` and `SeerrUser`:
```ts
export interface SeerrUser {
  id: number
  email?: string
  username?: string | null
  displayName?: string
  jellyfinUsername?: string | null
  jellyfinUserId?: string | null
  avatar?: string
}

export interface JellyfinUserData {
  PlaybackPositionTicks: number
  PlayCount: number
  IsFavorite: boolean
  Played: boolean
  PlayedPercentage?: number
  UnplayedItemCount?: number
  LastPlayedDate?: string
  Key?: string
}
```

### 2. Seerr Users Endpoint & Identity Map (`lib/clients/seerr.ts` & `lib/audit.ts`)
Add `getUsers()` to `SeerrClient`:
```ts
async getUsers(take = 100): Promise<SeerrUser[]> {
  const data = await this.request<{ results: SeerrUser[] }>(
    `/api/v1/user?take=${take}`
  )
  return data.results || []
}
```
In `auditMedia()` (`lib/audit.ts`):
- Fetch `seerr.getUsers?.().catch(() => [])` alongside `seerr.getRequests()`, and merge with `requests.map((r) => r.requestedBy)` so user reconciliation works even if `getUsers` is omitted in unit test mocks.
- Normalize Jellyfin IDs via `id.replace(/-/g, "").toLowerCase()`.
- Map each `JellyfinUser` (`jUser`) to its preferred Seerr display name:
  ```ts
  const preferredName =
    seerrNameByJfId.get(normalizeId(jUser.Id)) ||
    seerrNameByJfUsername.get(jUser.Name.toLowerCase()) ||
    jUser.Name
  ```
- Match `req.requestedBy` to `matchedJellyfinUser` by checking:
  1. `normalizeId(reqBy.jellyfinUserId)`
  2. `reqBy.jellyfinUsername?.toLowerCase()`
  3. `reqBy.displayName?.toLowerCase()` or `reqBy.username?.toLowerCase()`
- Set `item.requester.username`, `item.requesterState.username`, and `item.householdStates[].username` to the resolved Seerr display name.

### 3. Watch Status Calculation (`lib/audit.ts` & `lib/actions.ts`)
Update `mapUserWatchStatus(item?: JellyfinItem, episodes?: JellyfinItem[])`:
```ts
const userData = item?.UserData
if (!userData) {
  return { status: "unplayed", progressPercent: 0 }
}

if (userData.Played) {
  return { status: "completed", progressPercent: 100 }
}

if (typeof userData.PlayedPercentage === "number" && userData.PlayedPercentage > 0) {
  const pct = Math.min(100, Math.round(userData.PlayedPercentage))
  return {
    status: pct > 90 ? "completed" : "in_progress",
    progressPercent: pct > 90 ? 100 : pct,
  }
}

const runTime = item?.RunTimeTicks || 0
const position = userData.PlaybackPositionTicks || 0
if (runTime > 0 && position > 0) {
  const pct = Math.min(99, Math.round((position / runTime) * 100))
  return { status: pct > 90 ? "completed" : "in_progress", progressPercent: pct }
}

if ((userData.PlayCount || 0) > 0) {
  return { status: "completed", progressPercent: 100 }
}

return { status: "unplayed", progressPercent: 0 }
```
Update `getSeriesEpisodesAction(jellyfinItemId: string, seriesTmdbId: number, userId?: string)` in `lib/actions.ts` to forward `userId` to `jellyfin.getEpisodes(jellyfinItemId, userId)` and apply the same `PlayCount > 0` completion rule.

### 4. Watch Matrix Column Deduplication (`app/matrix/page.tsx`)
Key columns in `app/matrix/page.tsx` by canonical identity (`userId` when matched, otherwise lowercase `username`), and match each row's cell state by `userId` first (`item.requesterState.userId === col.userId`, then `item.householdStates.find((h) => h.userId === col.userId)`) with lowercase `username` fallback.

## Testing Decisions

- **Good Test Standard**: Test external behavior through the existing `auditMedia({ seerrClient, jellyfinClient })` seam in `lib/audit.ts`.
- **Single Seam (`lib/audit.ts` -> `auditMedia`)**:
  1. **User Reconciliation**: Given Seerr requests from `displayName: "Meinard"` (`jellyfinUsername: "nard"`, `jellyfinUserId: "u-nard"`) and `displayName: "Family"` (`jellyfinUsername: "fam"`, `jellyfinUserId: "u-fam"`) and Jellyfin users `Name: "nard"` / `Name: "fam"`, verify `auditMedia()` outputs `"Meinard"` and `"Family"` for both `requester.username`, `requesterState.username`, and `householdStates[].username`, and binds `"nard"`'s watch progress to `"Meinard"`'s `requesterState`.
  2. **`PlayCount > 0` Movie Completion**: Given a movie with `Played: false`, `PlaybackPositionTicks: 0`, and `PlayCount: 3`, verify `auditMedia()` marks the user's state as `status: "completed"` and `progressPercent: 100` (and `conflictStatus: "safe"` instead of `"ghost"`).
  3. **TV Series `PlayedPercentage`**: Given a series with `Played: false`, `PlaybackPositionTicks: 0`, and `PlayedPercentage: 50`, verify `auditMedia()` marks the user's state as `status: "in_progress"` and `progressPercent: 50`.
- **Prior Art**: `tests/jellyfin-filter-and-tv-hierarchy.test.ts` and `tests/audit-enrichment.test.ts`.

## Out of Scope

- Manual user-mapping configuration UI in SQLite (Seerr already stores `jellyfinUserId` and `jellyfinUsername` for every user).
- Writing watch states back to Jellyfin.

## Further Notes

- Normalizing `jellyfinUserId` by stripping hyphens and lowercasing ensures compatibility whether Jellyfin or Seerr formats UUIDs with or without dashes.
