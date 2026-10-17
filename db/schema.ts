import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const whitelist = sqliteTable("whitelist", {
  id: text("id").primaryKey(), // Composite: req-{reqId}-tmdb-{tmdbId}
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

export type WhitelistItem = typeof whitelist.$inferSelect
export type NewWhitelistItem = typeof whitelist.$inferInsert
export type AuditLogEntry = typeof auditLogs.$inferSelect
export type NewAuditLogEntry = typeof auditLogs.$inferInsert
