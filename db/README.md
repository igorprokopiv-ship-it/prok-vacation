# Database schema (Postgres)

Migrations in [`migrations/`](migrations/) are applied on FastAPI startup when `DATABASE_URL` is set (`server/app.py` → `run_migrations()`).

## Tables

| Table | Purpose |
|-------|---------|
| `schema_migration` | Applied migration filenames |
| `trip` | Trip metadata + `trip_document` JSONB (itinerary, sites/guides, assets index) |
| `content_blob` | Hash-addressed file metadata for pack blobs |
| `trip_content_file` | Pack-relative path → blob per trip |
| `trip_link` | Immich / timelog / money / custom deep links |
| `note` | User notes (optional `day_id` / `stop_id` text refs) |
| `plan_item` | Todos / packing / bookings (`site_id` text ref) |

There are **no** relational `site`, `stop`, or `asset` tables. Guide text and schedule content live in:

- Pack JSON under `content/trips/<slug>/` (`itinerary.json`, `sites.json`, `assets.json`, `trip.json`)
- A denormalized copy in `trip.trip_document`

## Text DML snapshots

See [`dml/`](dml/) for committed text-only backups (`trip` + optional `note` / `plan_item` / `trip_link`). Attachment binaries (`content_blob` / images) are excluded; regenerate via `npm run build:pack`.

```bash
node content/scripts/export-text-dml.mjs
```
