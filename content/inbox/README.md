# Content inbox — tickets & maps

Prefer the **in-app admin CMS** (lock icon → password) to upload tickets/maps/guides.

For batch offline seeding, drop PDFs here or into repo-root `TMP/` and run:

```bash
npm run seed:tmp
npm run build:pack
```

```
content/inbox/
  tickets/     # admission tickets, confirmations
  maps/        # venue maps, visitor guides used as maps
```

## Naming

Prefer:

```text
YYYY-MM-DD - Site Name.pdf
YYYY-MM-DD - Site Name Map.pdf
```

Examples:

- `2026-11-02 - Louvre.pdf` → site slug `louvre` (tickets)
- `2026-11-02 - Louvre Map.pdf` → site slug `louvre` (maps)

Site slugs are kebab-case and must match `siteId` values in the trip itinerary.

## Pipeline

1. Drop files into `tickets/` or `maps/`.
2. Convert pages to JPEG (150 DPI):

   ```bash
   pdftoppm -jpeg -r 150 "inbox/tickets/2026-11-02 - Louvre.pdf" web/public/images/tickets/louvre/ticket-page
   ```

3. List paths in `content/trips/<slug>/assets.json` (or `web/src/data/assets.json` for EU2026).
4. Rebuild the content pack:

   ```bash
   node content/scripts/build-pack.mjs eu2026
   ```

5. Commit, push to `main`, restart the TrueNAS app. Phones pull **only new blob hashes**.
