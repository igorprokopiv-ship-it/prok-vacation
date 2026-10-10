#!/usr/bin/env python3
"""Push eu2026 pack JSON into trip.trip_document (text only; no blob sync)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "content/trips/eu2026"


def load_database_url() -> str:
    env_path = ROOT / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                v = line.split("=", 1)[1].strip()
                if (v.startswith('"') and v.endswith('"')) or (
                    v.startswith("'") and v.endswith("'")
                ):
                    v = v[1:-1]
                return v
    return os.environ.get("DATABASE_URL", "")


def main() -> int:
    url = load_database_url()
    if not url:
        print("DATABASE_URL not set; skipped DB refresh")
        return 0
    try:
        import psycopg
        from psycopg.types.json import Json
    except ImportError:
        print("psycopg not installed; skipped DB refresh")
        return 0

    itinerary = json.loads((PACK / "itinerary.json").read_text(encoding="utf-8"))
    sites = json.loads((PACK / "sites.json").read_text(encoding="utf-8"))
    assets = json.loads((PACK / "assets.json").read_text(encoding="utf-8"))
    meta = json.loads((PACK / "trip.json").read_text(encoding="utf-8"))
    manifest = json.loads((PACK / "manifest.json").read_text(encoding="utf-8"))
    doc = {"itinerary": itinerary, "sites": sites, "assets": assets}
    trip_id = meta["id"]

    with psycopg.connect(url) as conn:
        conn.execute(
            """
            INSERT INTO trip (
              id, slug, title, start_date, end_date, status,
              content_version, trip_document, record_status, last_modified_on
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, now()
            )
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              start_date = EXCLUDED.start_date,
              end_date = EXCLUDED.end_date,
              status = EXCLUDED.status,
              content_version = EXCLUDED.content_version,
              trip_document = EXCLUDED.trip_document,
              record_status = EXCLUDED.record_status,
              last_modified_on = now()
            """,
            (
                trip_id,
                meta.get("slug") or "eu2026",
                meta.get("title") or "EU2026",
                meta.get("start_date"),
                meta.get("end_date"),
                meta.get("status") or "active",
                manifest.get("version") or "1",
                Json(doc),
                meta.get("record_status") or "active",
            ),
        )
        conn.execute(
            """
            INSERT INTO schema_migration (filename)
            VALUES ('000_schema_migration.sql')
            ON CONFLICT DO NOTHING
            """
        )
        conn.commit()
        n = conn.execute(
            "SELECT jsonb_array_length(trip_document->'sites') FROM trip WHERE id = %s",
            (trip_id,),
        ).fetchone()[0]
    print(json.dumps({"ok": True, "trip_id": trip_id, "sites": n}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
