# TrueNAS SCALE — deploy prok-vacation

Postgres stays your **existing** Postgres app. Create a **new database** named `vacation` (do not put vacation tables inside `timelog`).

This container is **FastAPI + the built PWA** on port **8083** (8080/8082 are typically TimeLog).

**Perimeter:** Tailscale only — do **not** publish port 8083 to the public Internet.

---

## One-time: create the database

On the Postgres host (SSH / psql):

```bash
psql -h 127.0.0.1 -U prok -d postgres -c "CREATE DATABASE vacation OWNER prok;"
```

---

## Image source

| Mode | Repository | Tag |
|------|------------|-----|
| Auto from GitHub Actions | `ghcr.io/igorprokopiv-ship-it/prok-vacation` | `latest` |
| Build on NAS | `prok-vacation` | `latest` |

Pipeline: **git push → Actions builds image → private GHCR → TrueNAS pulls → restart app.**

Workflow: [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)

| Trigger | Result |
|---------|--------|
| Push to `main` | Bump patch in `package.json` / `web/package.json` (e.g. `0.1.0` → `0.1.1`), push that commit with `[skip ci]`, then build + push `:latest`, `:<version>`, and git sha tags |
| **Actions → Run workflow** | Same bump + build (manual redeploy) |

After green CI: TrueNAS → Apps → **prok-vacation** → Edit → ensure **Pull Policy = Always pull image** → Save / restart. With “only if not present”, `:latest` stays forever on the first digest pulled.

First-time: merge workflow + Dockerfile to `main`, wait for **Build and publish image**, then configure Custom App (below).

### GHCR credentials

Same pattern as prok-timelog: PAT with `read:packages`, register `ghcr.io` in TrueNAS Apps registry credentials.

---

## Custom App fields

| Field | Value |
|-------|--------|
| Application Name | `prok-vacation` |
| Repository | `ghcr.io/igorprokopiv-ship-it/prok-vacation` |
| Tag | `latest` (or a semver tag like `0.1.2` after CI bumps) |
| **Pull Policy** | **Always pull image** — required with `:latest`. If set to “only if not present”, TrueNAS keeps the cached image and never picks up new pushes |
| **Host Network** | **checked** |
| Restart Policy | Unless Stopped |
| Timezone | `America/New_York` |

After a green **Build and publish image** run: Edit App → save (or Stop/Start) so the new digest is pulled. Confirm the subtle `vX.Y.Z` under the Sync chip matches the version CI just published.

### Environment

| Name | Value |
|------|--------|
| `DATABASE_URL` | `postgresql://prok:YOUR_PASSWORD@127.0.0.1:5432/vacation` |
| `ADMIN_PASSWORD` | strong password — unlocks in-app CMS (events/tickets/maps/guides) |
| `ADMIN_SESSION_SECRET` | long random string (optional; defaults to `ADMIN_PASSWORD`) |
| `PROK_TIMELOG_BASE` | `http://admin.prok:8080` |
| `PROK_MONEY_BASE` | `http://admin.prok:8081` |
| `PROK_IMMICH_BASE` | `http://admin.prok:30041` |

**Host-path mounts** (required for admin CMS writes to persist across image updates):

| Host path | Container path |
|-----------|----------------|
| `/mnt/Programs/Apps/ProkVacation/content` | `/app/content` |
| `/mnt/Programs/Apps/ProkVacation/blobs` | `/app/data/blobs` |
| `/mnt/Programs/Apps/ProkVacation/web-public-images` | `/app/web/public/images` |

---

## Access

- App: `http://admin.prok:8083` (or your Pihole/proxy hostname)
- Health: `GET /api/health`
- After deploy: open once on Wi‑Fi → **Add to Home Screen** → tap Sync chip to pull content deltas

---

## Option B — Build on NAS

```bash
cd /mnt/Programs/Apps/ProkVacation
sudo git clone https://github.com/igorprokopiv-ship-it/prok-vacation.git .
# later:
sudo git pull
sudo docker build -t prok-vacation:latest .
```

Custom App image = `prok-vacation:latest`, pull policy never / local only.

---

## Upgrades

TrueNAS does not auto-redeploy. After CI is green: update/restart the Custom App so it re-pulls `latest`. Phones pick up the new shell via PWA `autoUpdate`; trip media arrives via content-hash delta sync.
