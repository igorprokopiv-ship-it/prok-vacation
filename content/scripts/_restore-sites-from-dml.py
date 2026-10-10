import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sql = (ROOT / "db/dml/20261009_text_snapshot.sql").read_text(encoding="utf-8")
idx = sql.find("INSERT INTO trip")
chunk = sql[idx : sql.find("ON CONFLICT (id) DO UPDATE", idx)]
start = chunk.find("'{'")
if start < 0:
    start = chunk.find("'{\"")
i = start + 1
out = []
while i < len(chunk):
    c = chunk[i]
    if c == "'" and chunk[i : i + 2] == "''":
        out.append("'")
        i += 2
        continue
    if c == "'":
        break
    out.append(c)
    i += 1
doc = json.loads("".join(out))
sites = doc["sites"]
for path in (
    ROOT / "content/trips/eu2026/sites.json",
    ROOT / "web/src/data/sites.json",
):
    path.write_text(
        json.dumps(sites, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
print("restored", len(sites), "tower.route", len(sites[0].get("route") or []))
