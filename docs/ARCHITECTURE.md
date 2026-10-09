# Architecture — prok-vacation

Part of the **Prok** suite: independent apps that compose via deep links.

See also: [DEPLOYMENT_TRUENAS.md](./DEPLOYMENT_TRUENAS.md), [PROK_LINKS.md](./PROK_LINKS.md), [CONTENT.md](./CONTENT.md), [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md).

## Guiding principles

1. Works offline after a brief sync (tickets/maps/itinerary).
2. Content updates are **delta** (hash-addressed blobs) — not full re-download.
3. User notes sync like timelog (local-first + outbox + LWW).
4. Peer apps (TimeLog, Money, Immich) are optional; vacation never requires them.
5. Tailscale is the access perimeter; no app auth for MVP.

## High-level

```
Phone PWA
  |  shell (Workbox autoUpdate)
  |  content blobs (Cache Storage, by sha256)
  |  notes/plan (IndexedDB + outbox)
  v
Tailscale → TrueNAS Custom App :8083
  |-- FastAPI: /api/* + static web/dist
  |-- Postgres DB `vacation`
  |-- data/blobs (content-addressed files)
```

## Sync planes

| Plane | Mechanism |
|-------|-----------|
| App shell | vite-plugin-pwa `autoUpdate` |
| Trip content | `GET /api/content/{trip}/manifest` + `GET /api/content/blobs/{sha256}` |
| Notes / plan / links | `POST /api/sync/push`, `GET /api/sync/pull?since=` |

## Repo layout

| Path | Role |
|------|------|
| `web/` | Vite React PWA |
| `server/` | FastAPI |
| `db/migrations/` | SQL migrations |
| `content/inbox/` | Drop tickets/maps before convert |
| `content/trips/<slug>/` | Published packs + manifest |
| `content/scripts/build-pack.mjs` | Hash → `data/blobs` + manifest |
| `docs/` | Ops docs |

## Multi-trip

`trip` rows in Postgres (seeded from filesystem packs). UI trip picker selects active trip; content sync is per-trip.
