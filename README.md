# WatchedSeerr

Media lifecycle auditor cross-referencing Jellyseerr/Overseerr requests with Jellyfin playback history across household members for safe retention triage and disk reclamation.

---

## Key Features

- **Retention Triage**: Automatically categorizes requested media into retention buckets based on playback history across all household members.
- **TV Episode Expansion**: Drill down into TV series seasons and individual episode playback states, quality profiles, and file sizes.
- **Watch Matrix (`/matrix`)**: Grid view visualizing each household member's playback progress per title.
- **Safe Purging & Retention**:
  - **Default**: Unmonitors media in Radarr/Sonarr (preventing re-downloads) and deletes local media/episode files from disk, keeping the unmonitored entry in your library.
  - **Optional**: Complete removal toggle to wipe the entry entirely from Radarr/Sonarr.
  - **Kill-Switch**: `DISABLE_DELETE="true"` disables all purge interactions across the UI and rejects deletion server actions.
- **Whitelist Protection**: Protect specific movies or shows from ever being purged.
- **Automated Discord Alerts**: Headless cron endpoint dispatches audit metric embeds to Discord.

---

## Status Badges

| Badge | Status | Description |
|---|---|---|
| 🟢 | **Safe** | Requester finished viewing (`100%`) or abandoned playback, with no active household viewing. |
| 🔵 | **New** | Recently requested and within the grace threshold; awaiting first watch. |
| 🟡 | **Conflict** | Other household members are actively watching or played the media recently. |
| 🔴 | **Ghost** | Requester never started the media after the threshold window (default: 30 days). |

---

## Stack

- **Framework**: Next.js 16 (App Router, Standalone)
- **Database**: SQLite (`data/watchedseerr.db`) via Drizzle ORM & `better-sqlite3`
- **Table & State**: TanStack Table v8 + Zod
- **Styling & UI**: Tailwind CSS v4 + Base UI

---

## Quickstart

### 1. Install & Configure

```bash
pnpm install
cp .env.example .env.local
```

Configure `.env.local`:

```bash
# Jellyfin (Required)
JELLYFIN_URL="http://localhost:8096"
JELLYFIN_API_KEY="your-jellyfin-token"

# Overseerr / Jellyseerr (Required)
SEERR_URL="http://localhost:5055"
SEERR_API_KEY="your-seerr-token"

# Radarr (Optional - for Movie unmonitoring & file deletions)
RADARR_URL="http://localhost:7878"
RADARR_API_KEY="your-radarr-api-key"

# Sonarr (Optional - for TV series & episode file deletions)
SONARR_URL="http://localhost:8989"
SONARR_API_KEY="your-sonarr-api-key"

# Retention Thresholds (Optional)
GHOST_THRESHOLD_DAYS=30
CONFLICT_THRESHOLD_DAYS=60

# Safety Kill-Switch (Optional - set "true" to disable all purge capabilities)
DISABLE_DELETE="false"

# Automated Cron Security Token (Optional)
CRON_SECRET="your-secure-random-token"

# Discord Webhook Notification (Optional)
DISCORD_WEBHOOK_URL=""
```

### 2. Run

```bash
pnpm dev
# open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JELLYFIN_URL` | Yes | — | Base URL for Jellyfin server. |
| `JELLYFIN_API_KEY` | Yes | — | Jellyfin API token. |
| `SEERR_URL` | Yes | — | Base URL for Jellyseerr / Overseerr. |
| `SEERR_API_KEY` | Yes | — | Jellyseerr / Overseerr API key. |
| `RADARR_URL` | No | — | Radarr server URL (for movie purges). |
| `RADARR_API_KEY` | No | — | Radarr API key. |
| `SONARR_URL` | No | — | Sonarr server URL (for series purges). |
| `SONARR_API_KEY` | No | — | Sonarr API key. |
| `DISABLE_DELETE` | No | `false` | When `true`, completely hides purge buttons and disables deletion endpoints. |
| `GHOST_THRESHOLD_DAYS` | No | `30` | Days of inactivity before an unplayed request becomes a Ghost. |
| `CONFLICT_THRESHOLD_DAYS` | No | `60` | Days of inactivity window considered an active playback conflict. |
| `DISCORD_WEBHOOK_URL` | No | — | Webhook URL for daily audit summary embeds. |
| `CRON_SECRET` | No | — | Bearer token required to trigger `/api/cron`. |
| `PORT` | No | `3000` | Port for the HTTP server. |
| `HOST` | No | `0.0.0.0` | Bind host address. |

---

## Verification & Tests

```bash
# Test audit engine against mock data
pnpm dlx tsx scripts/test-audit.ts

# Run unit tests (Zod schemas & SQLite queries)
pnpm dlx tsx --test tests/*.test.ts
```

---

## Deployment

Full deployment guide: [docs/deployment.md](docs/deployment.md).

### Proxmox VE (Recommended)
Run inside an **unprivileged Docker LXC** (~150MB RAM, clean native SQLite isolation). Avoid running directly on the Proxmox host. See [docs/deployment.md](docs/deployment.md) for automated 1-line LXC setup or baremetal LXC systemd service instructions.

### Docker Compose
```bash
cp .env.example .env
# Edit .env with your configuration
docker compose up -d --build
```
Persists SQLite database to `./data/watchedseerr.db`.

---

## Automated Audit / Cron

Runs headless audit and dispatches Discord webhook embed.

```bash
# Crontab entry (daily at 4 AM)
0 4 * * * curl -s -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
```

See [docs/proxmox-cron.md](docs/proxmox-cron.md) for secret generation and host cron setup.
