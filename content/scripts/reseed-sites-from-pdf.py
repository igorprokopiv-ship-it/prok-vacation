#!/usr/bin/env python3
"""
Reseed / enrich sites.json from EU2026-Sites.pdf (+ format PDF).

Keeps readable existing structure, merges every distinct fact from the PDFs,
and polishes English. Attachment-only stubs are left untouched.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITES_PACK = ROOT / "content/trips/eu2026/sites.json"
SITES_WEB = ROOT / "web/src/data/sites.json"
COVERAGE = ROOT / "content/scripts/sites-reseed-coverage.md"
RAW_EXTRACT = ROOT / "tmp-sites-extract.txt"
FMT_EXTRACT = ROOT / "tmp-sites-format-extract.txt"
RAW_PDF = Path(
    r"d:\OneDrive\Prokopiv Documents\Projects\Vacation\2026 Europe\EU2026-Sites.pdf"
)
FMT_PDF = Path(
    r"d:\OneDrive\Prokopiv Documents\Projects\Vacation\2026 Europe\EU2026-Sites-format.pdf"
)

SKIP_IDS = {
    "phantom-of-the-opera",
    "bounce-bag-storage",
    "eurostar-london-paris",
    "pizza-gelato-class",
    "flight-boys-london",
    "flight-hanna-london",
    "flight-boy-dc",
    "flight-hanna-dc",
    "flight-hanna-iceland",
    "sainte-chapelle-visitor-guide",
}

EXTRA_HEADINGS: list[tuple[str, str]] = [
    ("Queen Elizabeth Tower / Big Ben", "big-ben"),
    ("Queen Elizabeth Tower", "big-ben"),
    ("Officers Inspection", "horse-guards"),
    ("Vatican Museum & Sistine Chapel", "vatican-museums"),
    ("Vatican Museums & Sistine Chapel", "vatican-museums"),
    ("Vatican Museum", "vatican-museums"),
    ("Vatican Museums", "vatican-museums"),
    ("Roman Forum", "roman-forum"),
    ("Arc de Triomphe du Carrousel", "arc-du-carrousel"),
    ("Arc De Triomphe Du Carrousel", "arc-du-carrousel"),
    ("Arc de Triomphe", "arc-de-triomphe"),
    ("Palace of Versailles", "versailles"),
    ("Eiffel Tower", "eiffel-tower"),
    ("Catacombs of Paris", "catacombs"),
    ("Piazza Navona", "piazza-navona"),
    ("Piazza Novona", "piazza-navona"),
    ("Spanish Steps", "spanish-steps"),
    ("Trevi Fountain", "trevi-fountain"),
    ("Altar of the Fatherland", "altar-of-the-fatherland"),
    ("Saint Peter's Basilica", "st-peters-basilica"),
    ("St. Peter's Basilica", "st-peters-basilica"),
    ("Castel Sant' Angelo", "castel-sant-angelo"),
    ("Castel Sant'Angelo", "castel-sant-angelo"),
    ("Mt. Vesuvius", "mt-vesuvius"),
    ("Mt Vesuvius", "mt-vesuvius"),
    ("Jardin du Palais Royal", "palais-royal"),
    ("Jardin De Palais Royal", "palais-royal"),
    ("Notre-Dame Cathedral", "notre-dame"),
    ("Seine River Cruise", "seine-cruise"),
    ("Harry Potter Studios", "harry-potter-studios"),
    ("Radcliffe Square / Bodleian / Sheldonian / University Church", "radcliffe-square"),
    ("Palace of Westminster (Parliament)", "palace-of-westminster"),
    ("Palace of Westminster", "palace-of-westminster"),
    ("Shakespeare's Globe", "shakespeare-globe"),
    ("St. Paul's Cathedral", "st-pauls-cathedral"),
    ("Capitoline Hill / Piazza del Campidoglio", "capitoline-hill"),
    ("Trajan's Column", "trajans-column"),
    ("Piazza del Popolo", "piazza-del-popolo"),
    ("Baths of Caracalla", "baths-of-caracalla"),
    ("Arch of Constantine", "arch-of-constantine"),
    ("Palatine Hill", "palatine-hill"),
    ("Circus Maximus", "circus-maximus"),
    ("Golden Hind", "golden-hind"),
    ("Tower Bridge", "tower-bridge"),
    ("British Museum", "british-museum"),
    ("Magdalen College", "magdalen-college"),
    ("Christ Church", "christ-church"),
    ("Trafalgar Square", "trafalgar-square"),
    ("Westminster Abbey", "westminster-abbey"),
    ("Buckingham Palace", "buckingham-palace"),
    ("London Wall", "london-wall"),
    ("Tower of London", "tower-of-london"),
    ("The Louvre", "louvre"),
    ("Sainte-Chapelle", "sainte-chapelle"),
    ("Trocadero", "trocadero"),
    ("Colosseum", "colosseum"),
    ("Pompeii", "pompeii"),
    ("Pantheon", "pantheon"),
    ("Big Ben", "big-ben"),
]

SPELLFIX = [
    (r"\bAnne Berlin\b", "Anne Boleyn"),
    (r"\bAnne Bolin\b", "Anne Boleyn"),
    (r"\bBechum Tower\b", "Beauchamp Tower"),
    (r"\bNapolean\b", "Napoleon"),
    (r"\bchalice \(dropping ate\)", "portcullis (dropping gate)"),
    (r"\bwooden chalice\b", "wooden portcullis"),
    (r"\bWere kings and queens lived\b", "Where kings and queens lived"),
    (r"\bWere famous prisoners were kept\b", "Where famous prisoners were kept"),
    (r"\bBuild by\b", "Built by"),
    (r"\bBuild in\b", "Built in"),
    (r"\bNovona\b", "Navona"),
    (r"\bSanit'\b", "Sant'"),
    (r"\bChappel\b", "Chapel"),
    (r"\bBritian\b", "Britain"),
    (r"\bMichaelngelo\b", "Michelangelo"),
    (r"\bexpended it\b", "expanded it"),
    (r"\bmath the heigh\b", "matched the height"),
    (r"\bCrown of Thornes\b", "Crown of Thorns"),
    (r"\bpickup your\b", "pick up your"),
    (r"\bprophesies\b", "prophecies"),
    (r"\bdoesn't run in rain\b", "doesn't run in rain"),
    (r"\bfed raw meat\)\.", "fed raw meat and blood-soaked biscuits)."),
]


def extract_pdf(pdf_path: Path, out_path: Path) -> str:
    if out_path.is_file() and out_path.stat().st_size > 500:
        return out_path.read_text(encoding="utf-8")
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(pdf_path))
    parts = []
    for i in range(len(pdf)):
        t = pdf[i].get_textpage().get_text_bounded() or ""
        parts.append(f"===== PAGE {i + 1} =====\n{t}")
    text = "\n".join(parts)
    out_path.write_text(text, encoding="utf-8")
    return text


def strip_chrome(text: str) -> str:
    text = re.sub(r"===== PAGE \d+ =====\n", "\n", text)
    text = re.sub(r"Vacation Record Page \d+\s*", "\n", text)
    text = re.sub(r"Sites & Attractions\s*", "\n", text)
    text = re.sub(r"Tuesday, September 29, 2026 07:56\s*", "\n", text)
    text = re.sub(
        r"^Site\s+Logistics\s+Pro-Tips\s+History\s+The Route\s*",
        "",
        text,
        flags=re.I | re.M,
    )
    return text


def polish(s: str) -> str:
    s = s.strip(" •○-\t|")
    s = re.sub(r"\s+", " ", s)
    for pat, repl in SPELLFIX:
        s = re.sub(pat, repl, s, flags=re.I)
    s = re.sub(r"\bdoesn'?t\b", "doesn't", s, flags=re.I)
    s = re.sub(r"\bcan'?t\b", "can't", s, flags=re.I)
    if s and s[0].islower():
        s = s[0].upper() + s[1:]
    # Finish incomplete sentence endings from wrap
    s = s.rstrip(" •,;:")
    return s


def norm_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def covers(existing: str, candidate: str) -> bool:
    """True if candidate's distinctive tokens are already present."""
    words = [
        w
        for w in re.findall(r"[a-z0-9]{5,}", candidate.lower())
        if w
        not in {
            "about",
            "their",
            "there",
            "which",
            "where",
            "after",
            "before",
            "through",
            "during",
            "built",
            "tower",
            "museum",
            "palace",
            "church",
            "cathedral",
        }
    ]
    if not words:
        return norm_key(candidate) in norm_key(existing)
    hits = sum(1 for w in words if w in existing.lower())
    return hits >= max(2, int(len(words) * 0.55))


