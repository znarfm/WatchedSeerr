# Specification: WatchedSeerr

## Problem Statement

Home media server administrators using Jellyfin along with Overseerr/Jellyseerr face unchecked disk usage growth. Users submit requests that get automatically downloaded via Sonarr/Radarr, but administrators have no clear visibility into whether:
1. The user who requested the media actually watched it.
2. The user abandoned the item mid-way (e.g. stalled after episode 1).
3. Other household users are currently watching or planning to watch it.

Manually cross-referencing Jellyseerr request records with Jellyfin playback states across multiple users is tedious and error-prone. Media is either prematurely deleted—causing frustration—or retained indefinitely, filling up server storage.

## Solution

WatchedSeerr is a self-hosted media lifecycle auditor that cross-references Seerr requests with Jellyfin playback history. It provides an automated, unified audit queue that classifies media into clear retention states (Safe to purge, Active conflict / watching elsewhere, Ghost request unplayed by requester). It supports granular drill-down inspection into household playback states, safe whitelisting, deletion triggers, and daily unattended Discord audit notifications via cron.

## User Stories

1. As a media server admin, I want to view a list of all approved/downloaded Seerr requests alongside their current Jellyfin playback status so that I can see what media is being consumed.
2. As a media server admin, I want to see the specific requester's username and avatar on each item so that I know who requested the content.
3. As a media server admin, I want to see if the requester has completed, started (in-progress %), or never played the requested media so that I can evaluate requester accountability.
4. As a media server admin, I want to know how many days have elapsed since any household member last played the media so that I can identify stale items.
5. As a media server admin, I want items flagged with clear safety badges (🟢 Safe to delete, 🟡 Conflict/Active elsewhere, 🔴 Ghost request) so that I do not accidentally delete media others are watching.
6. As a media server admin, I want ghost requests flagged when the requester has never played the media after a configurable number of days so that I can address request abandonment.
7. As a media server admin, I want active conflict warnings when non-requesters have in-progress or recent playbacks so that household viewing is never disrupted.
8. As a media server admin, I want to filter the audit queue by media type (Movies vs. TV Shows) so that I can audit libraries independently.
9. As a media server admin, I want to filter the queue by inactivity threshold (e.g. >30, >60, >90 days unplayed) so that I can prioritize the oldest unused files.
10. As a media server admin, I want to search media by title so that I can audit a specific item immediately.
11. As a media server admin, I want to open a slide-over inspection drawer for any item to inspect playback breakdown per user across the household.
12. As a media server admin, I want to inspect TV shows at a season and episode level across all users so that I know which episodes have stalled.
13. As a media server admin, I want a 2D Watch Matrix view cross-referencing all requests with all server users so that I can spot household-wide watching patterns.
14. As a media server admin, I want to whitelist specific media items so that permanent favorites or shared media are permanently excluded from purge recommendations.
15. As a media server admin, I want to trigger deletion of safe media items directly or via Radarr/Sonarr so that I can reclaim disk space without manual file management.
16. As a media server admin, I want a secure cron endpoint (`/api/cron`) protected by a secret token so that external schedulers or crontab can trigger automated checks.
17. As a media server admin, I want automated audit summaries posted to a Discord webhook so that I receive actionable cleanup notifications daily without visiting the web UI.
18. As a media server admin, I want to run a standalone CLI script to test Jellyfin and Seerr API connectivity and audit calculations so that I can debug configurations directly in the terminal.
19. As a self-hoster, I want Docker and Docker Compose definitions with standalone Next.js output so that I can run WatchedSeerr in a lightweight container or Proxmox LXC.

## Implementation Decisions

### 1. Architectural Seams & Boundaries
- **Single Core Seam: `src/lib/audit.ts` (`auditMedia()`)**:
  - Encapsulates fetching raw data from Seerr and Jellyfin, resolving user mapping, calculating play states, and computing conflict badges.
  - Takes typed client interfaces or configuration options, returning `AuditReport` containing `items: AuditMediaItem[]` and summary stats.
  - Both UI (RSC in `src/app/page.tsx`, `/matrix`) and Headless triggers (`/api/cron`, `src/scripts/test-audit.ts`) consume this single engine.

### 2. Client & Domain Layer
- `src/lib/clients/seerr.ts`:
  - `GET /api/v1/request?take=200&filter=all`
  - Normalizes TMDB ID, media type (`movie` | `tv`), request status, and requester username/email.
