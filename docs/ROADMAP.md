# Roadmap — prok-vacation

## Phase 0 — Foundation

- [x] web/server split, Postgres `vacation`, content hash packs, delta sync
- [x] TrueNAS deploy docs, GHCR workflow
- [x] EU2026 content pack + inbox
- [x] Notes / Plan tabs + sync API
- [x] Deep links to TimeLog / Money / Immich ([PROK_LINKS.md](./PROK_LINKS.md))

## Phase 1 — Deploy on TrueNAS

- [ ] Create DB `vacation` on NAS Postgres
- [ ] Custom App: `ghcr.io/igorprokopiv-ship-it/prok-vacation:latest`, port **8083**, `DATABASE_URL`
- [ ] GHCR pull credentials on TrueNAS
- [ ] Phone: Add to Home Screen + verify delta sync after push

## Phase 2 — Prok composition (peer apps)

Track in sibling repos (see [PROK_ECOSYSTEM_AGENT_PROMPTS.md](./PROK_ECOSYSTEM_AGENT_PROMPTS.md)):

- [ ] **prok-vacation hub:** [#1](https://github.com/igorprokopiv-ship-it/prok-vacation/issues/1)
- [ ] **prok-timelog:** `?date=YYYY-MM-DD` — [#6](https://github.com/igorprokopiv-ship-it/prok-timelog/issues/6)
- [ ] **prok-money:** `?from=` & `?to=` — [#90](https://github.com/igorprokopiv-ship-it/prok-money/issues/90)
- [ ] **HMSE/Immich:** album conventions — [#16](https://github.com/igorprokopiv-ship-it/prok-HomeMediaSyncEngine/issues/16)

Vacation side: optional `trip_link` CRUD UI (API exists).

## Phase 3 — Planning depth

- [ ] Site matrix editor (Logistics / Pro-Tips / History / Route)
- [ ] Import EU4 / Sites OneNote exports into plan packs

## Phase 4 — Historical & ops

- [x] Zip import API + UI entry
- [x] Backup docs
- [ ] Pack size budgets / selective trip download UI