def classify(line: str) -> str:
    low = line.lower()
    if re.search(
        r"\b(hours?:|cost:|ticket|entrance|book |prebook|audio guide|"
        r"family ticket|€|£|last admission|closed on|sells out|stairs|"
        r"elevator|bag|arrive |shuttle|worth it to buy)\b",
        low,
    ):
        return "logistics"
    if re.search(
        r"\b(tip|grab |bring |one-way|cannot go|make sure|optional |"
        r"prioritize|cheaper|umbrella|jacket|take your time|don't |"
        r"use provided|arrive early)\b",
        low,
    ):
        return "proTips"
    if re.search(
        r"\b(built |founded |century|\bad\b|\bbc\b|king |queen |emperor|"
        r"legend|myth|named |commemorat|destroyed|commissioned|replica |"
        r"history|william the conqueror|housed at|produced over)\b",
        low,
    ):
        return "history"
    return "route"


def build_heading_map(sites: list[dict]) -> list[tuple[str, str]]:
    keys: list[tuple[str, str]] = []
    for s in sites:
        keys.append((s["name"], s["id"]))
        for a in s.get("aliases") or []:
            if len(a) >= 5:
                keys.append((a, s["id"]))
    keys.extend(EXTRA_HEADINGS)
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for name, sid in sorted(keys, key=lambda x: -len(x[0])):
        k = name.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append((name, sid))
    return out


def split_sites(text: str, headings: list[tuple[str, str]]) -> dict[str, str]:
    lower = text.lower()
    hits: list[tuple[int, int, str]] = []
    for name, sid in headings:
        start = 0
        nl = name.lower()
        while True:
            i = lower.find(nl, start)
            if i < 0:
                break
            if i > 0 and lower[i - 1].isalnum():
                start = i + len(nl)
                continue
            after = i + len(nl)
            if after < len(lower) and lower[after].isalnum():
                start = after
                continue
            hits.append((i, after, sid))
            start = after
    hits.sort()
    chosen: list[tuple[int, int, str]] = []
    last_end = -1
    i = 0
    while i < len(hits):
        start = hits[i][0]
        if start < last_end:
            i += 1
            continue
        group = [hits[i]]
        j = i + 1
        while j < len(hits) and hits[j][0] == start:
            group.append(hits[j])
            j += 1
        best = max(group, key=lambda h: h[1] - h[0])
        chosen.append(best)
        last_end = best[1]
        i = j
    chunks: dict[str, list[str]] = {}
    for idx, (start, end, sid) in enumerate(chosen):
        nxt = chosen[idx + 1][0] if idx + 1 < len(chosen) else len(text)
        body = text[end:nxt].strip()
        if len(body) >= 8:
            chunks.setdefault(sid, []).append(body)
    return {k: "\n".join(v) for k, v in chunks.items()}


