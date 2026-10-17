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

export type ValidatedEnv = z.infer<typeof envSchema>
