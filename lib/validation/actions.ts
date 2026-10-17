import { z } from "zod"

export const toggleWhitelistSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive(),
  title: z.string().min(1),
  mediaType: z.enum(["movie", "tv"]),
  reason: z.string().optional(),
})

export const deleteActionSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive(),
})

export type ToggleWhitelistInput = z.infer<typeof toggleWhitelistSchema>
export type DeleteActionInput = z.infer<typeof deleteActionSchema>