def lines_from_chunk(chunk: str) -> list[str]:
    """Pull polished bullet/parenthetical facts from a site chunk."""
    # Normalize bullets
    t = chunk.replace("\u25cb", "○")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\s*[•]\s*", "\n• ", t)
    t = re.sub(r"\s*[○]\s*", "\n○ ", t)
    # Join soft wraps: non-bullet continuation lines
    joined: list[str] = []
    buf = ""
    for ln in t.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        if ln.startswith("• ") or ln.startswith("○ "):
            if buf:
                joined.append(buf)
            buf = ln[2:].strip()
            continue
        if not buf:
            # Parenthetical route stop: "Name (facts...)"
            buf = ln
            continue
        if buf.endswith((".", "!", "?", ")")) and re.match(r"^[A-Z]", ln):
            joined.append(buf)
            buf = ln
        else:
            buf = buf + " " + ln
    if buf:
        joined.append(buf)

    out: list[str] = []
    for item in joined:
        item = polish(item)
        if not item or len(item) < 8:
            continue
        # Expand "Name (a, b, c)" into a single rich route/history line
        m = re.match(r"^(.{2,60}?)\s*\((.+)\)\s*$", item)
        if m and not item.lower().startswith(("hours", "cost")):
            title, body = m.group(1).strip(), m.group(2).strip()
            line = polish(f"{title} — {body}")
            out.append(line)
        else:
            out.append(item)
    return out


