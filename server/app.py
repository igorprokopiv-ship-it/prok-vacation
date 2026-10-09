from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import shutil
import sys
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional
from uuid import UUID, uuid4

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row
from psycopg.types.json import Json
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "db" / "migrations"
WEB_DIST = ROOT / "web" / "dist"
BLOBS = ROOT / "data" / "blobs"
CONTENT_TRIPS = ROOT / "content" / "trips"
CONTENT_INBOX = ROOT / "content" / "inbox"

load_dotenv(ROOT / ".env", override=True)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
APP_VERSION = os.environ.get("APP_VERSION", "0.0.0")
PROK_TIMELOG_BASE = os.environ.get("PROK_TIMELOG_BASE", "http://admin.prok:8080")
PROK_MONEY_BASE = os.environ.get("PROK_MONEY_BASE", "http://admin.prok:8081")
PROK_IMMICH_BASE = os.environ.get("PROK_IMMICH_BASE", "http://admin.prok:30041")

EU2026_TRIP_ID = UUID("a1111111-1111-4111-8111-111111111111")


def run_migrations(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migration (
          filename TEXT PRIMARY KEY,
          applied_on TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    conn.commit()
    for path in sorted(MIGRATIONS.glob("*.sql")):
        name = path.name
        exists = conn.execute(
            "SELECT 1 FROM schema_migration WHERE filename = %s", (name,)
        ).fetchone()
        if exists:
            continue
        with conn.transaction():
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute(
                "INSERT INTO schema_migration (filename) VALUES (%s)", (name,)
            )


@contextmanager
def db() -> Iterator[psycopg.Connection]:
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_URL not configured")
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def load_pack_manifest(slug: str) -> dict[str, Any] | None:
    path = CONTENT_TRIPS / slug / "manifest.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_filesystem_trips() -> list[dict[str, Any]]:
    trips: list[dict[str, Any]] = []
    if not CONTENT_TRIPS.is_dir():
        return trips
    for d in sorted(CONTENT_TRIPS.iterdir()):
        if not d.is_dir():
            continue
        manifest = load_pack_manifest(d.name)
        meta_path = d / "trip.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.is_file() else {}
        trips.append(
            {
                "id": meta.get("id") or (manifest or {}).get("tripId") or d.name,
                "slug": d.name,
                "title": meta.get("title") or d.name,
                "start_date": meta.get("start_date"),
                "end_date": meta.get("end_date"),
                "status": meta.get("status") or "active",
                "content_version": (manifest or {}).get("version") or "0",
                "source": "filesystem",
            }
        )
    return trips


def seed_eu2026(conn: psycopg.Connection) -> None:
    pack = CONTENT_TRIPS / "eu2026"
    if not pack.is_dir():
        return
    itinerary_path = pack / "itinerary.json"
    sites_path = pack / "sites.json"
    assets_path = pack / "assets.json"
    trip_meta_path = pack / "trip.json"
    if not itinerary_path.is_file():
        return
    itinerary = json.loads(itinerary_path.read_text(encoding="utf-8"))
    sites = json.loads(sites_path.read_text(encoding="utf-8")) if sites_path.is_file() else []
    assets = json.loads(assets_path.read_text(encoding="utf-8")) if assets_path.is_file() else {}
    meta = json.loads(trip_meta_path.read_text(encoding="utf-8")) if trip_meta_path.is_file() else {}
    manifest = load_pack_manifest("eu2026") or {}
    doc = {
        "itinerary": itinerary,
        "sites": sites,
        "assets": assets,
    }
    conn.execute(
        """
        INSERT INTO trip (
          id, slug, title, start_date, end_date, status,
          content_version, trip_document, last_modified_on
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          status = EXCLUDED.status,
          content_version = EXCLUDED.content_version,
          trip_document = EXCLUDED.trip_document,
          last_modified_on = now()
        """,
        (
            EU2026_TRIP_ID,
            "eu2026",
            meta.get("title") or itinerary.get("title") or "EU2026 Trip Companion",
            meta.get("start_date") or "2026-10-28",
            meta.get("end_date") or "2026-11-08",
            meta.get("status") or "active",
            manifest.get("version") or "1",
            Json(doc),
        ),
    )
    # Register blobs from manifest if present
    for entry in manifest.get("files") or []:
        sha = entry["sha256"]
        storage = BLOBS / sha[:2] / sha
        if not storage.is_file():
            continue
        conn.execute(
            """
            INSERT INTO content_blob (sha256, mime, byte_size, storage_path, kind)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (sha256) DO NOTHING
            """,
            (
                sha,
                entry.get("mime") or "application/octet-stream",
                entry.get("bytes") or storage.stat().st_size,
                str(storage.relative_to(ROOT)).replace("\\", "/"),
                entry.get("kind") or "file",
            ),
        )
        conn.execute(
            """
            INSERT INTO trip_content_file (trip_id, path, sha256, kind)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (trip_id, path) DO UPDATE SET
              sha256 = EXCLUDED.sha256,
              kind = EXCLUDED.kind
            """,
            (EU2026_TRIP_ID, entry["path"], sha, entry.get("kind") or "file"),
        )


app = FastAPI(title="prok-vacation", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    BLOBS.mkdir(parents=True, exist_ok=True)
    CONTENT_INBOX.joinpath("tickets").mkdir(parents=True, exist_ok=True)
    CONTENT_INBOX.joinpath("maps").mkdir(parents=True, exist_ok=True)
    if not DATABASE_URL:
        print(
            "WARNING: DATABASE_URL unset — serving filesystem packs only",
            file=sys.stderr,
        )
        return
    try:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            run_migrations(conn)
            seed_eu2026(conn)
            conn.commit()
        print("migrations ok; eu2026 seed applied")
    except Exception as exc:
        print(f"WARNING: migration/connect failed: {exc}", file=sys.stderr)


@app.get("/api/health")
def health() -> dict[str, Any]:
    db_ok = False
    if DATABASE_URL:
        try:
            with db() as conn:
                conn.execute("SELECT 1")
                db_ok = True
        except Exception:
            db_ok = False
    return {
        "ok": True,
        "version": APP_VERSION,
        "database": db_ok,
        "links": {
            "timelog": PROK_TIMELOG_BASE,
            "money": PROK_MONEY_BASE,
            "immich": PROK_IMMICH_BASE,
        },
    }


@app.get("/api/config")
def config() -> dict[str, Any]:
    return {
        "version": APP_VERSION,
        "timelogBase": PROK_TIMELOG_BASE,
        "moneyBase": PROK_MONEY_BASE,
        "immichBase": PROK_IMMICH_BASE,
    }


@app.get("/api/trips")
def list_trips() -> list[dict[str, Any]]:
    if DATABASE_URL:
        try:
            with db() as conn:
                rows = conn.execute(
                    """
                    SELECT id, slug, title, start_date, end_date, status,
                           content_version, cover_blob_sha, last_modified_on
                    FROM trip
                    WHERE record_status = 'active'
                    ORDER BY start_date NULLS LAST, title
                    """
                ).fetchall()
                if rows:
                    out = []
                    for r in rows:
                        item = dict(r)
                        item["id"] = str(item["id"])
                        if item.get("start_date"):
                            item["start_date"] = item["start_date"].isoformat()
                        if item.get("end_date"):
                            item["end_date"] = item["end_date"].isoformat()
                        if item.get("last_modified_on"):
                            item["last_modified_on"] = item["last_modified_on"].isoformat()
                        item["source"] = "postgres"
                        out.append(item)
                    return out
        except HTTPException:
            raise
        except Exception as exc:
            print(f"list_trips db fallback: {exc}", file=sys.stderr)
    return list_filesystem_trips()


@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str) -> dict[str, Any]:
    if DATABASE_URL:
        try:
            with db() as conn:
                row = conn.execute(
                    """
                    SELECT id, slug, title, start_date, end_date, status,
                           content_version, cover_blob_sha, trip_document,
                           last_modified_on
                    FROM trip
                    WHERE record_status = 'active'
                      AND (id::text = %s OR slug = %s)
                    """,
                    (trip_id, trip_id),
                ).fetchone()
                if row:
                    item = dict(row)
                    item["id"] = str(item["id"])
                    if item.get("start_date"):
                        item["start_date"] = item["start_date"].isoformat()
                    if item.get("end_date"):
                        item["end_date"] = item["end_date"].isoformat()
                    if item.get("last_modified_on"):
                        item["last_modified_on"] = item[
                            "last_modified_on"
                        ].isoformat()
                    return item
        except HTTPException:
            raise
        except Exception as exc:
            print(f"get_trip db fallback: {exc}", file=sys.stderr)

    # Filesystem fallback by slug or id in trip.json
    for trip in list_filesystem_trips():
        if trip["slug"] == trip_id or trip["id"] == trip_id:
            pack = CONTENT_TRIPS / trip["slug"]
            doc = {
                "itinerary": json.loads((pack / "itinerary.json").read_text(encoding="utf-8"))
                if (pack / "itinerary.json").is_file()
                else {},
                "sites": json.loads((pack / "sites.json").read_text(encoding="utf-8"))
                if (pack / "sites.json").is_file()
                else [],
                "assets": json.loads((pack / "assets.json").read_text(encoding="utf-8"))
                if (pack / "assets.json").is_file()
                else {},
            }
            return {**trip, "trip_document": doc}
    raise HTTPException(404, "Trip not found")


@app.get("/api/content/{trip_id}/manifest")
def content_manifest(trip_id: str) -> dict[str, Any]:
    slug = trip_id
    if DATABASE_URL:
        try:
            with db() as conn:
                row = conn.execute(
                    """
                    SELECT id, slug, content_version FROM trip
                    WHERE record_status = 'active'
                      AND (id::text = %s OR slug = %s)
                    """,
                    (trip_id, trip_id),
                ).fetchone()
                if row:
                    slug = row["slug"]
                    files = conn.execute(
                        """
                        SELECT f.path, f.sha256, f.kind, b.byte_size AS bytes, b.mime
                        FROM trip_content_file f
                        JOIN content_blob b ON b.sha256 = f.sha256
                        WHERE f.trip_id = %s
                        ORDER BY f.path
                        """,
                        (row["id"],),
                    ).fetchall()
                    if files:
                        return {
                            "tripId": str(row["id"]),
                            "slug": slug,
                            "version": row["content_version"],
                            "files": [dict(f) for f in files],
                        }
        except Exception as exc:
            print(f"manifest db fallback: {exc}", file=sys.stderr)

    manifest = load_pack_manifest(slug)
    if not manifest:
        # try resolve slug from filesystem trip list
        for t in list_filesystem_trips():
            if t["id"] == trip_id or t["slug"] == trip_id:
                manifest = load_pack_manifest(t["slug"])
                break
    if not manifest:
        raise HTTPException(404, "Manifest not found")
    return manifest


@app.get("/api/content/blobs/{sha256}")
def get_blob(sha256: str) -> Response:
    if len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256.lower()):
        raise HTTPException(400, "Invalid sha256")
    sha = sha256.lower()
    path = BLOBS / sha[:2] / sha
    if not path.is_file():
        raise HTTPException(404, "Blob not found")
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    # Prefer mime from sidecar-less content; check postgres if available
    if DATABASE_URL:
        try:
            with db() as conn:
                row = conn.execute(
                    "SELECT mime FROM content_blob WHERE sha256 = %s", (sha,)
                ).fetchone()
                if row and row.get("mime"):
                    mime = row["mime"]
        except Exception:
            pass
    return FileResponse(
        path,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": f'"{sha}"',
        },
    )


