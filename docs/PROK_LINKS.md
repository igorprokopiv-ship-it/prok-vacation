# Prok cross-app links

Vacation **never** queries TimeLog, Money, or Immich databases. It opens peer apps with URLs.

## Environment (server)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROK_TIMELOG_BASE` | `http://admin.prok:8080` | TimeLog PWA |
| `PROK_MONEY_BASE` | `http://admin.prok:8081` | Money PWA |
| `PROK_IMMICH_BASE` | `http://admin.prok:30041` | Immich web |

Exposed to the client via `GET /api/config`.

## URL contracts

### TimeLog — day

```
{TIMELOG_BASE}/?date=YYYY-MM-DD
```

Vacation day cards use the itinerary `day.date` field.

If TimeLog does not yet honor `?date=`, add a tiny handler there later — vacation keeps emitting this contract.

### Money — trip spend range

```
{MONEY_BASE}/?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Uses trip `start_date` / `end_date`.

### Immich — album

```
{IMMICH_BASE}/albums/{albumId}
```

Store `albumId` on `trip_link` rows (`kind = immich_album`, payload `{ "albumId": "..." }`).

### Custom

`kind = custom_url` with `payload.url`.

## Suite independence

Each Prok app must remain usable alone. Missing bases or unreachable peers show no crash — links simply open and fail at the browser if the peer is down.

Future split of timelog → `prok-task` / `prok-health` does not change vacation: update `PROK_TIMELOG_BASE` (or add new env vars) when the day-log home moves.