# Facts known to be in the raw PDF but often dropped by Gemini / format PDF.
# Appended when the site is present and the fact isn't already covered.
RAW_BONUS: dict[str, dict[str, list[str]]] = {
    "tower-of-london": {
        "logistics": [
            "Walk southeast from Apex City of London Hotel (~3–5 min) to the West Gate entrance.",
            "Moat surrounds the fortress; the only way in is through Byward Tower.",
        ],
        "proTips": [
            "Yeoman Warder tour: included with admission; every ~30 min near the entrance; 45–60 min; led by military veterans who live on site with their families.",
            "Tour doesn't run in rain (umbrella safety) and does not include the Crown Jewels or White Tower — see those on your own.",
            "Pick up the Family Audio Guide at the kiosk just past the entrance.",
        ],
        "history": [
            "Raven legend: the kingdom and fortress fall if the six resident ravens ever leave; the Ravenmaster feeds them raw meat and blood-soaked biscuits.",
            "Crown Jewels: 23,000+ gemstones including Cullinan I; stolen once in 1671 by Colonel Thomas Blood, who was inexplicably pardoned.",
            "White Tower built by William the Conqueror in 1078 after 1066 to intimidate the Saxons; onion domes added in the 16th century for Queen Anne Boleyn's coronation.",
            "Torture here was tightly regulated — Privy Council permission required; only 48 recorded cases.",
        ],
        "route": [
            "Byward Tower — defended the main entrance since the 13th century; original wooden portcullis (dropping gate) still in place.",
            "Traitor's Gate — Edward I water gate; Tudor prisoners including Anne Boleyn arrived here; note the extra-small second door.",
            "Torture Tower / Lower Wakefield Tower — replicas of Tudor interrogation tools (rack, manacles).",
            "Medieval Palace (St Thomas's, Wakefield, Lanthorn) — Henry III / Edward I apartments; Wakefield vaulted ceiling and throne; Henry VI killed here; Oratory in St Thomas's with recreated medieval altar where Edward I prayed.",
            "White Tower — Royal Armouries (Henry VIII's oversized decorated armour), Chapel of St John (11th-century); wooden stairs once removable/burnable for defense; also used as a prison.",
            "Place of Executions — Anne Boleyn executed here.",
            "Waterloo Barracks / Crown Jewels — built by the Duke of Wellington after defeating Napoleon.",
            "Beauchamp Tower — where famous prisoners were held.",
        ],
    },
    "london-wall": {
        "history": [
            "Built on a ~200 AD Roman fort — first ~14 feet are Roman, then medieval rebuild.",
            "Enclosed Londinium and set City of London boundaries for over a millennium.",
            "At peak: ~2 miles long, 20 ft high, 8 ft thick; this fragment is one of the largest surviving sections.",
        ],
    },
    "harry-potter-studios": {
        "proTips": [
            "Grab free Activity Passports at entry (trivia, souvenir stamps, Golden Snitch scavenger hunt).",
            "One-way system: after the first soundstage into the outdoor Backlot you cannot go backward — take your time in every room.",
            "Backlot is fully outdoors (Knight Bus, Privet Drive, Butterbeer) — bring a hooded jacket or umbrella in late October.",
        ],
        "history": [
            "Housed at working Leavesden studios where all eight Harry Potter films were produced over ten years.",
            "After Deathly Hallows Part 2 wrapped, the crew preserved thousands of props, costumes, and sets as a behind-the-scenes exhibition.",
        ],
        "route": [
            "Hub / Tour Entrance / Experience Corridor — Ukrainian Ironbelly dragon suspended from the ceiling; short cinema intro then the screen lifts to reveal the entrance.",
            "The Great Hall — solid York stone floor (built for a decade of filming), forced perspective, practical lighting in the ceiling.",
            "Filmmakers & Interior Sets — Potions Classroom cauldrons stir via motion-triggered motors at Snape's desk; Dumbledore's office phone directories rebound in leather.",
            "Quidditch & SFX/VFX — mechanical rigs and multi-axis motion bases.",
            "Ministry of Magic — largest set (~30,000 sq ft), 9-meter fireplaces; green tiles are painted wood.",
            "Forbidden Forest — practical animatronics (Aragog, Hippogriff), not CGI.",
            "Platform 9¾ — genuine 1937 Great Western Railway steam locomotive.",
            "Backlot & Backlot Stage — Hogwarts Bridge; triple-decker Knight Bus weighted against tipping; Butterbeer Bar (vegan, non-alcoholic).",
            "Creature Effects — prosthetics, internal servos, latex molds.",
            "Gringotts & The Vaults — faux-marble pillars; ~38,000 pieces of rubber treasure in the Lestrange Vault; functional vault door.",
            "Diagon Alley — forced-perspective street.",
            "Art Department & Model Room — 1:24 Hogwarts model (86 artists; ~2,500 fiber-optic lights).",
            "Wand Room — 17,000+ individually hand-painted wand boxes named for cast and crew.",
        ],
    },
    "british-museum": {
        "history": [
            "First public national museum in the world.",
        ],
        "route": [
            "Ground Floor, Room 4 — Rosetta Stone: identical decree in Hieroglyphic, Demotic, and Ancient Greek; key to deciphering hieroglyphs; seized by the British in 1801.",
            "Rooms 6–10 — Colossal winged bulls / Lamassu (Room 6): 16-ton protective deities with five legs.",
            "Room 10 — Assyrian Lion Hunt reliefs; King Ashurbanipal's staged hunts.",
            "Room 18 — Parthenon Sculptures / Elgin Marbles (Phidias, 447–432 BC); ongoing repatriation dispute with Greece.",
            "Level 3, Rooms 54–59 — Standard of Ur (Room 56, ~2600 BC): wooden box with War/Peace mosaic panels.",
            "Room 56 — Royal Game of Ur: ~4,500-year-old playable game; rules reconstructed from a cuneiform tablet in the 1980s.",
            "Rooms 40–51 — Sutton Hoo ship burial (Room 41): early-7th-century Anglo-Saxon royal burial; rare iron and tinned-copper helmet.",
            "Room 40 — Lewis Chessmen: 12th-century walrus ivory; berserkers biting their shields.",
            "Room 67 — Sarangbang Korean scholar's study (no nails); Joseon Dynasty moon jars.",
        ],
    },
    "louvre": {
        "logistics": [
            "Largest art museum in the world (~35,000 works on display).",
            "Enter via underground stairs by the Arc de Triomphe du Carrousel to bypass outdoor pyramid lines.",
            "Pick up the audio guide on Level −1 under the glass pyramid.",
        ],
        "history": [
            "Built in the 1200s as a fortress, became a royal residence, then a museum in 1793 during the French Revolution.",
        ],
        "route": [
            "Level 1, Denon Wing, Room 711 — Mona Lisa (Leonardo); commoner wife; stolen in 1911 by an employee who hid in a broom closet.",
            "Room 711 — The Coronation of Napoleon (Napoleon crowning himself; the Pope looks bored).",
            "Room 713 — Liberty Leading the People (1830 revolution; the boy inspired Hugo's Gavroche).",
            "Room 703 — Winged Victory of Samothrace (2nd century BC) at the top of the Daru staircase, staged like a ship's prow.",
            "Room 705 — French Crown Jewels (Napoleon & Louis XV crowns); display inspired the Hall of Mirrors.",
            "Level −1, Room 135 — Medieval Louvre / castle wall and moat foundations from ~1190.",
            "Level 0, Room 345 — Venus de Milo (arms already missing when found in 1820).",
            "Room 348 — Salle des Caryatides (oldest surviving hall; four carved women hold the balcony); Sleeping Hermaphroditus (mattress carved later by Bernini).",
            "Room 345 — Borghese Gladiator.",
            "Richelieu — Palace of Darius / Near Eastern antiquities; Frieze of Archers (Room 233); Winged Bulls of Khorsabad (Room 229, ~30-ton, five legs); Code of Hammurabi (7-ft black basalt stele, “eye for an eye”).",
            "Level 1 — Napoleon III apartments (lavish drawing rooms).",
        ],
    },
    "colosseum": {
        "logistics": [
            "Hours: 08:30–16:30 (last admission 15:30).",
            "Tickets are hard to get — arrive ~30 minutes before your slot.",
            "Need two ticket types for Top Tier / Underground access.",
            "Official app audio guide only works inside the monument.",
        ],
        "history": [
            "Flavian Amphitheatre commissioned ~70–72 AD by Vespasian; opened 80 AD by Titus; Domitian added the upper level and underground.",
            "Later used as cemetery, fortress, and quarry (pockmarks from stolen iron clamps).",
            "Consecrated 1749; named after Nero's ~30 m Colossus statue (later reinterpreted as the Sun god).",
            "Taller than the Statue of Liberty without its pedestal (~48 m high, ~156 m across).",
        ],
        "route": [
            "Ground floor / Arena — wood floor once covered in sand; ~83×48 m.",
            "Four seating levels (1st for senators; 4th wooden seating for commoners) and four main entrances (east for gladiators, west for the dead).",
            "Underground (hypogeum) — ~28 lifts around the outer rim, each worked by ~8 people; cages released animals onto the arena.",
            "Second floor — museum and inner-ring walk for the best photos.",
        ],
    },
    "pompeii": {
        "logistics": [
            "Bring a water bottle — working fountains on site; very little shade.",
            "Only small bags allowed.",
        ],
        "history": [
            "Destroyed 24 Aug 79 AD under ~20 feet of ash after a ~3-day eruption; city covered ~4 square miles (Manhattan is ~7) with ~20,000 residents.",
        ],
        "route": [
            "General — stepping stones to cross streets; Roman grid (cardo N–S, decumanus E–W) meeting at the Forum.",
            "House of the Vettii — noted for the “vomitorium” / banquet context and well-preserved decoration.",
            "Forum — political and economic heart; Temple of Jupiter rededicated to the Capitoline Triad with underground treasury vaults.",
            "Basilica — city hall, largest building; three civic halls; Building of Eumachia; Macellum food market.",
            "Theatres — Large (~5,000) and Small (~1,500, originally roofed); gladiator barracks (wall sockets for an upper master's floor).",
            "Amphitheatre — oldest surviving stone amphitheatre (~80 BC, ~5,000 seats).",
            "Forum Granary — plaster casts of victims and a dog.",
            "Forum / Stabian Baths — hypocaust heating with hollow walls and floors.",
            "House of the Faun — largest mansion; Alexander Mosaic replica.",
            "Lupanar — brothel; explicit frescoes served as a visual “menu.”",
            "Villa of the Mysteries — quieter; Pompeian Red frescoes of a secret Dionysian cult.",
        ],
    },
    "st-peters-basilica": {
        "logistics": [
            "Dome stairs open at 08:00; buy the dome ticket on site.",
            "551 steps on foot, or 343 if you take the elevator partway — worth it.",
        ],
        "history": [
            "Largest church in the world; new basilica built 1506–1626 over Vatican Hill.",
            "Site of Caligula's chariot stadium where Nero blamed and executed Christians; St. Peter was crucified upside down nearby.",
        ],
        "route": [
            "St. Peter's Square — 320-ton red granite obelisk brought by Caligula (37 AD), later moved ~800 feet.",
            "Interior surfaces are mosaics, not paintings (humidity would rot paint).",
            "High Altar marks St. Peter's tomb (“Peter is here” inscription found in the 1940s).",
            "Bronze canopy columns — bronze taken from the Pantheon roof.",
            "Dome — design/painting associated with Michelangelo.",
            "Pietà — carved from a single block when Michelangelo was 24; his only signed work; attacked with a hammer in 1972; now behind bulletproof glass.",
            "Rooftop behind the dome — newer 3D exhibit area guarded by Swiss Guards.",
        ],
    },
    "vatican-museums": {
        "logistics": [
            "End the guided tour at the Sistine Chapel; max tour size ~25.",
            "After the tour, go back toward the beginning (don't exit) and continue at your own pace.",
        ],
        "history": [
            "~70,000 works, ~9 miles of corridors; collection pushed forward when Pope Julius II acquired the Laocoön in the early 16th century.",
        ],
        "route": [
            "Pinacoteca — The Transfiguration (Raphael's final unfinished painting; he died at 37); St. Jerome (Leonardo; fingerprints visible; once cut up and used as tabletop/stool cover).",
            "Pinecone Courtyard — Sphere Within Sphere (1990); you can physically spin it.",
            "Gregorian Egyptian Museum; Chiaramonti Museum.",
            "Pio Clementino — Apollo Belvedere; Laocoön and His Sons (unearthed 1506; Michelangelo watched it come out of the ground); Belvedere Torso (Michelangelo refused to “restore” it and called himself a pupil of the Torso).",
            "Gallery of Tapestries; Gallery of Maps (~120 m corridor, surprisingly accurate).",
            "Raphael Rooms — Battle of the Milvian Bridge; School of Athens (Plato has Leonardo's face; Michelangelo broods on the steps); Disputation of the Sacrament; The Parnassus.",
            "Sistine Chapel — ceiling (Creation of Adam: tension in the negative space; God's red mantle echoes a brain cross-section; Eve tucked under God's arm); Last Judgment painted ~25 years later after the Sack of Rome (darker tone; St. Bartholomew holds flayed skin with Michelangelo's face).",
            "Bramante Staircase (1932 double helix); Carriage Pavilion.",
        ],
    },
    "versailles": {
        "logistics": [
            "Closed Mondays.",
            "Bring passports for the kids; bring a driver's license if renting a golf cart; bring an umbrella.",
            "Fountains run mainly in summer.",
            "Enter via Entrance A with timed entry; be at the North Ministers Wing by ~09:45 for the guided tour (bypasses the security line).",
        ],
        "history": [
            "Started as Louis XIII's hunting lodge; expanded by Louis XIV (72-year reign; Versailles spending was a huge share of state wealth).",
        ],
        "route": [
            "~10:00 Guided tour of the King's Private Apartment — narrow passages, Clock Room, Corner Room, Louis XVI library, Games Room.",
            "~11:30 Hall of Mirrors — 73 m, 357 mirrors (a flex against Venice's mirror monopoly); German Empire proclaimed here 1871; Treaty of Versailles 1919.",
            "~11:45 State Apartments — seven rooms named for Roman deities; Diana/billiards; Apollo/throne room.",
            "~12:00 Empire Rooms (Napoleon crossing the Alps); ~12:15 Pavillon d'Orléans; ~12:30 Light of Liberty VR.",
            "~12:45–13:30 Gardens — Latona Fountain, Apollo Fountain, Grand Canal (~1,700 m, forced perspective).",
            "~13:45 Lunch at La Flottille; ~14:30 Grand Trianon; ~14:45 Marie Antoinette's Hamlet (rustic farmhouse).",
        ],
    },
    "eiffel-tower": {
        "proTips": [
            "2nd floor is the best viewpoint; take the 674 stairs on the way down if you can.",
            "Lights up ~10 minutes after sunset and sparkles on the hour.",
        ],
        "history": [
            "Built in two years for the 1889 World's Fair; ~7,000 metric tons of puddle iron.",
            "Con artist Victor Lustig “sold” it for scrap twice in the 1920s.",
            "Names of 72 French scientists engraved around the first floor; the iron structure can expand/bend up to ~18 cm in summer heat.",
            "Secret bunker under the South pillar.",
        ],
    },
    "baths-of-caracalla": {
        "logistics": [
            "Hours: 09:00–16:30; about €44; no need to prebook; get the VR headset.",
        ],
        "history": [
            "Built 212–216 AD by Emperor Caracalla; functioned until 537 AD when Ostrogoths cut the aqueducts.",
            "~62 acres; could host ~1,600 bathers at once; hypocaust floor heating with wood-fired furnaces in tunnels (slaves/oxen).",
            "Also had public libraries, gymnasiums, and saunas; intricate mosaic floors.",
        ],
    },
    "trajans-column": {
        "history": [
            "Erected 113 AD for Trajan's Dacian wars; ~125 ft tall; stacked ~17×30-ton marble drums; Trajan's golden urn once at the base.",
            "Bronze Trajan statue replaced with St. Peter by Pope Sixtus V in 1587.",
            "Spiral band widens as it rises (optical illusion); originally painted with miniature bronze weapons.",
            "Story in order: base (crossing the Danube), middle (permanent bridge), top (Dacian capital falls; King Decebalus takes his own life).",
        ],
    },
    "tower-bridge": {
        "logistics": [
            "Ticket office on the west side of the North Tower; you can enter up to ~20 minutes after the time on the ticket.",
        ],
        "history": [
            "Completed 1894; towers ~213 ft tall; clad in Cornish granite and Portland stone over the steel frame.",
            "High-level walkways closed in 1909 due to crime and reopened in 1982; bascule drive went from coal-fired steam to electro-hydraulic in 1976.",
        ],
        "route": [
            "Foundations — two massive piers (~70,000 tons of concrete).",
            "Suspension side spans ~270 ft; bascules use ~400-ton counterweights and take ~5 minutes to raise to ~83°.",
            "Walkways ~140 ft above the river; after the towers follow the blue line to the historic Engine Rooms and gift shop.",
        ],
    },
    "westminster-abbey": {
        "proTips": [
            "Use the provided audio guide.",
        ],
        "history": [
            "Royal coronation church since 1066; the most important church in Britain for crowning, marrying, and burying monarchs.",
        ],
        "route": [
            "Tomb of the Unknown Warrior (WW1).",
            "Coronation Chair — tradition dating to William the Conqueror.",
            "Tomb of Elizabeth I and Mary I (Elizabeth holds a globe).",
            "Tomb of Edward the Confessor (founded the abbey; at the liturgical center).",
            "Tombs/memorials of notable Britons including Isaac Newton and Winston Churchill.",
            "Lady Chapel — ornate ceiling; window honoring WWII fighter pilots.",
        ],
    },
    "horse-guards": {
        "proTips": [
            "Changing of the Guard at Buckingham Palace typically 11:00–11:45 (Mon/Wed/Fri/Sun).",
            "Horse Guards Parade mounted change ~11:00–11:30 (Mon/Wed/Fri).",
            "Officers' Inspection (what we're seeing) at Horse Guards Parade ~11:00–11:10 on Tue/Thu/Sat/Sun.",
            "Dismounted inspection at Horse Guards Parade ~15:45–16:00 daily.",
        ],
    },
    "buckingham-palace": {
        "history": [
            "The King's official London residence; State Rooms open to visitors mainly in summer.",
        ],
        "route": [
            "Eastern façade and balcony clad in Portland stone; ornate main gates with royal crests and gold.",
            "Queen Victoria Memorial — marble/bronze with Winged Victory on top; good photo spot on the steps.",
            "Walk into St James's Park to the Blue Bridge for a classic palace-over-the-lake view; Canada Gate on the Green Park side.",
        ],
    },
    "shakespeare-globe": {
        "logistics": [
            "Official guided tours last ~60 minutes; tickets are emailed the day before.",
        ],
        "history": [
            "Modern replica of the Elizabethan playhouse; original built 1599 (Shakespeare held a 12.5% share), burned 1613 after a stage cannon misfire.",
            "Rebuilt with traditional Tudor methods (wooden pegs, no steel); holds ~1,500 spectators (about half the original capacity).",
        ],
    },
    "golden-hind": {
        "history": [
            "Full-scale working replica of Sir Francis Drake's flagship — first English ship to circumnavigate the globe (1577–1580).",
            "Replica built with traditional methods and has sailed ~140,000 miles.",
        ],
    },
    "st-pauls-cathedral": {
        "logistics": [
            "Family ticket is usually cheaper; audio guide included.",
        ],
        "proTips": [
            "Not enough time for a full interior visit on this stop — exterior focus; optional 17:00 Choral Evensong if you want to see inside.",
            "You can climb the dome if you go inside.",
        ],
        "history": [
            "Rebuilt by Sir Christopher Wren after the Great Fire of London (1666).",
            "Originally intended as pure white stone; gilding/gold accents associated with the Victorian era.",
            "The apse took a direct hit in WWII and was rebuilt as an American memorial chapel.",
        ],
        "route": [
            "Focus on the massive dome and Whispering Gallery from the exterior vantage.",
        ],
    },
    "palace-of-westminster": {
        "history": [
            "Center of power since ~1016; land used as a royal residence from the time of Cnut.",
            "Medieval palace largely destroyed by fires in 1512 and 1834; today's building is 19th-century Gothic Revival.",
            "House of Commons met here to stay close to the king; nearby Banqueting House is where Charles I was executed in 1649.",
            "Prime Minister lives at 10 Downing Street.",
        ],
        "route": [
            "Westminster Hall — once among Europe's largest halls; wooden roof from 1397; historic throne room associations.",
        ],
    },
    "big-ben": {
        "history": [
            "“Big Ben” is the ~13-ton bell inside the Queen Elizabeth Tower.",
            "Clock accuracy is fine-tuned by adding or removing pre-decimal penny coins on the pendulum.",
            "Hidden prison room about a third of the way up; last used in 1880 for a Member of Parliament.",
        ],
    },
    "trafalgar-square": {
        "proTips": [
            "It is illegal to feed the pigeons here.",
        ],
        "history": [
            "Commemorates the 1805 British naval victory at Trafalgar that helped stop Napoleon's invasion plans.",
            "Nelson's Column; some decorations cast from melted French cannons; fountains were partly meant to keep crowd sizes down.",
        ],
    },
    "sainte-chapelle": {
        "logistics": [
            "About €22 per adult, kids free, ~€6 audio guide (confirm current pricing).",
        ],
        "history": [
            "Built 1242–1248 for King Louis IX to house the Crown of Thorns (the relic cost more than the chapel).",
            "Paris began on this island — Romans as Lutetia; Clovis later made it a royal/religious center.",
        ],
    },
    "catacombs": {
        "logistics": [
            "About 55°F year-round underground.",
        ],
        "history": [
            "Created in the late 18th century to relieve overflowing Paris cemeteries; ossuary lined with the bones of millions.",
        ],
    },
    "mt-vesuvius": {
        "logistics": [
            "Summit hike ~30–40 minutes; path is loose volcanic gravel — wear shoes with good grip.",
            "Noticeably cooler and windier at the crater rim.",
        ],
        "history": [
            "Active stratovolcano that buried Pompeii and Herculaneum in 79 AD.",
        ],
        "route": [
            "Peer into the active crater; panoramic views over the Bay of Naples.",
        ],
    },
    "roman-forum": {
        "history": [
            "Political, religious, and economic heart of ancient Rome; valley between the Palatine and Capitoline hills.",
        ],
        "route": [
            "Via Sacra — main triumphal route.",
            "Temple of Venus and Rome (Hadrian; among the largest temples).",
            "Arch of Titus — reliefs of soldiers carrying the Menorah from the 70 AD Jerusalem siege.",
            "Basilica of Constantine and Maxentius; Temple of Romulus (original ~1,700-year-old bronze doors and locking gear).",
            "Temple of Antoninus and Faustina — best preserved; later a church; column grooves from medieval scavengers.",
            "House of the Vestals; Temple of Divus Julius (Caesar's funeral pyre site).",
            "Curia Julia / Senate House — well preserved; doors are replicas (originals at San Giovanni).",
            "Arch of Septimius Severus — Caracalla had brother Geta's name chiseled off.",
            "Temple of Saturn — eight iconic columns; once the state treasury.",
        ],
    },
    "palatine-hill": {
        "history": [
            "Centermost of the Seven Hills; Romulus and Remus legend — Romulus kills Remus over a wall dispute and founds Rome on 21 Apr 753 BC.",
        ],
        "route": [
            "Views over the Colosseum and Forum; Circus Maximus viewing platforms.",
            "Flavian Palace / Domus Flavia (completed 92 AD) — jagged wall holes from stolen iron clamps that held marble.",
            "Stadium of Domitian — sunken private imperial garden shaped like a circus.",
        ],
    },
    "arch-of-constantine": {
        "history": [
            "Largest surviving Roman triumphal arch; built 312 AD for Constantine's victory over Maxentius.",
            "Constantine's vision of the Chi-Rho (“in this sign, conquer”); also marks his decennalia (10 years of rule).",
            "Most reliefs were reused from older monuments to Marcus Aurelius and Hadrian.",
        ],
    },
    "circus-maximus": {
        "history": [
            "Premier chariot-racing stadium; capacity estimates ~150,000–250,000.",
        ],
        "route": [
            "Walk the immense footprint; view up under the Palatine for the commoners' angle on the emperor's palace.",
        ],
    },
    "capitoline-hill": {
        "history": [
            "Citadel of early Rome — smallest hill but politically/religiously central.",
            "By the 1530s a muddy “goat hill”; Pope Paul III had Michelangelo redesign the piazza.",
            "Michelangelo rotated the square 180° toward papal authority and designed the 12-pointed star pavement (finished 1940).",
            "Marcus Aurelius statue is a 1981 laser replica; the original survived because Christians thought it was Constantine; legend says Judgment Day comes when the last gold flakes fall off.",
        ],
    },
    "altar-of-the-fatherland": {
        "logistics": [
            "Base/terrace access is free; rooftop elevator is paid (~$20) and worth it for the view.",
        ],
        "history": [
            "Built for Victor Emmanuel II, first king of unified Italy; locals call it the “Typewriter” or “Wedding Cake.”",
            "Tomb of the Unknown Soldier added 1921 (WWI remains, eternal flame).",
        ],
        "route": [
            "Glass elevators to the top terrace — one of the best vantage points in Rome.",
        ],
    },
    "castel-sant-angelo": {
        "proTips": [
            "Great views from the top terrace.",
        ],
        "history": [
            "Commissioned 134 AD by Hadrian as his mausoleum; Visigoths looted the ashes in 410 AD.",
            "In 590 AD Pope Gregory saw Archangel Michael sheathing his sword (omen the plague was ending) — hence the name.",
            "In 1527 Pope Clement VII escaped the sack of Rome via the Passetto di Borgo (~800 m corridor to the Vatican).",
            "In 1538 Benvenuto Cellini was imprisoned here and broke a leg escaping on bedsheets.",
        ],
        "route": [
            "Bridge/square — centuries of public executions by the papal executioner Mastro Titta.",
            "Ascend the dark spiraling brick ramp (original Roman funeral path) to the Sale Papali frescoed rooms.",
        ],
    },
    "pantheon": {
        "history": [
            "Best-preserved major Ancient Roman building; rebuilt under Hadrian with a record concrete dome and open oculus.",
        ],
    },
    "piazza-del-popolo": {
        "history": [
            "Grand northern gate entrance into Rome; primary site for public executions until 1826 (guillotine/mallet).",
            "Name means “People's Square.”",
            "Central Egyptian obelisk — oldest/tallest in Rome, from Ramses II (13th c. BC); brought by Augustus in 10 BC after defeating Cleopatra; originally stood in the Circus Maximus.",
        ],
    },
    "arc-du-carrousel": {
        "history": [
            "Built by Napoleon to celebrate the victory at Austerlitz; monumental gateway toward the Tuileries.",
            "Quadriga is a copy — Napoleon looted the original horses from Venice and later had to return them.",
        ],
        "route": [
            "Stand under the central arch and look west — framed axis through Place de la Concorde's obelisk, the Champs-Élysées, and the Arc de Triomphe.",
            "Note the eight rose-marble Corinthian columns.",
        ],
    },
    "magdalen-college": {
        "history": [
            "Working Oxford college balancing teaching with medieval architecture, cloisters, chapel, and Deer Park by the river.",
            "C.S. Lewis debated literature here with J.R.R. Tolkien.",
        ],
    },
    "christ-church": {
        "proTips": [
            "Prioritize for Max; multimedia tour is included with entry.",
        ],
        "history": [
            "Site roots in the 12th century; functions as both college and cathedral.",
            "Charles Dodgson (Lewis Carroll) was a mathematics don here; Great Hall inspired the Harry Potter dining hall.",
        ],
        "route": [
            "Great Hall, Christ Church Cathedral, and the medieval cloisters.",
        ],
    },
    "radcliffe-square": {
        "history": [
            "Bodleian is among Europe's oldest libraries (~400 years); the square is Oxford's visual epicenter.",
        ],
        "route": [
            "Walk the exteriors of the Bodleian, Sheldonian Theatre, and University Church for the classic “I'm in Oxford” hit.",
        ],
    },
}


