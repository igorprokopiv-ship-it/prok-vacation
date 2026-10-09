# Content packs & delta sync

## In-app admin CMS (preferred)

1. Set `ADMIN_PASSWORD` in `.env` (see `.env.example`).
2. On a phone/browser, unlock admin (lock icon) with that password.
3. Trip list (admin): create vacation, rename, change start date, soft-delete (type title to confirm).
4. Day drawer (admin): add/remove days; edit city, headline, briefing; upload/paste/remove day hero photo.
5. On Schedule: Manage sheet for edit/delete/highlight, attachments, and option branches; reader keeps Ticket/Map/Guide only.
6. On Highlights: Briefing, Main attractions (non-meal highlights), Food focus (highlighted meals) — same for every day type.
7. Writes update `content/trips/<slug>/*.json` + `web/public/images/…`, rebuild the pack manifest, and bump `content_version` so phones delta-sync. Soft-deleted trips set `record_status: deleted` and disappear from `GET /api/trips`.

Ticket / Map / Guide actions only appear for readers when content exists.

## Batch seed from TMP

```bash
# PDFs in ./TMP named "YYYY-MM-DD - Name.pdf" (maps end with " Map")
node content/scripts/seed-from-tmp.mjs
npm run build:pack
```

Requires Python `pypdfium2` + `pillow` for PDF→JPEG.

## Offline / git authoring

1. Drop raw PDFs into [`content/inbox/`](../content/inbox/README.md).
2. Convert to JPEG pages under `web/public/images/tickets|maps/<id>/`.
3. Attach on stops via `tickets` / `mapPages` / `guideIds` in `itinerary.json` (and guides in `sites.json`).
4. Rebuild:

```bash
npm run build:pack
# or
node content/scripts/build-pack.mjs eu2026
```

5. Commit JSON + images (not `data/blobs/` — regenerated in CI/Docker).
6. Push → redeploy → phones download **only new hashes**.

## Manifest shape

`content/trips/<slug>/manifest.json`:

```json
{
  "tripId": "…",
  "slug": "eu2026",
  "version": "4bd4b4a6c07f",
  "totalBytes": 32700000,
  "files": [
    { "path": "itinerary.json", "sha256": "…", "bytes": 12345, "kind": "json" },
    { "path": "images/tickets/louvre/ticket-page-1.jpg", "sha256": "…", "bytes": 251170, "kind": "ticket" }
  ]
}
```

## Client behavior

1. `GET /api/content/{tripId}/manifest`
2. For each file, skip if sha already in Cache Storage
3. `GET /api/content/blobs/{sha256}` with immutable caching
4. Materialize trip JSON into IndexedDB for offline use

## Budgets (Phase 4 guidance)

| Guideline | Target |
|-----------|--------|
| Single JPEG page | prefer &lt; 2.5 MB (build-pack / pdftoppm 150 DPI) |
| Full trip pack | aim &lt; 80 MB compressed across all tickets/maps |
| Selective download | sync only trips the user opens |

Large maps (Louvre/Versailles/Pompeii) dominate size — keep DPI modest.
