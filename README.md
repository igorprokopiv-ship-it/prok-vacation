# Prok Vacation

Offline-first multi-trip companion (itinerary, tickets, maps, notes, planning). Part of the Prok suite — works alone, links to TimeLog / Money / Immich when you want.

## Local development

```bash
# Terminal 1 — API (optional; filesystem packs work without Postgres)
python -m pip install -r server/requirements.txt
cp .env.example .env   # set DATABASE_URL if using Postgres
npm run server         # :8083

# Terminal 2 — PWA (proxies /api → :8083)
npm install --prefix web
npm run dev
```

Dev UI: [http://127.0.0.1:4177](http://127.0.0.1:4177)

```bash
npm run build:pack    # hash content → data/blobs + manifests
npm run build         # pack + web production build
```

## TrueNAS

See [docs/DEPLOYMENT_TRUENAS.md](docs/DEPLOYMENT_TRUENAS.md). Image: `ghcr.io/igorprokopiv-ship-it/prok-vacation:latest` on port **8083**, database **`vacation`**.

## Content inbox

Drop new ticket/map PDFs in [`content/inbox/`](content/inbox/README.md), convert, rebuild pack, push. Phones download only changed blobs.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Content delta sync](docs/CONTENT.md)
- [Prok deep links](docs/PROK_LINKS.md)
- [Ecosystem agent prompts](docs/PROK_ECOSYSTEM_AGENT_PROMPTS.md) (for TimeLog / Money / HMSE agents)
- [TrueNAS deploy + GHCR](docs/DEPLOYMENT_TRUENAS.md)
- [Backup](docs/BACKUP_AND_RECOVERY.md)

## Release (TrueNAS)

Push to `main` → GitHub Actions bumps the patch version, publishes `ghcr.io/igorprokopiv-ship-it/prok-vacation:latest` (and `:<version>`). On TrueNAS set **Pull Policy = Always pull image**, then restart/update the Custom App. Confirm with the subtle `vX.Y.Z` under Sync in the app header.