def add_unique(bucket: list[str], line: str, blob: str, *, strict: bool = False) -> bool:
    line = polish(line)
    if len(line) < 8:
        return False
    if strict:
        # Bonus facts: add if any distinctive 6+ letter token is new.
        tokens = [
            w
            for w in re.findall(r"[a-z0-9]{6,}", line.lower())
            if w
            not in {
                "tower",
                "palace",
                "museum",
                "church",
                "cathedral",
                "history",
                "before",
                "after",
                "through",
                "during",
                "around",
                "built",
                "building",
            }
        ]
        if tokens and any(t not in blob.lower() for t in tokens):
            if line not in bucket:
                bucket.append(line)
                return True
            return False
    if covers(blob, line):
        return False
    if covers(" ".join(bucket), line):
        return False
    bucket.append(line)
    return True


def dedupe_bucket(lines: list[str]) -> list[str]:
    """Drop near-duplicate lines (keep the longer/richer one)."""
    kept: list[str] = []
    for line in lines:
        line = polish(line)
        if not line:
            continue
        drop = False
        replace_at = None
        for i, prev in enumerate(kept):
            if covers(prev, line) or covers(line, prev):
                if len(line) > len(prev) + 12:
                    replace_at = i
                else:
                    drop = True
                break
        if drop:
            continue
        if replace_at is not None:
            kept[replace_at] = line
        else:
            kept.append(line)
    return kept


