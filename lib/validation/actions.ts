import { z } from "zod"

export const toggleWhitelistSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive(),
  title: z.string().min(1),
  mediaType: z.enum(["movie", "tv"]),
  reason: z.string().optional(),
})

export const deleteActionSchema = z
  .object({
    id: z.string().min(1),
    tmdbId: z.number().int().positive(),
    tvdbId: z.number().int().positive().optional(),
    mediaType: z.enum(["movie", "tv"]).default("movie"),
    target: z.enum(["all", "watched_episodes", "single_episode"]).default("all"),
    episodeFileId: z.number().optional(),
    episodeFileIds: z.array(z.number()).optional(),
    removeFromLibrary: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.mediaType === "movie") {
      if (
        data.target === "single_episode" ||
        data.target === "watched_episodes"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Episode targets are not supported for movie mediaType",
          path: ["target"],
        })
      }
    }
    if (data.mediaType === "tv") {
      if (data.target === "single_episode" && !data.episodeFileId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "episodeFileId is required when target is single_episode",
          path: ["episodeFileId"],
        })
      }
      if (
        data.target === "watched_episodes" &&
        (!data.episodeFileIds || data.episodeFileIds.length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "episodeFileIds array is required when target is watched_episodes",
          path: ["episodeFileIds"],
        })
      }
    }
  })

export const getSeriesEpisodesSchema = z.object({
  jellyfinItemId: z.string().min(1),
  seriesTmdbId: z.number().int().positive(),
  userId: z.string().optional(),
  householdUsers: z
    .array(
      z.object({
        userId: z.string(),
        username: z.string(),
        avatarUrl: z.string().optional(),
      })
    )
    .optional(),
  requesterUsername: z.string().optional(),
})

export type ToggleWhitelistInput = z.infer<typeof toggleWhitelistSchema>
export type DeleteActionInput = z.infer<typeof deleteActionSchema>
export type GetSeriesEpisodesInput = z.infer<typeof getSeriesEpisodesSchema>
