"""Admin auth + live CMS writes against filesystem trip packs."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
CONTENT_TRIPS = ROOT / "content" / "trips"
WEB_PUBLIC = ROOT / "web" / "public"
WEB_DATA = ROOT / "web" / "src" / "data"

COOKIE_NAME = "prok_admin"
COOKIE_MAX_AGE = 60 * 60 * 24 * 14  # 14 days

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _admin_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", "")


def _session_secret() -> str:
    return os.environ.get("ADMIN_SESSION_SECRET") or _admin_password() or "dev-insecure-admin-secret"


def _sign(payload: str) -> str:
    sig = hmac.new(
        _session_secret().encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}.{sig}"


def _verify(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    payload, sig = token.rsplit(".", 1)
    expected = hmac.new(
        _session_secret().encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        ts = int(payload.split(":", 1)[0])
    except ValueError:
        return False
    return (time.time() - ts) < COOKIE_MAX_AGE


def require_admin(request: Request) -> None:
    if not _admin_password():
        raise HTTPException(503, "ADMIN_PASSWORD not configured")
    token = request.cookies.get(COOKIE_NAME)
    if not _verify(token):
        raise HTTPException(401, "Admin login required")


class LoginBody(BaseModel):
    password: str


@router.post("/login")
def admin_login(body: LoginBody, response: Response) -> dict[str, Any]:
    password = _admin_password()
    if not password:
        raise HTTPException(503, "ADMIN_PASSWORD not configured")
    if not secrets.compare_digest(body.password, password):
        raise HTTPException(401, "Invalid password")
    token = _sign(f"{int(time.time())}:{secrets.token_hex(8)}")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    return {"admin": True}


@router.post("/logout")
def admin_logout(response: Response) -> dict[str, Any]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"admin": False}


@router.get("/me")
def admin_me(request: Request) -> dict[str, Any]:
    if not _admin_password():
        return {"admin": False}
    return {"admin": _verify(request.cookies.get(COOKIE_NAME))}


def pack_dir(slug: str) -> Path:
    d = CONTENT_TRIPS / slug
    if not d.is_dir():
        raise HTTPException(404, f"Trip pack '{slug}' not found")
    return d


def load_json(path: Path, default: Any) -> Any:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sync_web_data(slug: str) -> None:
    """Keep Vite bundled JSON in sync for local/offline fallback."""
    if slug != "eu2026":
        return
    pack = pack_dir(slug)
    for name in ("itinerary.json", "sites.json", "assets.json"):
        src = pack / name
        if src.is_file():
            shutil.copy2(src, WEB_DATA / name)


def rebuild_pack(slug: str) -> None:
    subprocess.run(
        ["node", str(ROOT / "content" / "scripts" / "build-pack.mjs"), slug],
        check=False,
        cwd=str(ROOT),
    )


_refresh_hook = None


def set_refresh_hook(fn) -> None:
    global _refresh_hook
    _refresh_hook = fn


def refresh_trip_document(slug: str) -> None:
    """Best-effort DB refresh via hook registered from app.py."""
    if _refresh_hook is None:
        return
    try:
        _refresh_hook(slug)
    except Exception as exc:
        print(f"admin refresh_trip_document: {exc}", file=sys.stderr)


def commit_pack(slug: str) -> None:
    sync_web_data(slug)
    rebuild_pack(slug)
    refresh_trip_document(slug)


def load_pack(slug: str) -> tuple[dict, list, dict]:
    pack = pack_dir(slug)
    itinerary = load_json(pack / "itinerary.json", {"title": slug, "days": []})
    sites = load_json(pack / "sites.json", [])
    assets = load_json(pack / "assets.json", {"sites": {}, "tickets": {}, "maps": {}})
    return itinerary, sites, assets


def save_pack(slug: str, itinerary: dict, sites: list, assets: dict) -> None:
    pack = pack_dir(slug)
    write_json(pack / "itinerary.json", itinerary)
    write_json(pack / "sites.json", sites)
    write_json(pack / "assets.json", assets)
    commit_pack(slug)


def find_day(itinerary: dict, day_id: str) -> dict:
    for day in itinerary.get("days") or []:
        if day.get("id") == day_id:
            return day
    raise HTTPException(404, f"Day '{day_id}' not found")


def find_stop(day: dict, stop_id: str) -> dict:
    for stop in day.get("stops") or []:
        if stop.get("id") == stop_id:
            return stop
    raise HTTPException(404, f"Stop '{stop_id}' not found")


def ensure_stop_arrays(stop: dict) -> None:
    stop.setdefault("tickets", [])
    stop.setdefault("mapPages", [])
    stop.setdefault("guideIds", [])
    if stop.get("siteId") and stop["siteId"] not in stop["guideIds"]:
        stop["guideIds"].insert(0, stop["siteId"])


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s or secrets.token_hex(4)


def convert_upload_to_jpegs(upload: UploadFile, out_dir: Path, prefix: str) -> list[str]:
    """Save upload; convert PDF pages via pypdfium2, or copy JPEG/PNG."""
    out_dir.mkdir(parents=True, exist_ok=True)
    # clear old pages with same prefix
    for f in out_dir.glob(f"{prefix}-*.jpg"):
        f.unlink(missing_ok=True)

    suffix = Path(upload.filename or "upload.bin").suffix.lower() or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        raw = upload.file.read()
        tmp.write(raw)
        tmp_path = Path(tmp.name)

    try:
        if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
            dest = out_dir / f"{prefix}-1.jpg"
            if suffix in {".jpg", ".jpeg"}:
                shutil.copy2(tmp_path, dest)
            else:
                try:
                    from PIL import Image

                    Image.open(tmp_path).convert("RGB").save(dest, format="JPEG", quality=85)
                except Exception:
                    shutil.copy2(tmp_path, dest)
            rel = dest.relative_to(WEB_PUBLIC).as_posix()
            return [f"/{rel}"]

        if suffix != ".pdf":
            raise HTTPException(400, "Upload a PDF or image (jpg/png/webp)")

        py = r"""