def main() -> int:
    """
    Apply curated RAW_BONUS facts (hand-mapped from EU2026-Sites.pdf) onto the
    existing sites.json base. Auto-splitting the PDFs cross-contaminates sites
    because of multi-column table reading order — do not ingest raw chunks.
    """
    # Ensure extracts exist for operator inspection / future curation.
    extract_pdf(RAW_PDF, RAW_EXTRACT)
    extract_pdf(FMT_PDF, FMT_EXTRACT)

    sites = json.loads(SITES_PACK.read_text(encoding="utf-8"))

    coverage = []
    updated = 0
    kept = 0
    added_total = 0

    for site in sites:
        sid = site["id"]
        if sid in SKIP_IDS:
            kept += 1
            coverage.append(f"| `{sid}` | skip (attachment) | 0 |")
            continue

        blob = " ".join(
            sum(
                (
                    list(site.get(k) or [])
                    for k in ("logistics", "proTips", "history", "route")
                ),
                [],
            )
        )
        added = 0
        bonus = RAW_BONUS.get(sid)
        if bonus:
            for bucket, lines in bonus.items():
                for line in lines:
                    if add_unique(
                        site.setdefault(bucket, []), line, blob, strict=True
                    ):
                        blob += " " + line
                        added += 1

        for k in ("logistics", "proTips", "history", "route"):
            site[k] = dedupe_bucket([polish(x) for x in (site.get(k) or [])])

        if added:
            updated += 1
            added_total += added
            coverage.append(f"| `{sid}` | enriched from PDF notes | +{added} |")
        else:
            kept += 1
            coverage.append(f"| `{sid}` | polished / unchanged | 0 |")

    for path in (SITES_PACK, SITES_WEB):
        path.write_text(
            json.dumps(sites, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    COVERAGE.write_text(
        "# Sites reseed coverage\n\n"
        f"Sources: curated facts from `{RAW_PDF.name}` "
        f"(cross-checked with `{FMT_PDF.name}`).\n\n"
        "PDF table text is not auto-ingested (column reading order mixes sites).\n\n"
        f"Sites enriched: **{updated}** · Unchanged: **{kept}** · "
        f"Lines added: **{added_total}**\n\n"
        "| Site | Action | New lines |\n|------|--------|----------|\n"
        + "\n".join(coverage)
        + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {"updated": updated, "kept": kept, "added_total": added_total},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
