# Proxmox Host / LXC Cron Setup

Trigger daily retention audit from Proxmox host or within an LXC.

### 1. Generate Secret
```bash
openssl rand -hex 24
```
Set `CRON_SECRET="<your-token>"` in `.env.local` or container environment.

---

### 2. Add System Cron Job

Edit root crontab on Proxmox host or LXC:
```bash
crontab -e
```

Add line (runs daily at 04:00 AM):
```bash
0 4 * * * curl -s -X POST http://<CONTAINER_IP>:3000/api/cron -H "Authorization: Bearer <your-token>" > /dev/null
```

Replace:
- `<CONTAINER_IP>`: IP of WatchedSeerr container (or `localhost` if curling inside the same container).
- `<your-token>`: Exact token matching `CRON_SECRET`.

---

### 3. Verify Trigger

Test manually from terminal:
```bash
curl -i -X POST http://<CONTAINER_IP>:3000/api/cron -H "Authorization: Bearer <your-token>"
```

Expected output:
```json
{"status":"success","reportSummary":{"total":12,"safe":3,"conflicts":1,"ghosts":2}}
```
401 Unauthorized returns if token does not match.
