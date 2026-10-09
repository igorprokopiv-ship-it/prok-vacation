# Content packs & delta sync

## Authoring

1. Drop raw PDFs into [`content/inbox/`](../content/inbox/README.md).
2. Convert to JPEG pages under `web/public/images/tickets|maps/<site-id>/`.
3. Update `assets.json` in the trip pack (`content/trips/<slug>/` and `web/src/data/` for EU2026).
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
