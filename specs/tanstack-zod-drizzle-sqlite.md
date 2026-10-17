# Specification: Integration of TanStack Table, Zod, Drizzle ORM, and Better-SQLite3

## Problem Statement

WatchedSeerr currently relies on in-memory mapping with a naive JSON file (`data/whitelist.json`) for persistence, lacks strict schema validation for external APIs (Jellyfin and Seerr responses) and environment variables, and manages table filtering and sorting via custom hand-rolled state in React.

As media libraries scale to thousands of items:
1. Flat JSON file persistence lacks atomic updates, relational constraints, indexing, and audit history.
2. Unvalidated external API payloads (Jellyfin / Seerr) create runtime failures when fields are missing or formats change between server versions.
3. Custom table state logic becomes unwieldy when adding multi-column sorting, pagination, column visibility, and complex filtering.

## Solution

Upgrade WatchedSeerr's data layer, validation, and table presentation by integrating:
- **Drizzle ORM & Better-SQLite3**: Robust local embedded SQLite database for persisting whitelisted items, audit snapshots, audit overrides, and system settings.
- **Zod**: Type-safe runtime boundary validation for environment variables, Seerr API responses, Jellyfin API responses, and Server Action payloads.
- **TanStack Table (React Table v8)**: Headless, high-performance table engine powering the audit queue with column sorting, global and faceted filtering, pagination, and row selection.

## User Stories

1. As a media server admin, I want all environment variables validated with Zod at startup so that missing API keys or invalid URLs produce clear, actionable error messages immediately.
2. As a media server admin, I want all responses from Jellyfin and Seerr validated against Zod schemas so that unexpected API response shapes fail gracefully without crashing the app.
3. As a media server admin, I want media whitelist records persisted in a local SQLite database via Drizzle ORM so that whitelisted media status is safe, transactional, and survives container restarts.
4. As a media server admin, I want to record an optional reason and timestamp when whitelisting an item so that I remember why an item is permanently retained.
5. As a media server admin, I want audit run summaries logged to the database so that I can see the historical progression of reclaimed space and retention stats over time.
6. As a media server admin, I want to sort the audit queue by title, year, requester progress %, inactivity duration, and conflict status using TanStack Table column headers so that I can quickly triage the most urgent cleanup candidates.
7. As a media server admin, I want to filter the table simultaneously by media type (Movie/TV), retention status (Safe, Conflict, Ghost), and whitelisted state so that I can isolate exact subsets of media.
8. As a media server admin, I want paginated navigation with configurable page size (25, 50, 100 rows) so that large libraries remain snappy and responsive.
9. As a media server admin, I want a global search input powered by TanStack Table that matches across titles, requester usernames, and TMDB IDs.
10. As a media server admin, I want row selection checkboxes so that I can batch-whitelist or batch-purge multiple items at once.
11. As a media server admin, I want column visibility controls so that I can customize my view for compact or detailed displays.
12. As a media server admin, I want Server Action inputs validated by Zod before executing whitelist or purge operations so that malformed requests are rejected with typed validation errors.
13. As a developer, I want Drizzle migrations managed via Drizzle Kit so that future database schema changes can be applied cleanly without data loss.

## Implementation Decisions

### 1. Architectural Seams & Boundaries
- **Primary Data Seam: `src/db/index.ts` & `src/db/schema.ts`**:
  - Encapsulates better-sqlite3 connection and Drizzle ORM instance.
  - Exposes typed query helpers for whitelist and audit log operations.
- **Validation Seam: `src/lib/validation/*.ts`**:
  - Environment schema (`envSchema`) loaded safely in Next.js config / runtime.
  - API schemas: `seerrResponseSchema`, `jellyfinUserSchema`, `jellyfinItemSchema`.
  - Action schemas: `whitelistActionSchema`, `deleteActionSchema`.
- **UI Table Seam: `src/components/audit-table/`**:
  - `columns.tsx`: TanStack Table column definitions with typed sorting, headers, cell renderers, and row selection.
  - `data-table.tsx`: Generic headless table component consuming `useReactTable` with shadcn UI table primitives, pagination, and filter toolbars.

### 2. Database Schema (Drizzle ORM + Better-SQLite3)
Stored in local SQLite database at `data/watchedseerr.db`:
```ts
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const whitelist = sqliteTable("whitelist", {
  id: text("id").primaryKey(), // composite: req-{reqId}-tmdb-{tmdbId}
  tmdbId: integer("tmdb_id").notNull(),
  title: text("title").notNull(),
  mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalItems: integer("total_items").notNull(),
  safeCount: integer("safe_count").notNull(),
  conflictCount: integer("conflict_count").notNull(),
  ghostCount: integer("ghost_count").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
```

### 3. Zod Schema Validation
```ts
// src/lib/validation/env.ts
import { z } from "zod"

export const envSchema = z.object({
  JELLYFIN_URL: z.string().url(),
  JELLYFIN_API_KEY: z.string().min(1),
  SEERR_URL: z.string().url(),
  SEERR_API_KEY: z.string().min(1),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  CRON_SECRET: z.string().min(1).optional(),
  GHOST_THRESHOLD_DAYS: z.coerce.number().default(30),
  CONFLICT_THRESHOLD_DAYS: z.coerce.number().default(60),
})

// src/lib/validation/actions.ts
export const toggleWhitelistSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive(),
  title: z.string().min(1),
  mediaType: z.enum(["movie", "tv"]),
  reason: z.string().optional(),
})
```

### 4. TanStack Table Integration
- Replace hand-rolled state in `components/audit-table.tsx` with `@tanstack/react-table`.
- Use `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, and `getPaginationRowModel`.
- Table controls:
  - Column header sorting with asc/desc indicators.
  - Multi-row selection with bulk actions (Bulk Whitelist, Bulk Purge).
  - Faceted filters for `conflictStatus` and `mediaType`.
  - Pagination controls (`Previous`, `Next`, page jump, page size select).

## Testing Decisions

- **Database Operations Seam:** Test Drizzle ORM operations against an in-memory SQLite database (`:memory:`) to verify whitelist insertion, duplicate handling, deletion, and retrieval.
- **Validation Seam:** Test Zod parsing against valid and invalid payloads (missing env vars, unexpected Jellyfin/Seerr API JSON shapes, invalid Server Action parameters).
- **Core Audit Seam:** Verify `auditMedia()` continues returning expected `AuditReport` models while reading whitelisted states from Drizzle SQLite instead of flat JSON.
- **Table Seam:** Component-level testing for table column rendering and state mutations.

## Out of Scope

- Remote PostgreSQL or MySQL database drivers (Better-SQLite3 is self-hosted homelab standard).
- User authentication and role-based permissions in SQLite (single-tenant homelab tool).
- Bi-directional sync back to Seerr request approvals.

## Further Notes

- Next.js 16 App Router & Server Actions: Ensure Better-SQLite3 native bindings compile cleanly in standalone Docker builds by including `libc6-compat` and `python3 make g++` if needed.
- Better-SQLite3 runs synchronously in Node.js server components and server actions with minimal overhead.
