# Prok ecosystem — agent prompts (copy/paste)

Use these when starting a Cursor/cloud agent in **prok-timelog**, **prok-money**, or **prok-hmse** (HomeMediaSyncEngine). Goal: each app stays **fully usable alone**, but composes with siblings via **URL contracts** (no shared DB, no hard runtime deps).

Canonical link spec: [PROK_LINKS.md](./PROK_LINKS.md) in **prok-vacation**.

---

## Shared context (prepend to any prompt)

```text
Prok is a personal suite (ADHD/AuDHD-friendly “Apple-like” ecosystem): prok-vacation, prok-timelog, prok-money, HMSE+Immich, and future prok-task / prok-health. Each app MUST work standalone. Integration is optional deep links + documented query params, never cross-database queries or required peer services.

Perimeter: Tailscale (admin.prok). Default bases:
- TimeLog http://admin.prok:8080
- Money http://admin.prok:8081
- Vacation http://admin.prok:8083
- Immich http://admin.prok:30041

When you change a URL contract, update prok-vacation/docs/PROK_LINKS.md and mention it in the PR/issue.
```

---

## prok-timelog agent prompt

```text
You are working on prok-timelog (FastAPI + PWA, Postgres timelog, TrueNAS GHCR deploy port 8080).

Ecosystem: prok-vacation links here for “what happened this day” while traveling. Contract (see prok-vacation docs/PROK_LINKS.md):

  {TIMELOG_BASE}/?date=YYYY-MM-DD

Tasks for this agent session:
1. Read docs/ARCHITECTURE.md and docs/ROADMAP.md.
2. Add a Roadmap item (Phase 2 or “Prok composition”): honor `?date=` on app load — open Day view for that local calendar date when present; ignore if invalid.
3. Document the contract in docs/PROK_LINKS.md (or docs/PROK_COMPOSITION.md) on the timelog side: what Vacation sends, what we guarantee.
4. Do NOT add vacation-specific tables or Immich/Money API calls.
5. Optional: Settings env `PROK_VACATION_BASE` for a “Open trip” link back to vacation (deep link only).

Future note: timelog may split into prok-timelog / prok-task / prok-health; vacation only needs a stable “day log” URL — keep that contract stable.

If creating a GitHub issue instead of implementing, title: “Prok composition: support ?date= deep link from prok-vacation”.
```

---

## prok-money agent prompt

```text
You are working on prok-money (Vite PWA, SQLite + Drive sync, Cloudflare deploy; local TrueNAS optional).

Ecosystem: prok-vacation links here for trip spend. Contract:

  {MONEY_BASE}/?from=YYYY-MM-DD&to=YYYY-MM-DD

Tasks:
1. Find how transactions are filtered by date in the UI (register, reports, or search).
2. Add Roadmap/docs item: on load, if `from` and `to` query params are present, apply that date range to the default expense view (or open Transactions with filter pre-filled). Invalid dates → ignore gracefully.
3. Document in docs (new PROK_COMPOSITION.md or README section): peer apps, no shared schema with vacation.
4. Do NOT query vacation Postgres or Immich from money.

Optional back-link: env or settings `PROK_VACATION_BASE` → “View trip in Vacation” when user came from a link (store referrer in session only).

GitHub issue title if not implementing: “Prok composition: support ?from=&to= deep link from prok-vacation”.
```

---

## prok-hmse (prok-HomeMediaSyncEngine) agent prompt

```text
You are working on prok-HomeMediaSyncEngine (HMSE): Immich + HomeMedia filesystem, TrueNAS cron/scripts, NOT a web PWA.

Ecosystem: prok-vacation deep-links to Immich albums for trip photos. Contract:

  {IMMICH_BASE}/albums/{albumId}

Vacation stores albumId in trip_link rows; it does NOT call Immich API from the vacation app (Phase 1–3).

Tasks:
1. Read docs/ARCHITECTURE.md and STATUS.md.
2. Roadmap/docs: document recommended Immich album naming for trips: `YYYY_MM_DD - TripName` or `EU2026 - Day 3 Paris` so humans can match vacation days to albums.
3. Optional script or doc-only workflow: when user creates a vacation Immich album, note the album UUID in vacation trip_link (manual or future automation — do not block on automation).
4. Do NOT add timelog/money DB integration. HMSE stays media-only; composition is URLs + album conventions.
5. If Event Markdown hub (Issues #2/#3) ships later, cross-link in docs: “Vacation Photos link → Immich album; event hub → SMB Events folder”.

GitHub issue title if not implementing: “Prok composition: document Immich album conventions for prok-vacation deep links”.
```

---

## prok-vacation agent (this repo)

Already implements: trip picker, content delta sync, Notes/Plan sync, LinksBar, `GET /api/config`, [PROK_LINKS.md](./PROK_LINKS.md).

When peers implement query params, verify links from a vacation day card in Tailscale.