import sys
from pathlib import Path
import pypdfium2 as pdfium

src = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
prefix = sys.argv[3]
doc = pdfium.PdfDocument(str(src))
n = 0
for i, page in enumerate(doc):
    bitmap = page.render(scale=150/72)
    pil = bitmap.to_pil()
    dest = out_dir / f"{prefix}-{i+1}.jpg"
    pil.save(dest, format="JPEG", quality=85)
    n += 1
    page.close()
print(n)
"""
        r = subprocess.run(
            ["python", "-c", py, str(tmp_path), str(out_dir), prefix],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            raise HTTPException(500, f"PDF convert failed: {r.stderr or r.stdout}")
        try:
            count = int((r.stdout or "").strip().splitlines()[-1])
        except Exception:
            count = 0
        urls: list[str] = []
        for i in range(1, count + 1):
            dest = out_dir / f"{prefix}-{i}.jpg"
            if dest.is_file():
                urls.append(f"/{dest.relative_to(WEB_PUBLIC).as_posix()}")
        if not urls:
            raise HTTPException(500, "PDF produced no pages")
        return urls
    finally:
        tmp_path.unlink(missing_ok=True)


class CreateStopBody(BaseModel):
    time: str
    title: str
    kind: str = "attraction"
    duration: str = ""
    optionGroup: Optional[str] = None
    optionLabel: Optional[str] = None
    primary: bool = True


class PatchStopBody(BaseModel):
    time: Optional[str] = None
    title: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None
    notes: Optional[str] = None
    mapsUrl: Optional[str] = None
    bookingRef: Optional[str] = None
    bags: Optional[str] = None
    transit: Optional[str] = None
    kind: Optional[str] = None
    siteId: Optional[str] = None
    guideIds: Optional[list[str]] = None
    optionGroup: Optional[str] = None
    optionLabel: Optional[str] = None
    primary: Optional[bool] = None
    mapPages: Optional[list[str]] = None
    tickets: Optional[list[dict[str, Any]]] = None


class GuideBody(BaseModel):
    id: Optional[str] = None
    name: str
    aliases: list[str] = Field(default_factory=list)
    logistics: list[str] = Field(default_factory=list)
    proTips: list[str] = Field(default_factory=list)
    history: list[str] = Field(default_factory=list)
    route: list[str] = Field(default_factory=list)


class LinkGuideBody(BaseModel):
    guideId: str


class HighlightsBody(BaseModel):
    stopIds: list[str]


class FoodBody(BaseModel):
    food: Optional[dict[str, Any]] = None


def highlight_entry(stop: dict) -> dict[str, str]:
    kind = stop.get("kind") or "attraction"
    return {
        "stopId": stop.get("id") or "",
        "title": stop.get("title") or stop.get("id") or "",
        "time": stop.get("time") or "",
        "duration": (stop.get("duration") or "") if kind == "transit" else "",
        "summary": stop.get("notes") or stop.get("title") or "",
    }


def sync_highlight_snapshots(day: dict) -> None:
    stops_by_id = {s["id"]: s for s in day.get("stops") or []}
    refreshed = []
    for h in day.get("highlights") or []:
        sid = h.get("stopId")
        stop = stops_by_id.get(sid) if sid else None
        if not stop:
            continue
        refreshed.append(highlight_entry(stop))
    refreshed.sort(key=lambda h: h.get("time") or "99:99")
    day["highlights"] = refreshed


def day_has_option_stops(day: dict) -> bool:
    return any(s.get("optionGroup") for s in day.get("stops") or [])


def insert_stop_sorted(day: dict, stop: dict) -> None:
    """Insert stop without scrambling Option1-then-Option2 authoring order."""
    stops = day.setdefault("stops", [])
    if day_has_option_stops(day) or stop.get("optionGroup"):
        stops.append(stop)
        return
    stops.append(stop)
    stops.sort(key=lambda s: s.get("time") or "99:99")


@router.post("/trips/{slug}/days/{day_id}/stops")
def create_stop(
    slug: str,
    day_id: str,
    body: CreateStopBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    kind = body.kind or "attraction"
    stop = {
        "id": f"stop-{slugify(body.title)}-{uuid4().hex[:6]}",
        "time": body.time,
        "title": body.title,
        "duration": (body.duration or "") if kind == "transit" else "",
        "cost": None,
        "notes": None,
        "mapsUrl": None,
        "bookingRef": None,
        "bags": None,
        "transit": None,
        "siteId": None,
        "guideIds": [],
        "tickets": [],
        "mapPages": [],
        "optionGroup": body.optionGroup,
        "optionLabel": body.optionLabel,
        "primary": body.primary,
        "kind": kind,
    }
    insert_stop_sorted(day, stop)
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.patch("/trips/{slug}/days/{day_id}/stops/{stop_id}")
def patch_stop(
    slug: str,
    day_id: str,
    stop_id: str,
    body: PatchStopBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        stop[k] = v
    # Drop legacy stop.hours; duration only for transit
    stop.pop("hours", None)
    kind = stop.get("kind") or "attraction"
    if kind != "transit":
        stop["duration"] = ""
        stop["bookingRef"] = None
        stop["bags"] = None
        stop["transit"] = None
    if kind in ("photo", "rest"):
        stop["cost"] = None
    ensure_stop_arrays(stop)
    sync_highlight_snapshots(day)
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/days/{day_id}/stops/{stop_id}")
def delete_stop(
    slug: str,
    day_id: str,
    stop_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    day["stops"] = [s for s in day.get("stops") or [] if s.get("id") != stop_id]
    day["highlights"] = [h for h in day.get("highlights") or [] if h.get("stopId") != stop_id]
    save_pack(slug, itinerary, sites, assets)
    return {"ok": True, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.post("/trips/{slug}/days/{day_id}/stops/{stop_id}/tickets")
async def upload_ticket(
    slug: str,
    day_id: str,
    stop_id: str,
    label: str = Form("Ticket"),
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    ensure_stop_arrays(stop)
    ticket_id = slugify(label) or uuid4().hex[:8]
    out_dir = WEB_PUBLIC / "images" / "tickets" / stop_id / ticket_id
    pages = convert_upload_to_jpegs(file, out_dir, "ticket-page")
    stop["tickets"] = [t for t in stop["tickets"] if t.get("id") != ticket_id]
    stop["tickets"].append({"id": ticket_id, "label": label.strip() or "Ticket", "pages": pages})
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/days/{day_id}/stops/{stop_id}/tickets/{ticket_id}")
def delete_ticket(
    slug: str,
    day_id: str,
    stop_id: str,
    ticket_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    ensure_stop_arrays(stop)
    stop["tickets"] = [t for t in stop["tickets"] if t.get("id") != ticket_id]
    ticket_dir = WEB_PUBLIC / "images" / "tickets" / stop_id / ticket_id
    if ticket_dir.is_dir():
        shutil.rmtree(ticket_dir, ignore_errors=True)
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.post("/trips/{slug}/days/{day_id}/stops/{stop_id}/map")
async def upload_map(
    slug: str,
    day_id: str,
    stop_id: str,
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    ensure_stop_arrays(stop)
    out_dir = WEB_PUBLIC / "images" / "maps" / stop_id
    pages = convert_upload_to_jpegs(file, out_dir, "map-page")
    stop["mapPages"] = pages
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/days/{day_id}/stops/{stop_id}/map")
def clear_map(
    slug: str,
    day_id: str,
    stop_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    ensure_stop_arrays(stop)
    stop["mapPages"] = []
    map_dir = WEB_PUBLIC / "images" / "maps" / stop_id
    if map_dir.is_dir():
        shutil.rmtree(map_dir, ignore_errors=True)
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.post("/trips/{slug}/guides")
def upsert_guide(
    slug: str,
    body: GuideBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    gid = body.id or slugify(body.name)
    existing = next((s for s in sites if s.get("id") == gid), None)
    if existing:
        existing["name"] = body.name
        existing["aliases"] = body.aliases
        existing["logistics"] = body.logistics
        existing["proTips"] = body.proTips
        existing["history"] = body.history
        existing["route"] = body.route
        existing.setdefault("attachments", [])
        guide = existing
    else:
        guide = {
            "id": gid,
            "name": body.name,
            "aliases": body.aliases,
            "logistics": body.logistics,
            "proTips": body.proTips,
            "history": body.history,
            "route": body.route,
            "attachments": [],
        }
        sites.append(guide)
    save_pack(slug, itinerary, sites, assets)
    return {"guide": guide, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.post("/trips/{slug}/days/{day_id}/stops/{stop_id}/guides")
def link_guide(
    slug: str,
    day_id: str,
    stop_id: str,
    body: LinkGuideBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    ensure_stop_arrays(stop)
    if not any(s.get("id") == body.guideId for s in sites):
        raise HTTPException(404, f"Guide '{body.guideId}' not found")
    if body.guideId not in stop["guideIds"]:
        stop["guideIds"].append(body.guideId)
    if not stop.get("siteId"):
        stop["siteId"] = body.guideId
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/days/{day_id}/stops/{stop_id}/guides/{guide_id}")
def unlink_guide(
    slug: str,
    day_id: str,
    stop_id: str,
    guide_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stop = find_stop(day, stop_id)
    ensure_stop_arrays(stop)
    stop["guideIds"] = [g for g in stop["guideIds"] if g != guide_id]
    if stop.get("siteId") == guide_id:
        stop["siteId"] = stop["guideIds"][0] if stop["guideIds"] else None
    save_pack(slug, itinerary, sites, assets)
    return {"stop": stop, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.post("/trips/{slug}/guides/{guide_id}/attachments")
async def upload_guide_attachment(
    slug: str,
    guide_id: str,
    label: str = Form("Attachment"),
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    guide = next((s for s in sites if s.get("id") == guide_id), None)
    if not guide:
        raise HTTPException(404, f"Guide '{guide_id}' not found")
    guide.setdefault("attachments", [])
    att_id = slugify(label) or uuid4().hex[:8]
    out_dir = WEB_PUBLIC / "images" / "guides" / guide_id
    pages = convert_upload_to_jpegs(file, out_dir, f"attach-{att_id}")
    guide["attachments"] = [a for a in guide["attachments"] if a.get("id") != att_id]
    guide["attachments"].append(
        {"id": att_id, "label": label.strip() or "Attachment", "pages": pages}
    )
    save_pack(slug, itinerary, sites, assets)
    return {"guide": guide, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/guides/{guide_id}/attachments/{attachment_id}")
def delete_guide_attachment(
    slug: str,
    guide_id: str,
    attachment_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    guide = next((s for s in sites if s.get("id") == guide_id), None)
    if not guide:
        raise HTTPException(404, f"Guide '{guide_id}' not found")
    guide.setdefault("attachments", [])
    guide["attachments"] = [a for a in guide["attachments"] if a.get("id") != attachment_id]
    for f in (WEB_PUBLIC / "images" / "guides" / guide_id).glob(f"attach-{attachment_id}-*.jpg"):
        f.unlink(missing_ok=True)
    save_pack(slug, itinerary, sites, assets)
    return {"guide": guide, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.put("/trips/{slug}/days/{day_id}/highlights")
def set_highlights(
    slug: str,
    day_id: str,
    body: HighlightsBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    stops_by_id = {s["id"]: s for s in day.get("stops") or []}
    highlights = []
    for sid in body.stopIds:
        stop = stops_by_id.get(sid)
        if not stop:
            continue
        highlights.append(highlight_entry(stop))
    highlights.sort(key=lambda h: h.get("time") or "99:99")
    day["highlights"] = highlights
    save_pack(slug, itinerary, sites, assets)
    return {"day": day, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.put("/trips/{slug}/days/{day_id}/food")
def set_food(
    slug: str,
    day_id: str,
    body: FoodBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    if body.food is None or not (body.food.get("name") or "").strip():
        day["food"] = None
    else:
        day["food"] = {
            "name": body.food.get("name") or "",
            "vibe": body.food.get("vibe") or "",
            "mustTry": body.food.get("mustTry") or "",
            "hours": body.food.get("hours"),
            "cost": body.food.get("cost"),
        }
    save_pack(slug, itinerary, sites, assets)
    return {"day": day, "itinerary": itinerary, "sites": sites, "assets": assets}


# --- Trip + day metadata CMS ---


def load_trip_meta(slug: str) -> dict[str, Any]:
    pack = pack_dir(slug)
    meta = load_json(pack / "trip.json", {})
    if not meta:
        meta = {"slug": slug, "title": slug, "status": "active", "record_status": "active"}
    return meta


def save_trip_meta(slug: str, meta: dict[str, Any]) -> None:
    write_json(pack_dir(slug) / "trip.json", meta)
    commit_pack(slug)


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value[:10])
    except ValueError as exc:
        raise HTTPException(400, f"Invalid date: {value}") from exc


def format_date_label(d: date) -> str:
    return d.strftime("%A, %b %d").replace(" 0", " ")


def format_nav_label(d: date, city: str, day_type: str) -> str:
    short = d.strftime("%a %b %d").replace(" 0", " ")
    if day_type == "transit":
        return f"{short} · Transit"
    city_bit = (city or "Day").split(",")[0].strip()
    if len(city_bit) > 18:
        city_bit = city_bit[:16] + "…"
    return f"{short} · {city_bit}"


def sync_end_date(meta: dict[str, Any], itinerary: dict) -> None:
    days = itinerary.get("days") or []
    if not days:
        meta["end_date"] = meta.get("start_date")
        return
    last = max((d.get("date") or "") for d in days)
    if last:
        meta["end_date"] = last


def shift_day_dates(itinerary: dict, delta_days: int) -> None:
    if not delta_days:
        return
    for day in itinerary.get("days") or []:
        raw = day.get("date")
        if not raw:
            continue
        d = parse_iso_date(raw) + timedelta(days=delta_days)
        day["date"] = d.isoformat()
        day["dateLabel"] = format_date_label(d)
        day["navLabel"] = format_nav_label(d, day.get("city") or "", day.get("type") or "activity")


class CreateTripBody(BaseModel):
    title: str
    start_date: str
    slug: Optional[str] = None


class PatchTripBody(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None


class CreateDayBody(BaseModel):
    city: str = "New city"
    headline: str = "New day"
    briefing: str = ""
    type: str = "activity"
    date: Optional[str] = None


class PatchDayBody(BaseModel):
    city: Optional[str] = None
    headline: Optional[str] = None
    briefing: Optional[str] = None
    navLabel: Optional[str] = None
    dateLabel: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None
    heroImage: Optional[str] = None
    weather: Optional[str] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None


@router.post("/trips")
def create_trip(body: CreateTripBody, _: None = Depends(require_admin)) -> dict[str, Any]:
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Title required")
    start = parse_iso_date(body.start_date)
    slug = slugify(body.slug or title)
    dest = CONTENT_TRIPS / slug
    if dest.exists():
        slug = f"{slug}-{uuid4().hex[:4]}"
        dest = CONTENT_TRIPS / slug
    dest.mkdir(parents=True)
    trip_id = str(uuid4())
    meta = {
        "id": trip_id,
        "slug": slug,
        "title": title,
        "start_date": start.isoformat(),
        "end_date": start.isoformat(),
        "status": "planning",
        "record_status": "active",
    }
    itinerary = {"title": title, "days": []}
    sites: list = []
    assets: dict = {"sites": {}, "tickets": {}, "maps": {}}
    write_json(dest / "trip.json", meta)
    write_json(dest / "itinerary.json", itinerary)
    write_json(dest / "sites.json", sites)
    write_json(dest / "assets.json", assets)
    commit_pack(slug)
    return {"trip": meta, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.patch("/trips/{slug}")
def patch_trip(
    slug: str,
    body: PatchTripBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    meta = load_trip_meta(slug)
    itinerary, sites, assets = load_pack(slug)
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        title = str(data["title"]).strip()
        if not title:
            raise HTTPException(400, "Title required")
        meta["title"] = title
        itinerary["title"] = title
    if "status" in data and data["status"] is not None:
        meta["status"] = data["status"]
    if "start_date" in data and data["start_date"]:
        new_start = parse_iso_date(data["start_date"])
        old_raw = meta.get("start_date")
        if old_raw:
            old_start = parse_iso_date(old_raw)
            delta = (new_start - old_start).days
            shift_day_dates(itinerary, delta)
        meta["start_date"] = new_start.isoformat()
    if "end_date" in data and data["end_date"]:
        meta["end_date"] = parse_iso_date(data["end_date"]).isoformat()
    else:
        sync_end_date(meta, itinerary)
    write_json(pack_dir(slug) / "trip.json", meta)
    save_pack(slug, itinerary, sites, assets)
    return {"trip": meta, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}")
def soft_delete_trip(slug: str, _: None = Depends(require_admin)) -> dict[str, Any]:
    meta = load_trip_meta(slug)
    meta["record_status"] = "deleted"
    meta["status"] = "archived"
    save_trip_meta(slug, meta)
    return {"ok": True, "trip": meta}


@router.post("/trips/{slug}/days")
def create_day(
    slug: str,
    body: CreateDayBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    meta = load_trip_meta(slug)
    itinerary, sites, assets = load_pack(slug)
    days = itinerary.setdefault("days", [])
    if body.date:
        d = parse_iso_date(body.date)
    elif days:
        last = max(parse_iso_date(x["date"]) for x in days if x.get("date"))
        d = last + timedelta(days=1)
    else:
        d = parse_iso_date(meta.get("start_date") or date.today().isoformat())
    day_type = body.type if body.type in ("transit", "activity") else "activity"
    city = body.city.strip() or "New city"
    headline = body.headline.strip() or "New day"
    day = {
        "id": f"day-{d.isoformat()}-{uuid4().hex[:4]}",
        "date": d.isoformat(),
        "dateLabel": format_date_label(d),
        "navLabel": format_nav_label(d, city, day_type),
        "city": city,
        "type": day_type,
        "headline": headline,
        "briefing": body.briefing or "",
        "weather": None,
        "sunrise": None,
        "sunset": None,
        "heroImage": None,
        "food": None,
        "highlights": [],
        "stops": [],
    }
    days.append(day)
    days.sort(key=lambda x: x.get("date") or "9999-99-99")
    sync_end_date(meta, itinerary)
    write_json(pack_dir(slug) / "trip.json", meta)
    save_pack(slug, itinerary, sites, assets)
    return {"day": day, "trip": meta, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.patch("/trips/{slug}/days/{day_id}")
def patch_day(
    slug: str,
    day_id: str,
    body: PatchDayBody,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    meta = load_trip_meta(slug)
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        day[k] = v
    if "date" in data and data["date"]:
        d = parse_iso_date(data["date"])
        day["date"] = d.isoformat()
        if "dateLabel" not in data:
            day["dateLabel"] = format_date_label(d)
        if "navLabel" not in data:
            day["navLabel"] = format_nav_label(
                d, day.get("city") or "", day.get("type") or "activity"
            )
    elif "city" in data or "type" in data:
        try:
            d = parse_iso_date(day.get("date") or date.today().isoformat())
            if "navLabel" not in data:
                day["navLabel"] = format_nav_label(
                    d, day.get("city") or "", day.get("type") or "activity"
                )
        except HTTPException:
            pass
    sync_end_date(meta, itinerary)
    write_json(pack_dir(slug) / "trip.json", meta)
    save_pack(slug, itinerary, sites, assets)
    return {"day": day, "trip": meta, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/days/{day_id}")
def delete_day(
    slug: str,
    day_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    meta = load_trip_meta(slug)
    itinerary, sites, assets = load_pack(slug)
    before = len(itinerary.get("days") or [])
    itinerary["days"] = [d for d in itinerary.get("days") or [] if d.get("id") != day_id]
    if len(itinerary["days"]) == before:
        raise HTTPException(404, f"Day '{day_id}' not found")
    sync_end_date(meta, itinerary)
    write_json(pack_dir(slug) / "trip.json", meta)
    save_pack(slug, itinerary, sites, assets)
    return {"ok": True, "trip": meta, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.post("/trips/{slug}/days/{day_id}/hero")
async def upload_hero(
    slug: str,
    day_id: str,
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    out_dir = WEB_PUBLIC / "images" / "heroes" / day_id
    pages = convert_upload_to_jpegs(file, out_dir, "hero")
    day["heroImage"] = pages[0] if pages else None
    save_pack(slug, itinerary, sites, assets)
    return {"day": day, "itinerary": itinerary, "sites": sites, "assets": assets}


@router.delete("/trips/{slug}/days/{day_id}/hero")
def clear_hero(
    slug: str,
    day_id: str,
    _: None = Depends(require_admin),
) -> dict[str, Any]:
    itinerary, sites, assets = load_pack(slug)
    day = find_day(itinerary, day_id)
    day["heroImage"] = None
    hero_dir = WEB_PUBLIC / "images" / "heroes" / day_id
    if hero_dir.is_dir():
        shutil.rmtree(hero_dir, ignore_errors=True)
    save_pack(slug, itinerary, sites, assets)
    return {"day": day, "itinerary": itinerary, "sites": sites, "assets": assets}