- `src/lib/clients/jellyfin.ts`:
  - `GET /Users` to map Jellyfin users.
  - `GET /Items?HasTmdbId=true` to locate library items by TMDB ID.
  - `GET /Users/{userId}/Items/{itemId}` and `GET /Shows/{seriesId}/Episodes?userId={userId}` for granular playback states (`Played`, `PlaybackPositionTicks`, `LastPlayedDate`).
- `src/types/index.ts`:
  - `AuditMediaItem`:
    ```ts
    export type ConflictStatus = "safe" | "conflict" | "ghost";

    export interface UserPlaybackState {
      userId: string;
      username: string;
      isRequester: boolean;
      status: "unplayed" | "in_progress" | "completed";
      progressPercent: number;
      lastPlayedDate?: string;
    }

    export interface AuditMediaItem {
      id: string; // Seerr request ID or composite
      tmdbId: number;
      title: string;
      year?: number;
      mediaType: "movie" | "tv";
      posterPath?: string;
      sizeBytes?: number;
      requester: {
        id: number;
        username: string;
        avatar?: string;
      };
      requesterState: UserPlaybackState;
      householdStates: UserPlaybackState[];
      daysSincePlayed: number | null; // null if unplayed
      conflictStatus: ConflictStatus;
      isWhitelisted: boolean;
    }
    ```

### 3. Conflict Detection Logic
- **Ghost Request (`ghost`)**: Requester playback is `"unplayed"` and item added date > `GHOST_THRESHOLD_DAYS` (default 30 days).
- **Conflict / In Use (`conflict`)**: Non-requester has `"in_progress"` status or `lastPlayedDate` within `CONFLICT_THRESHOLD_DAYS` (default 60 days).
- **Safe to Purge (`safe`)**: Requester completed watching (or abandoned beyond retention window), and no other users have active or recent playback.

### 4. Storage & Persistence
- Simple SQLite or lightweight local JSON store (`data/whitelist.json` or `sqlite3`) tracking whitelisted IDs and audit settings.
- Stored on persistent Docker volume `/app/data`.

### 5. UI Components & Layout
- Framework: Next.js 16 (App Router), Tailwind CSS v4, Base UI / shadcn/ui.
- `src/app/page.tsx`: Audit table with sticky header, high density rows, sorting, filtering, and responsive drawer.
- `src/app/matrix/page.tsx`: 2D Matrix view (rows = requests, columns = Jellyfin users).
- `src/components/media-detail-sheet.tsx`: Sheet drawer displaying full household heatstrip and episode grid for series.

### 6. Cron & Alerts
- Route `src/app/api/cron/route.ts` validates `Authorization: Bearer <CRON_SECRET>`.
- Formats purge candidates and posts embed to `DISCORD_WEBHOOK_URL` if configured.

## Testing Decisions

- **Testing Seam:** High-level execution against `auditMedia()` with mock/stubbed Jellyfin and Seerr API responses.
- **Unit & Integration Suite:**
  - Mock Seerr API payloads (requests with movie/tv TMDB IDs).
  - Mock Jellyfin API payloads (users, items, user data with ticks/completed flags).
  - Assert exact `ConflictStatus` assignments:
    - Requester watched 100%, 0 other users -> `safe`.
    - Requester watched 100%, user B watched 40% yesterday -> `conflict`.
    - Requester unplayed, added 45 days ago -> `ghost`.
    - Whitelisted item -> `isWhitelisted: true`.
- **E2E / CLI Dry-run:**
  - `src/scripts/test-audit.ts` runnable with `tsx` or `node` against live or mock endpoints to verify external system behavior end-to-end.

## Out of Scope

- Direct media file transcoding or storage disk re-partitioning.
- Multi-tenant authentication beyond basic admin password/session (intended for trusted LAN/homelab admin).
- Direct replacement of Overseerr request management (WatchedSeerr audits, does not approve/deny initial requests).
- Plex or Emby support in initial release (Jellyfin-first).

## Further Notes

- Next.js 16 breaking changes observed: ensure standard App Router conventions, avoid deprecated APIs, adhere to Next.js 16 cache semantics.
- Docker container will run standalone mode using Node 20/22 alpine with minimal footprint.
