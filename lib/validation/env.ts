import { z } from "zod"

export const envSchema = z.object({
  JELLYFIN_URL: z.string().url(),
  JELLYFIN_API_KEY: z.string().min(1),
  SEERR_URL: z.string().url(),
  SEERR_API_KEY: z.string().min(1),
  RADARR_URL: z.string().url().optional().or(z.literal("")),
  RADARR_API_KEY: z.string().optional().or(z.literal("")),
  SONARR_URL: z.string().url().optional().or(z.literal("")),
  SONARR_API_KEY: z.string().optional().or(z.literal("")),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  CRON_SECRET: z.string().min(1).optional(),
  GHOST_THRESHOLD_DAYS: z.coerce.number().default(30),
  CONFLICT_THRESHOLD_DAYS: z.coerce.number().default(60),
  DISABLE_DELETE: z
    .preprocess((val) => {
      if (typeof val === "string") {
        return ["true", "1", "yes", "on"].includes(val.toLowerCase().trim())
      }
      return Boolean(val)
    }, z.boolean())
    .default(false),
})

export type ValidatedEnv = z.infer<typeof envSchema>