class NoteIn(BaseModel):
    id: UUID
    trip_id: UUID
    day_id: Optional[str] = None
    stop_id: Optional[str] = None
    body: str = ""
    record_status: str = "active"
    created_by: Optional[str] = None
    created_on: Optional[datetime] = None
    created_on_device: Optional[str] = None
    last_modified_by: Optional[str] = None
    last_modified_on: Optional[datetime] = None
    last_modified_on_device: Optional[str] = None


class PlanItemIn(BaseModel):
    id: UUID
    trip_id: UUID
    site_id: Optional[str] = None
    day_id: Optional[str] = None
    kind: str = "todo"
    title: str = ""
    body: str = ""
    done: bool = False
    sort_order: int = 0
    record_status: str = "active"
    created_by: Optional[str] = None
    created_on: Optional[datetime] = None
    created_on_device: Optional[str] = None
    last_modified_by: Optional[str] = None
    last_modified_on: Optional[datetime] = None
    last_modified_on_device: Optional[str] = None


class TripLinkIn(BaseModel):
    id: UUID
    trip_id: UUID
    kind: str
    label: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    day_id: Optional[str] = None
    record_status: str = "active"
    last_modified_on: Optional[datetime] = None
    last_modified_by: Optional[str] = None
    last_modified_on_device: Optional[str] = None
    created_by: Optional[str] = None
    created_on: Optional[datetime] = None
    created_on_device: Optional[str] = None


