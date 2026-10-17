# WatchedSeerr

Media lifecycle auditor cross-referencing Jellyseerr/Overseerr requests with Jellyfin playback history for safe retention triage.

## Stack
- Next.js 16 (App Router, Standalone)
- Drizzle ORM + Better-SQLite3
- TanStack Table v8 + Zod
- Tailwind CSS v4 + Base UI

## Status Badges
- 🟢 **Safe:** Requester watched 100%, 0 active household playback.
- 🟡 **Conflict:** Non-requesters currently watching or played recently.
- 🔴 **Ghost:** Requester never started item after threshold (default: 30 days).

---

## Quickstart

### 1. Install & Configure
```bash
pnpm install
cp .env.example .env.local
```

Edit `.env.local`:
```bash
JELLYFIN_URL="http://localhost:8096"
JELLYFIN_API_KEY="your-jellyfin-token"
SEERR_URL="http://localhost:5055"
SEERR_API_KEY="your-seerr-token"
```

### 2. Run
```bash
pnpm dev
# open http://localhost:3000
```

---

## Verification & Tests
```bash
# Test audit engine against mock data
pnpm dlx tsx scripts/test-audit.ts

# Run unit tests (Zod schemas & SQLite queries)
pnpm dlx tsx --test tests/db.test.ts tests/validation.test.ts
```

---

## Docker Deployment
```bash
docker compose up -d --build
```
Persists SQLite database to `./data/watchedseerr.db`.

---

## Automated Audit / Cron
Runs headless audit and dispatches Discord webhook embed.
```bash
# Proxmox / crontab entry (daily at 4 AM)
0 4 * * * curl -s -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
```
See [docs/proxmox-cron.md](docs/proxmox-cron.md) for host setup.
