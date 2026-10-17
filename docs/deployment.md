# Deployment Guide

Deployment instructions for WatchedSeerr, optimized for home servers running Proxmox VE.

---

## Proxmox Recommendation: Docker inside LXC

**Verdict**: Deploy via **Docker in an unprivileged LXC** (or existing Docker VM/LXC).

| Approach | Verdict | Why |
| :--- | :--- | :--- |
| **Docker in LXC** | **Recommended** | ~150MB RAM footprint, near-zero CPU overhead, reproducible builds, isolates `better-sqlite3` native compilation, zero Proxmox host pollution. |
| **Native LXC (Systemd)** | Alternative | Lightweight, but requires managing Node 22, pnpm, build toolchains, and systemd units manually inside the container. |
| **Full VM** | Overkill | Wastes 1–2 GB RAM and disk overhead just for OS kernel virtualization. |
| **Baremetal PVE Host** | **Avoid** | Never install Docker or app runtimes directly on Proxmox VE host OS. |

---

## Method 1: Docker LXC (Recommended)

### 1. Provision Docker LXC in Proxmox

If you don't already have an LXC running Docker:

**Automated (PVE Shell)**:
```bash
# Run in Proxmox host shell (Debian 12 + Docker + Compose)
bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/docker.sh)"
```

**Manual (PVE Web UI / CLI)**:
- **Template**: Debian 12 (bookworm) standard.
- **Resources**: 1 vCPU, 1024 MB RAM, 8 GB disk.
- **Unprivileged**: Yes.
- **Features**: Enable `keyctl=1` and `nesting=1` (Options -> Features -> Nesting & Keyctl).

Inside the LXC, install Docker & Compose:
```bash
apt update && apt install -y curl git
curl -fsSL https://get.docker.com | sh
```

### 2. Clone & Configure WatchedSeerr

Inside the Docker LXC:

```bash
git clone https://github.com/your-username/WatchedSeerr.git /opt/watchedseerr
cd /opt/watchedseerr
cp .env.example .env
```

Edit `.env`:
```bash
nano .env
```
Fill in service endpoints and API keys:
```env
JELLYFIN_URL="http://192.168.1.100:8096"
JELLYFIN_API_KEY="your_jellyfin_token"
SEERR_URL="http://192.168.1.100:5055"
SEERR_API_KEY="your_seerr_token"

# Optional integrations
RADARR_URL="http://192.168.1.100:7878"
RADARR_API_KEY=""
SONARR_URL="http://192.168.1.100:8989"
SONARR_API_KEY=""
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Cron authentication token
CRON_SECRET="$(openssl rand -hex 24)"
```

### 3. Start Container

```bash
docker compose up -d --build
```

Container runs on port `3000`. Access at `http://<LXC_IP>:3000`.

---

## Method 2: Native LXC (Systemd, No Docker)

For running baremetal Node.js without container nesting.

### 1. Prepare Debian 12 LXC
- Unprivileged Debian 12 container (1 vCPU, 512–1024 MB RAM, 8 GB disk).

Inside LXC:
```bash
apt update && apt install -y curl git build-essential python3
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable && corepack prepare pnpm@latest --activate
```

### 2. Install & Build

```bash
git clone https://github.com/your-username/WatchedSeerr.git /opt/watchedseerr
cd /opt/watchedseerr
pnpm install --frozen-lockfile
cp .env.example .env.local
nano .env.local
pnpm build
```

### 3. Create Systemd Service

Create `/etc/systemd/system/watchedseerr.service`:
```ini
[Unit]
Description=WatchedSeerr Media Lifecycle Auditor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/watchedseerr
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
EnvironmentFile=/opt/watchedseerr/.env.local
ExecStart=/usr/bin/node /opt/watchedseerr/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
systemctl daemon-reload
systemctl enable --now watchedseerr
```

Check status:
```bash
systemctl status watchedseerr
```

---

## Persistence & Backups

SQLite database is located at `./data/watchedseerr.db`.
- **Docker**: Bound to host directory `/opt/watchedseerr/data`.
- **Backups**: Include `/opt/watchedseerr/data` in backups or schedule Proxmox snapshot/vzdump backups of the LXC. WAL mode is enabled, ensuring safe concurrent reads.

---

## Automated Retention Audits

Scheduled execution runs headless audits and posts Discord summaries.

Add crontab entry (Proxmox host or within LXC):
```bash
0 4 * * * curl -s -X POST http://localhost:3000/api/cron -H "Authorization: Bearer <CRON_SECRET>" > /dev/null
```

Detailed setup instructions: [docs/proxmox-cron.md](proxmox-cron.md).

---

## Updating

### Docker
```bash
cd /opt/watchedseerr
git pull
docker compose up -d --build
```

### Native LXC
```bash
cd /opt/watchedseerr
git pull
pnpm install --frozen-lockfile
pnpm build
systemctl restart watchedseerr
```