class SyncPushIn(BaseModel):
    notes: list[NoteIn] = Field(default_factory=list)
    plan_items: list[PlanItemIn] = Field(default_factory=list)
    trip_links: list[TripLinkIn] = Field(default_factory=list)


def _ts(v: Optional[datetime]) -> datetime:
    if v is None:
        return datetime.now(timezone.utc)
    if v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v


@app.post("/api/sync/push")
def sync_push(body: SyncPushIn) -> dict[str, Any]:
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_URL not configured")
    accepted = {"notes": 0, "plan_items": 0, "trip_links": 0}
    with db() as conn:
        for n in body.notes:
            existing = conn.execute(
                "SELECT last_modified_on FROM note WHERE id = %s", (n.id,)
            ).fetchone()
            incoming = _ts(n.last_modified_on)
            if existing and existing["last_modified_on"] and existing[
                "last_modified_on"
            ] > incoming:
                continue
            conn.execute(
                """
                INSERT INTO note (
                  id, trip_id, day_id, stop_id, body, record_status,
                  created_by, created_on, created_on_device,
                  last_modified_by, last_modified_on, last_modified_on_device
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                )
                ON CONFLICT (id) DO UPDATE SET
                  trip_id = EXCLUDED.trip_id,
                  day_id = EXCLUDED.day_id,
                  stop_id = EXCLUDED.stop_id,
                  body = EXCLUDED.body,
                  record_status = EXCLUDED.record_status,
                  last_modified_by = EXCLUDED.last_modified_by,
                  last_modified_on = EXCLUDED.last_modified_on,
                  last_modified_on_device = EXCLUDED.last_modified_on_device
                """,
                (
                    n.id,
                    n.trip_id,
                    n.day_id,
                    n.stop_id,
                    n.body,
                    n.record_status,
                    n.created_by,
                    _ts(n.created_on),
                    n.created_on_device,
                    n.last_modified_by,
                    incoming,
                    n.last_modified_on_device,
                ),
            )
            accepted["notes"] += 1

        for p in body.plan_items:
            existing = conn.execute(
                "SELECT last_modified_on FROM plan_item WHERE id = %s", (p.id,)
            ).fetchone()
            incoming = _ts(p.last_modified_on)
            if existing and existing["last_modified_on"] and existing[
                "last_modified_on"
            ] > incoming:
                continue
            conn.execute(
                """
                INSERT INTO plan_item (
                  id, trip_id, site_id, day_id, kind, title, body, done, sort_order,
                  record_status, created_by, created_on, created_on_device,
                  last_modified_by, last_modified_on, last_modified_on_device
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                )
                ON CONFLICT (id) DO UPDATE SET
                  trip_id = EXCLUDED.trip_id,
                  site_id = EXCLUDED.site_id,
                  day_id = EXCLUDED.day_id,
                  kind = EXCLUDED.kind,
                  title = EXCLUDED.title,
                  body = EXCLUDED.body,
                  done = EXCLUDED.done,
                  sort_order = EXCLUDED.sort_order,
                  record_status = EXCLUDED.record_status,
                  last_modified_by = EXCLUDED.last_modified_by,
                  last_modified_on = EXCLUDED.last_modified_on,
                  last_modified_on_device = EXCLUDED.last_modified_on_device
                """,
                (
                    p.id,
                    p.trip_id,
                    p.site_id,
                    p.day_id,
                    p.kind,
                    p.title,
                    p.body,
                    p.done,
                    p.sort_order,
                    p.record_status,
                    p.created_by,
                    _ts(p.created_on),
                    p.created_on_device,
                    p.last_modified_by,
                    incoming,
                    p.last_modified_on_device,
                ),
            )
            accepted["plan_items"] += 1

        for link in body.trip_links:
            existing = conn.execute(
                "SELECT last_modified_on FROM trip_link WHERE id = %s", (link.id,)
            ).fetchone()
            incoming = _ts(link.last_modified_on)
            if existing and existing["last_modified_on"] and existing[
                "last_modified_on"
            ] > incoming:
                continue
            conn.execute(
                """
                INSERT INTO trip_link (
                  id, trip_id, kind, label, payload, day_id, record_status,
                  created_by, created_on, created_on_device,
                  last_modified_by, last_modified_on, last_modified_on_device
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                )
                ON CONFLICT (id) DO UPDATE SET
                  trip_id = EXCLUDED.trip_id,
                  kind = EXCLUDED.kind,
                  label = EXCLUDED.label,
                  payload = EXCLUDED.payload,
                  day_id = EXCLUDED.day_id,
                  record_status = EXCLUDED.record_status,
                  last_modified_by = EXCLUDED.last_modified_by,
                  last_modified_on = EXCLUDED.last_modified_on,
                  last_modified_on_device = EXCLUDED.last_modified_on_device
                """,
                (
                    link.id,
                    link.trip_id,
                    link.kind,
                    link.label,
                    Json(link.payload),
                    link.day_id,
                    link.record_status,
                    link.created_by,
                    _ts(link.created_on),
                    link.created_on_device,
                    link.last_modified_by,
                    incoming,
                    link.last_modified_on_device,
                ),
            )
            accepted["trip_links"] += 1
    return {"accepted": accepted}


