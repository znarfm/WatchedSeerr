import { db } from "@/db"
import { whitelist, type WhitelistItem } from "@/db/schema"
import { eq } from "drizzle-orm"

export function getWhitelistedItems(): WhitelistItem[] {
  try {
    return db.select().from(whitelist).all()
  } catch {
    return []
  }
}

export function isItemWhitelisted(id: string): boolean {
  try {
    const row = db.select().from(whitelist).where(eq(whitelist.id, id)).get()
    return !!row
  } catch {
    return false
  }
}

export function toggleWhitelistItem(params: {
  id: string
  tmdbId: number
  title: string
  mediaType: "movie" | "tv"
  reason?: string
}): boolean {
  const existing = db
    .select()
    .from(whitelist)
    .where(eq(whitelist.id, params.id))
    .get()

  if (existing) {
    db.delete(whitelist).where(eq(whitelist.id, params.id)).run()
    return false
  }

  db.insert(whitelist)
    .values({
      id: params.id,
      tmdbId: params.tmdbId,
      title: params.title,
      mediaType: params.mediaType,
      reason: params.reason,
      createdAt: new Date(),
    })
    .run()

  return true
}
