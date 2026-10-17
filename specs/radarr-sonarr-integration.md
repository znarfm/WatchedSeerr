# Specification: Radarr and Sonarr Direct URL and API Key Integration

## Problem Statement

When an administrator reviews media flagged as safe or abandoned in WatchedSeerr and triggers a "Purge Media" action, the system currently only logs the deletion intent to the console. To actually reclaim disk space, the admin must open Radarr or Sonarr separately, search for the movie or series, find the specific files, unmonitor them, and trigger file deletion manually.

This manual step breaks the workflow, invites human error, and prevents automated retention workflows from reclaiming storage.

## Solution

Integrate direct API clients for **Radarr** and **Sonarr** configured via direct URLs and API keys (`RADARR_URL`, `RADARR_API_KEY`, `SONARR_URL`, `SONARR_API_KEY`).

When a purge action is triggered:
- **For Movies (Radarr):** WatchedSeerr looks up the movie by TMDB ID, unmonitors the movie, and deletes the movie file(s) from disk via the Radarr API (`DELETE /api/v3/movie/{id}?deleteFiles=true`).
- **For TV Series (Sonarr):** WatchedSeerr looks up the series by TVDB/TMDB ID, identifies either the entire series or specific watched/stale episodes, unmonitors the targeted episodes, and deletes episode files from disk via Sonarr API (`DELETE /api/v3/episodefile/{id}`).

## User Stories

1. As a media server admin, I want to configure `RADARR_URL` and `RADARR_API_KEY` in `.env.local` so that WatchedSeerr can communicate directly with Radarr.
2. As a media server admin, I want to configure `SONARR_URL` and `SONARR_API_KEY` in `.env.local` so that WatchedSeerr can communicate directly with Sonarr.
3. As a media server admin, I want Radarr and Sonarr environment variables validated with Zod at runtime with optional fallback so that missing Arr configs don't break non-purge audit features.
4. As a media server admin, I want clicking "Purge Media" on a movie to delete the movie file from disk via Radarr and set it to unmonitored so that Radarr does not immediately re-download it.
5. As a media server admin, I want to choose whether to delete the entire series or only watched/stale episodes when purging a TV show so that I do not delete episodes others are still waiting to watch.
6. As a media server admin, I want episode file deletions in Sonarr to unmonitor deleted episodes while keeping unwatched or upcoming episodes monitored.
7. As a media server admin, I want clear feedback in the UI showing the result of the Radarr/Sonarr purge (e.g. "Deleted Interstellar (2.4 GB) via Radarr") so that I have immediate confirmation.
8. As a media server admin, I want purge errors (e.g. movie not found in Radarr, invalid API key, network timeout) caught and returned as user-friendly messages rather than crashing the page.
9. As a media server admin, I want a dry-run test script (`scripts/test-arr.ts`) to verify Radarr and Sonarr connectivity and query operations without accidentally deleting live files.

## Implementation Decisions

### 1. Architectural Seams & Boundaries
- **Primary Arr Client Seams (`lib/clients/radarr.ts` and `lib/clients/sonarr.ts`)**:
  - `RadarrClient`:
    - `getMovieByTmdbId(tmdbId: number): Promise<RadarrMovie | null>`
    - `deleteMovie(radarrId: number, deleteFiles: boolean): Promise<boolean>`
    - `unmonitorMovie(radarrId: number): Promise<boolean>`
  - `SonarrClient`:
    - `getSeriesByTvdbId(tvdbId: number): Promise<SonarrSeries | null>`
    - `getSeriesByTmdbId(tmdbId: number): Promise<SonarrSeries | null>`
    - `getEpisodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]>`
    - `deleteEpisodeFile(episodeFileId: number): Promise<boolean>`
    - `unmonitorEpisode(episodeId: number): Promise<boolean>`
    - `deleteSeries(sonarrId: number, deleteFiles: boolean): Promise<boolean>`
- **Server Action Seam (`lib/actions.ts`)**:
  - `deleteMediaAction(input: DeleteActionInput)`:
    - Parses input schema with Zod.
    - Routes to `RadarrClient` for movies or `SonarrClient` for TV shows.
    - Updates local database / triggers revalidation.

### 2. Environment Schema Updates (`lib/validation/env.ts`)
```ts
export const envSchema = z.object({
  JELLYFIN_URL: z.string().url(),
  JELLYFIN_API_KEY: z.string().min(1),
  SEERR_URL: z.string().url(),
  SEERR_API_KEY: z.string().min(1),
  // Direct Arr integrations (optional)
  RADARR_URL: z.string().url().optional().or(z.literal("")),
  RADARR_API_KEY: z.string().optional(),
  SONARR_URL: z.string().url().optional().or(z.literal("")),
  SONARR_API_KEY: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  CRON_SECRET: z.string().min(1).optional(),
  GHOST_THRESHOLD_DAYS: z.coerce.number().default(30),
  CONFLICT_THRESHOLD_DAYS: z.coerce.number().default(60),
})
```

### 3. Server Action Payload (`lib/validation/actions.ts`)
```ts
export const deleteActionSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive(),
  tvdbId: z.number().int().positive().optional(),
  mediaType: z.enum(["movie", "tv"]),
  // TV options: delete full series or specific episode file IDs
  target: z.enum(["all", "watched_episodes"]).default("all"),
  episodeFileIds: z.array(z.number()).optional(),
})
```

### 4. Sonarr & Radarr Direct API Contracts
- Headers: `X-Api-Key: <RADARR_API_KEY>` or `X-Api-Key: <SONARR_API_KEY>`.
- **Radarr Query**: `GET /api/v3/movie?tmdbId={tmdbId}`.
- **Radarr Delete**: `DELETE /api/v3/movie/{id}?deleteFiles=true&addImportExclusion=false`.
- **Sonarr Query**: `GET /api/v3/series` (filter by `tmdbId` / `tvdbId`).
- **Sonarr Episode Delete**: `DELETE /api/v3/episodefile/{id}`.
- **Sonarr Episode Unmonitor**: `PUT /api/v3/episode/monitor` with `{ episodeIds: [...], monitored: false }`.

## Testing Decisions

- **Client Seams Unit Testing (`tests/arr-clients.test.ts`)**:
  - Test `RadarrClient` and `SonarrClient` using mocked `fetch` dispatchers.
  - Verify query URL format, header injection, TMDB ID lookup, and delete payloads.
  - Verify error handling when Radarr/Sonarr is unreachable or returns 404/401.
- **Server Action Seam Testing (`tests/actions.test.ts`)**:
  - Verify `deleteMediaAction` parses input with Zod, invokes the correct Arr client based on `mediaType`, and returns typed success/failure results.

## Out of Scope

- Modifying Radarr/Sonarr quality profiles, root folders, or download clients.
- Handling torrent/usenet client direct deletions (Radarr/Sonarr handle disk file deletion directly).
- Multi-instance routing beyond the primary configured Radarr & Sonarr URLs.

## Further Notes

- Radarr & Sonarr v3/v4 API endpoints share identical standard headers and REST semantics.
- Standalone CLI runner `scripts/test-arr.ts` will allow verifying API connectivity against live instances before triggering deletions in the UI.
