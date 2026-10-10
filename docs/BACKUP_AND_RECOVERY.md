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
psql "$DATABASE_URL" -f db/dml/20261009_text_snapshot.sql
npm run build:pack   # if content_blob / images are missing
```

Then restart the server (or hit admin refresh) so `seed_eu2026` / pack sync matches the filesystem.

## Disaster rebuild

1. Recreate DB `vacation`.
2. Deploy container; migrations + EU2026 seed run on startup.
3. Restore `pg_dump` if you need notes/plan_items/trip_links — or apply `db/dml/*_text_snapshot.sql` for text-only recovery.
4. Phones: open app online → Sync chip → content + notes pull.

## Historical trip import

`POST /api/trips/import` with a `.zip` containing `trip.json`, `itinerary.json`, optional `sites.json` / `assets.json` / `images/`. See Phase 4 UI button **Import historical trip pack**.
