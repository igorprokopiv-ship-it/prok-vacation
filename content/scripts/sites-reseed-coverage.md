# Sites reseed coverage

Sources: curated facts from `EU2026-Sites.pdf` (cross-checked with `EU2026-Sites-format.pdf`).

PDF table text is **not** auto-ingested into `sites.json` — multi-column reading order mixes neighboring sites (e.g. Tower of London absorbed Tower Bridge / Louvre lines). Facts were mapped by hand into `RAW_BONUS` in [`reseed-sites-from-pdf.py`](reseed-sites-from-pdf.py), merged onto the pre-reseed pack (snapshotted in `db/dml/20261009_text_snapshot.sql`), then English-polished and de-duplicated.

## Integrity checks

| Check | Result |
|-------|--------|
| Tower of London includes raven **biscuits** / **portcullis** | pass |
| Tower of London does **not** contain Tower Bridge bascules / Louvre Venus | pass |
| Harry Potter includes Wand Room ~17,000 boxes + room-by-room route | pass |
| Pompeii includes Lupanar + Villa of the Mysteries | pass |
| Vatican includes Laocoön / Sistine / Raphael detail | pass |
| Attachment stubs unchanged (flights, Phantom, Bounce, …) | pass |
| `content/trips/eu2026/sites.json` ≡ `web/src/data/sites.json` | pass |

## How to re-run

```bash
python content/scripts/reseed-sites-from-pdf.py
# or
npm run sites:reseed
npm run build:pack
```

Pre-reseed text DB backup:

```bash
npm run db:export-text-dml
```
