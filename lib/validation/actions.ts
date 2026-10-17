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
  tvdbId: z.number().int().positive().optional(),
  mediaType: z.enum(["movie", "tv"]).default("movie"),
  target: z.enum(["all", "watched_episodes", "single_episode"]).default("all"),
  episodeFileId: z.number().optional(),
  episodeFileIds: z.array(z.number()).optional(),
})

export type ToggleWhitelistInput = z.infer<typeof toggleWhitelistSchema>
export type DeleteActionInput = z.infer<typeof deleteActionSchema>
