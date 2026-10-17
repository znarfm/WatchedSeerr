import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { envSchema } from "../lib/validation/env"
import { toggleWhitelistSchema } from "../lib/validation/actions"

describe("Zod Validation Seam", () => {
  it("validates correct environment variables and applies defaults", () => {
    const validEnv = {
      JELLYFIN_URL: "http://localhost:8096",
      JELLYFIN_API_KEY: "secret-jellyfin-token",
      SEERR_URL: "http://localhost:5055",
      SEERR_API_KEY: "secret-seerr-token",
    }

    const result = envSchema.safeParse(validEnv)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.GHOST_THRESHOLD_DAYS, 30)
      assert.equal(result.data.CONFLICT_THRESHOLD_DAYS, 60)
    }
  })

  it("fails when required environment variables are invalid", () => {
    const invalidEnv = {
      JELLYFIN_URL: "not-a-valid-url",
      JELLYFIN_API_KEY: "",
      SEERR_URL: "http://localhost:5055",
      SEERR_API_KEY: "secret",
    }

    const result = envSchema.safeParse(invalidEnv)
    assert.equal(result.success, false)
  })

  it("validates server action whitelist payloads", () => {
    const validAction = {
      id: "req-101-tmdb-157336",
      tmdbId: 157336,
      title: "Interstellar",
      mediaType: "movie",
      reason: "Family classic",
    }

    const result = toggleWhitelistSchema.safeParse(validAction)
    assert.equal(result.success, true)

    const invalidAction = {
      id: "",
      tmdbId: -1,
      mediaType: "invalid-type",
    }
    const failResult = toggleWhitelistSchema.safeParse(invalidAction)
    assert.equal(failResult.success, false)
  })
})
