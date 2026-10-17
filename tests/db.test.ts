import { describe, it } from "node:test"
import assert from "node:assert/strict"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { whitelist, auditLogs } from "../db/schema"
import { eq } from "drizzle-orm"

describe("Drizzle ORM & Better-SQLite3 Seam", () => {
  function setupTestDb() {
    const sqlite = new Database(":memory:")
    const db = drizzle(sqlite)

    sqlite.exec(`
      CREATE TABLE whitelist (
        id TEXT PRIMARY KEY NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        media_type TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_items INTEGER NOT NULL,
        safe_count INTEGER NOT NULL,
        conflict_count INTEGER NOT NULL,
        ghost_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)

    return { sqlite, db }
  }

  it("inserts and queries whitelisted media items", () => {
    const { db } = setupTestDb()

    db.insert(whitelist)
      .values({
        id: "req-1-tmdb-157336",
        tmdbId: 157336,
        title: "Interstellar",
        mediaType: "movie",
        reason: "Never delete",
        createdAt: new Date(),
      })
      .run()

    const rows = db.select().from(whitelist).all()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].title, "Interstellar")
    assert.equal(rows[0].mediaType, "movie")
  })

  it("deletes items from whitelist correctly", () => {
    const { db } = setupTestDb()

    db.insert(whitelist)
      .values({
        id: "req-2-tmdb-94605",
        tmdbId: 94605,
        title: "Arcane",
        mediaType: "tv",
        createdAt: new Date(),
      })
      .run()

    db.delete(whitelist).where(eq(whitelist.id, "req-2-tmdb-94605")).run()

    const rows = db.select().from(whitelist).all()
    assert.equal(rows.length, 0)
  })

  it("stores audit logs summaries", () => {
    const { db } = setupTestDb()

    db.insert(auditLogs)
      .values({
        totalItems: 42,
        safeCount: 12,
        conflictCount: 5,
        ghostCount: 2,
        createdAt: new Date(),
      })
      .run()

    const logs = db.select().from(auditLogs).all()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].totalItems, 42)
  })
})
