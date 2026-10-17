import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import path from "path"
import fs from "fs"

const DATA_DIR = path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "watchedseerr.db")

let sqliteInstance: InstanceType<typeof Database> | null = null

function getSqliteInstance() {
  if (!sqliteInstance) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    sqliteInstance = new Database(DB_PATH)
    sqliteInstance.pragma("journal_mode = WAL")

    sqliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS whitelist (
        id TEXT PRIMARY KEY NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        media_type TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_items INTEGER NOT NULL,
        safe_count INTEGER NOT NULL,
        conflict_count INTEGER NOT NULL,
        ghost_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)
  }
  return sqliteInstance
}

export const db = drizzle(getSqliteInstance(), { schema })
