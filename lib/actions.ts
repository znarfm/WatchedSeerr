"use server"

import { revalidatePath } from "next/cache"
import { toggleWhitelistItem } from "@/lib/whitelist"
import { toggleWhitelistSchema, deleteActionSchema } from "@/lib/validation/actions"

export async function toggleWhitelistAction(input: unknown) {
  const parsed = toggleWhitelistSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.format() }
  }

  const isWhitelisted = toggleWhitelistItem(parsed.data)
  revalidatePath("/")
  revalidatePath("/matrix")
  return { success: true, isWhitelisted }
}

export async function deleteMediaAction(input: unknown) {
  const parsed = deleteActionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.format() }
  }

  console.log(`[WatchedSeerr] Purged media: ${parsed.data.id} (TMDB ${parsed.data.tmdbId})`)
  revalidatePath("/")
  revalidatePath("/matrix")
  return { success: true, purgedId: parsed.data.id }
}