@app.get("/api/sync/pull")
def sync_pull(
    since: Optional[str] = Query(None),
    trip_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_URL not configured")
    since_dt = None
    if since:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
    with db() as conn:
        note_q = "SELECT * FROM note WHERE TRUE"
        plan_q = "SELECT * FROM plan_item WHERE TRUE"
        link_q = "SELECT * FROM trip_link WHERE TRUE"
        params: list[Any] = []
        params2: list[Any] = []
        params3: list[Any] = []
        if since_dt:
            note_q += " AND last_modified_on > %s"
            plan_q += " AND last_modified_on > %s"
            link_q += " AND last_modified_on > %s"
            params.append(since_dt)
            params2.append(since_dt)
            params3.append(since_dt)
        if trip_id:
            note_q += " AND trip_id::text = %s"
            plan_q += " AND trip_id::text = %s"
            link_q += " AND trip_id::text = %s"
            params.append(trip_id)
            params2.append(trip_id)
            params3.append(trip_id)
        notes = conn.execute(note_q + " ORDER BY last_modified_on", params).fetchall()
        plans = conn.execute(plan_q + " ORDER BY last_modified_on", params2).fetchall()
        links = conn.execute(link_q + " ORDER BY last_modified_on", params3).fetchall()

        def ser(rows: list[Any]) -> list[dict[str, Any]]:
            out = []
            for r in rows:
                item = dict(r)
                for k, v in list(item.items()):
                    if isinstance(v, UUID):
                        item[k] = str(v)
                    elif isinstance(v, datetime):
                        item[k] = v.isoformat()
                    elif isinstance(v, date):
                        item[k] = v.isoformat()
                out.append(item)
            return out

        return {
            "notes": ser(notes),
            "plan_items": ser(plans),
            "trip_links": ser(links),
            "server_time": datetime.now(timezone.utc).isoformat(),
        }


@app.get("/api/trips/{trip_id}/links")
def list_trip_links(trip_id: str) -> list[dict[str, Any]]:
    if not DATABASE_URL:
        return []
    with db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM trip_link
            WHERE record_status = 'active'
              AND (trip_id::text = %s OR trip_id IN (
                SELECT id FROM trip WHERE slug = %s
              ))
            ORDER BY kind, label NULLS LAST
            """,
            (trip_id, trip_id),
        ).fetchall()
        out = []
        for r in rows:
            item = dict(r)
            item["id"] = str(item["id"])
            item["trip_id"] = str(item["trip_id"])
            if item.get("last_modified_on"):
                item["last_modified_on"] = item["last_modified_on"].isoformat()
            out.append(item)
        return out


@app.post("/api/trips/import")
async def import_trip_pack(file: UploadFile = File(...)) -> dict[str, Any]:
    """Phase 4: upload a zip or accept a slug folder already on disk via form field name."""
    if not DATABASE_URL:
        raise HTTPException(503, "DATABASE_URL not configured")
    name = file.filename or "pack.zip"
    if not name.endswith(".zip"):
        raise HTTPException(400, "Upload a .zip content pack")
    import tempfile
    import zipfile

    with tempfile.TemporaryDirectory() as tmp:
        zpath = Path(tmp) / name
        zpath.write_bytes(await file.read())
        with zipfile.ZipFile(zpath, "r") as zf:
            zf.extractall(tmp)
        # Find trip.json
        trip_json = None
        root = Path(tmp)
        for p in root.rglob("trip.json"):
            trip_json = p
            break
        if not trip_json:
            raise HTTPException(400, "Pack missing trip.json")
        pack_dir = trip_json.parent
        meta = json.loads(trip_json.read_text(encoding="utf-8"))
        slug = meta.get("slug") or pack_dir.name
        dest = CONTENT_TRIPS / slug
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(pack_dir, dest)
        import subprocess

        subprocess.run(
            ["node", str(ROOT / "content" / "scripts" / "build-pack.mjs"), slug],
            check=False,
            cwd=str(ROOT),
        )
        with db() as conn:
            if slug == "eu2026":
                seed_eu2026(conn)
            else:
                _seed_pack(conn, slug)
        return {"ok": True, "slug": slug}


def _seed_pack(conn: psycopg.Connection, slug: str) -> None:
    pack = CONTENT_TRIPS / slug
    meta = json.loads((pack / "trip.json").read_text(encoding="utf-8"))
    itinerary = json.loads((pack / "itinerary.json").read_text(encoding="utf-8"))
    sites = (
        json.loads((pack / "sites.json").read_text(encoding="utf-8"))
        if (pack / "sites.json").is_file()
        else []
    )
    assets = (
        json.loads((pack / "assets.json").read_text(encoding="utf-8"))
        if (pack / "assets.json").is_file()
        else {}
    )
    manifest = load_pack_manifest(slug) or {}
    trip_id = UUID(meta["id"]) if meta.get("id") else uuid4()
    conn.execute(
        """
        INSERT INTO trip (
          id, slug, title, start_date, end_date, status,
          content_version, trip_document, last_modified_on
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s, now())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          status = EXCLUDED.status,
          content_version = EXCLUDED.content_version,
          trip_document = EXCLUDED.trip_document,
          last_modified_on = now()
        """,
        (
            trip_id,
            slug,
            meta.get("title") or slug,
            meta.get("start_date"),
            meta.get("end_date"),
            meta.get("status") or "archived",
            manifest.get("version") or "1",
            Json({"itinerary": itinerary, "sites": sites, "assets": assets}),
        ),
    )


# SPA static files last
if WEB_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        candidate = WEB_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEB_DIST / "index.html")
