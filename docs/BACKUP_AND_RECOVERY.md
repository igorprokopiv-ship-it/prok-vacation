# Backup and recovery — prok-vacation

## What to back up

| Asset | Location | How |
|-------|----------|-----|
| Authoritative user + trip metadata | Postgres DB `vacation` | `pg_dump` |
| Content packs (source) | GitHub `prok-vacation` + `content/trips` | git |
| Blob store (derived) | `data/blobs` on NAS volume (if mounted) | rebuild via `build-pack.mjs` or ZFS snapshot |
| Phone IndexedDB | device | re-sync from server after reinstall |

## Daily dump (TrueNAS)

```bash
pg_dump -h 127.0.0.1 -p 5432 -U prok -d vacation -Fc \
  -f /mnt/<pool>/backups/prok-vacation/vacation_$(date +%Y%m%d_%H%M%S).dump
```

Retain: 14 daily / 8 weekly / 6 monthly (same policy as timelog is fine).

## Restore

```bash
createdb -h 127.0.0.1 -U prok vacation_restore_test
pg_restore -h 127.0.0.1 -U prok -d vacation_restore_test --clean --if-exists \
  /mnt/<pool>/backups/prok-vacation/<file>.dump
```

Point `DATABASE_URL` at the restored DB only after verification.

## Text DML snapshot (repo)

Committed under `db/dml/` (trip metadata + `trip_document` text; optional `note` / `plan_item` / `trip_link`). Regenerated with:

```bash
node content/scripts/export-text-dml.mjs
```

Restore after migrations:

```bash
psql "$DATABASE_URL" -f db/dml/20261013_text_snapshot.sql
npm run build:pack   # if content_blob / images are missing
```

Older dated files under `db/dml/` remain as point-in-time backups.

Then restart the server (or hit admin refresh) so `seed_eu2026` / pack sync matches the filesystem.

## Disaster rebuild

1. Recreate DB `vacation`.
2. Deploy container; migrations + EU2026 seed run on startup.
3. Restore `pg_dump` if you need notes/plan_items/trip_links — or apply `db/dml/*_text_snapshot.sql` for text-only recovery.
4. Phones: open app online → Sync chip → content + notes pull.

## UI JSON backup / restore (admin)

From the trip picker (admin unlocked):

- **Export → Backup JSON** downloads `{slug}-backup.json` via `GET /api/admin/trips/{slug}/export`. Contains `trip`, `itinerary`, `sites`, and `assets` (path strings only — no image binaries).
- **Export → Printable PDF** opens a print-styled itinerary; use the browser print dialog and Save as PDF.
- **Import vacation** uploads `.json` (same format) or a historical `.zip` pack via `POST /api/trips/import`.

JSON restore overwrites pack JSON on disk and refreshes the DB document; existing `images/` under that slug are left in place. Ticket/map/photo files are not inside the JSON backup — restore them separately (zip pack, re-upload, or keep the local `images/` tree).

## Historical trip import (zip)

`POST /api/trips/import` with a `.zip` containing `trip.json`, `itinerary.json`, optional `sites.json` / `assets.json` / `images/`. The trip picker **Import vacation** button accepts both `.json` backups and `.zip` packs.
