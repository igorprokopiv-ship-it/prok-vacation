# EU2026 Trip Companion

Mobile-first offline PWA for the Prok family European Grand Tour (28 Oct – 8 Nov 2026). Open once on Wi‑Fi, **Add to Home Screen**, then use itinerary, Maps links, site guides, and ticket/map images without cell data.

## Run locally

```bash
npm install
npm run dev
```

Dev server: [http://127.0.0.1:4177](http://127.0.0.1:4177)

```bash
npm run build
npm run preview   # also on port 4177
```

## Install on phones (before departure)

Do this **once on Wi‑Fi** for each phone:

1. Open the deployed URL (or a laptop hotspot serving the built app).
2. Wait for the page to fully load so the service worker can precache assets.
3. **iPhone (Safari):** Share → **Add to Home Screen**.
4. **Android (Chrome):** Menu → **Install app** / **Add to Home Screen**.
5. Launch from the home-screen icon; toggle Airplane Mode briefly to confirm offline works.

## How the app is organized

- **Highlights** — day briefing, main attractions, food focus (Details.html feel).
- **Schedule** — full EU4 timeline; expand a stop for hours, cost, booking, bags, transit, Maps URL.
- **Ticket / Map / Guide** — offline viewers when assets exist; otherwise clear empty states.

Branch mornings (British Museum vs Oxford, Pantheon queue options) stay labeled in Schedule without forcing a choice.

## Data & media

| Path | Source |
|------|--------|
| `src/data/itinerary.json` | EU4 itinerary (schedule/times) |
| `src/data/sites.json` | Sites write-ups (Logistics / Pro-Tips / History / Route) |
| `src/data/assets.json` | Links sites ↔ photos, ticket pages, map pages |
| `public/images/sites/` | Compressed landmark photos |
| `public/images/tickets/<site-id>/` | Ticket page images |
| `public/images/maps/<site-id>/` | Map page images |

### Add more tickets or maps later

1. Convert each PDF page to a compressed JPEG/WebP (e.g. `pdftoppm -jpeg -r 150 ticket.pdf public/images/tickets/louvre/ticket`).
2. List the paths under `tickets` or `maps` in `src/data/assets.json`, keyed by the site id used on stops (`siteId` in `itinerary.json`).
3. Rebuild / redeploy, open the app once online so the service worker precaches the new files.

Example:

```json
"tickets": {
  "british-museum": [
    "/images/tickets/british-museum/ticket-page-1.jpg"
  ],
  "louvre": [
    "/images/tickets/louvre/ticket-page-1.jpg"
  ]
}
```

Site ids are kebab-case (`british-museum`, `louvre`, `colosseum`, …). Match `stop.siteId` in the itinerary.

## Stack

Vite · React · TypeScript · Tailwind CSS · shadcn/ui primitives · vite-plugin-pwa
