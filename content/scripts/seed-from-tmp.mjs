/**
 * Clear ticket/map images, convert TMP PDFs via Python pypdfium2,
 * migrate itinerary stops to tickets/mapPages/guideIds, add new guides.
 *
 * Usage: node content/scripts/seed-from-tmp.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const TMP = path.join(ROOT, 'TMP')
const PUBLIC = path.join(ROOT, 'web/public/images')
const PACK = path.join(ROOT, 'content/trips/eu2026')
const WEB_DATA = path.join(ROOT, 'web/src/data')

/** @type {Array<{ file: string, kind: 'ticket'|'map'|'guide-attachment', guideId: string, label: string, stopIds: string[] }>} */
const MAPPING = [
  // Clear venue matches
  { file: '2026-10-29 - Tower of London.pdf', kind: 'ticket', guideId: 'tower-of-london', label: 'Admission', stopIds: ['stop-day1-tower'] },
  { file: '2026-10-29 - Tower of London Map.pdf', kind: 'map', guideId: 'tower-of-london', label: 'Map', stopIds: ['stop-day1-tower'] },
  { file: '2026-10-30 - Harry Potter.pdf', kind: 'ticket', guideId: 'harry-potter-studios', label: 'Admission', stopIds: ['stop-day2-hp'] },
  { file: '2026-10-30 - Harry Potter Map', kind: 'map', guideId: 'harry-potter-studios', label: 'Map', stopIds: ['stop-day2-hp'] },
  { file: '2026-10-30 - Phantom of the Opera.pdf', kind: 'ticket', guideId: 'phantom-of-the-opera', label: 'Tickets', stopIds: ['stop-day2-phantom'] },
  { file: '2026-10-31 - Westminster Abbey.pdf', kind: 'ticket', guideId: 'westminster-abbey', label: 'Admission', stopIds: ['stop-day3-abbey'] },
  { file: '2026-10-31 - Westminster Abbey Map.pdf', kind: 'map', guideId: 'westminster-abbey', label: 'Map', stopIds: ['stop-day3-abbey'] },
  { file: '2026-10-31 - Palace of Westminster Map.pdf', kind: 'map', guideId: 'palace-of-westminster', label: 'Map', stopIds: ['stop-day3-parliament'] },
  { file: "2026-10-31 - Shakespeare's Globe.pdf", kind: 'ticket', guideId: 'shakespeare-globe', label: 'Tour', stopIds: ['stop-day3-globe'] },
  { file: '2026-10-31 - Tower Bridge.pdf', kind: 'ticket', guideId: 'tower-bridge', label: 'Admission', stopIds: ['stop-day3-tower-bridge'] },
  { file: '2026-11-01 - British Museum.pdf', kind: 'ticket', guideId: 'british-museum', label: 'Admission', stopIds: ['stop-day4-opt1-bm'] },
  { file: '2026-11-01 - British Museum Map.pdf', kind: 'map', guideId: 'british-museum', label: 'Map', stopIds: ['stop-day4-opt1-bm'] },
  { file: '2026-11-01 - London Bounce Bag Storage.pdf', kind: 'ticket', guideId: 'bounce-bag-storage', label: 'Bounce booking', stopIds: ['stop-day4-opt1-bounce', 'stop-day4-grab-bags'] },
  { file: '2026-11-01 - London to Paris.pdf', kind: 'ticket', guideId: 'eurostar-london-paris', label: 'Eurostar', stopIds: ['stop-day4-eurostar'] },
  { file: '2026-11-02 - Louvre.pdf', kind: 'ticket', guideId: 'louvre', label: 'Admission', stopIds: ['stop-day5-louvre'] },
  { file: '2026-11-02 - Louvre Map.pdf', kind: 'map', guideId: 'louvre', label: 'Map', stopIds: ['stop-day5-louvre'] },
  { file: '2026-11-02 - Sainte-Chapelle.pdf', kind: 'ticket', guideId: 'sainte-chapelle', label: 'Admission', stopIds: ['stop-day5-sainte-chapelle'] },
  { file: '2026-11-02 - Sainte Chapelle Vistor Guide.pdf', kind: 'guide-attachment', guideId: 'sainte-chapelle-visitor-guide', label: 'Visitor guide', stopIds: ['stop-day5-sainte-chapelle'] },
  { file: '2026-11-02 - Seine River Cruise.pdf', kind: 'ticket', guideId: 'seine-cruise', label: 'Cruise', stopIds: ['stop-day5-seine'] },
  { file: '2026-11-03 - Palace of Versailles.pdf', kind: 'ticket', guideId: 'versailles', label: 'Admission', stopIds: ['stop-day6-versailles'] },
  { file: '2026-11-03 - Palace of Versailles Map.pdf', kind: 'map', guideId: 'versailles', label: 'Map', stopIds: ['stop-day6-versailles'] },
  { file: '2026-11-03 - Eiffel Tower.pdf', kind: 'ticket', guideId: 'eiffel-tower', label: 'Admission', stopIds: ['stop-day6-eiffel'] },
  { file: '2026-11-04 - Pizza and Gelato Cooking Class.pdf', kind: 'ticket', guideId: 'pizza-gelato-class', label: 'Class booking', stopIds: ['stop-day7-mattei'] },
  { file: '2026-11-05 - Colosseum.pdf', kind: 'ticket', guideId: 'colosseum', label: 'Admission', stopIds: ['stop-day8-colosseum'] },
  { file: '2026-11-05 - Forum Map.pdf', kind: 'map', guideId: 'roman-forum', label: 'Map', stopIds: ['stop-day8-forum'] },
  { file: '2026-11-05 - Bathes of Caracalla Map.jpg', kind: 'map', guideId: 'baths-of-caracalla', label: 'Map', stopIds: ['stop-day8-caracalla'] },
  { file: '2026-11-06 - Vatican Museums.pdf', kind: 'ticket', guideId: 'vatican-museums', label: 'Admission', stopIds: ['stop-day9-vatican'] },
  { file: '2026-11-06 - Vatican Museums Map.pdf', kind: 'map', guideId: 'vatican-museums', label: 'Map', stopIds: ['stop-day9-vatican'] },
  { file: "2026-11-06 - Castel Sant' Angelo.pdf", kind: 'ticket', guideId: 'castel-sant-angelo', label: 'Admission', stopIds: ['stop-day9-castel'] },
  { file: '2026-11-07 - Pompeii.pdf', kind: 'ticket', guideId: 'pompeii', label: 'Admission', stopIds: ['stop-day10-pompeii'] },
  { file: '2026-11-07 - Pompeii Map.pdf', kind: 'map', guideId: 'pompeii', label: 'Map', stopIds: ['stop-day10-pompeii'] },
  // Flights
  { file: '2026-10-28 - Boys to London.pdf', kind: 'ticket', guideId: 'flight-boys-london', label: 'Boys IAD→LGW', stopIds: ['stop-day0-plebs-iad'] },
  { file: '2026-10-28 - Hanna to London.pdf', kind: 'ticket', guideId: 'flight-hanna-london', label: 'Hanna BWI→LGW', stopIds: ['stop-day0-hanna-bwi'] },
  { file: '2026-11-08 - Boy to DC.pdf', kind: 'ticket', guideId: 'flight-boy-dc', label: 'Boy KEF→IAD', stopIds: ['stop-day11-fi645'] },
  { file: '2026-11-08 - Hanna to DC.pdf', kind: 'ticket', guideId: 'flight-hanna-dc', label: 'Hanna KEF→IAD', stopIds: ['stop-day11-fi645'] },
  { file: '2026-11-08 - Hanna to Iceland.pdf', kind: 'ticket', guideId: 'flight-hanna-iceland', label: 'Hanna FCO→KEF', stopIds: ['stop-day11-fi931'] },
]

const NEW_GUIDES = [
  { id: 'phantom-of-the-opera', name: "Phantom of the Opera", aliases: ['Phantom'] },
  { id: 'bounce-bag-storage', name: 'Bounce Bag Storage', aliases: ['Bounce'] },
  { id: 'eurostar-london-paris', name: 'Eurostar London → Paris', aliases: ['Eurostar'] },
  { id: 'pizza-gelato-class', name: 'Pizza & Gelato Cooking Class', aliases: ['Piazza Mattei', 'pizza class'] },
  { id: 'flight-boys-london', name: 'Boys flight to London', aliases: ['FI 644'] },
  { id: 'flight-hanna-london', name: 'Hanna flight to London', aliases: ['FI 642'] },
  { id: 'flight-boy-dc', name: 'Boy flight to DC', aliases: [] },
  { id: 'flight-hanna-dc', name: 'Hanna flight to DC', aliases: ['FI 645'] },
  { id: 'flight-hanna-iceland', name: 'Hanna flight to Iceland', aliases: ['FI 931'] },
  {
    id: 'sainte-chapelle-visitor-guide',
    name: 'Sainte-Chapelle Visitor Guide',
    aliases: ['Sainte Chapelle guide'],
  },
]

function emptyGuide(partial) {
  return {
    id: partial.id,
    name: partial.name,
    aliases: partial.aliases ?? [],
    logistics: [],
    proTips: [],
    history: [],
    route: [],
    attachments: [],
  }
}

function findTmpFile(name) {
  const direct = path.join(TMP, name)
  if (fs.existsSync(direct)) return direct
  // Case / apostrophe variants
  const entries = fs.readdirSync(TMP)
  const hit = entries.find((e) => e.toLowerCase() === name.toLowerCase())
  return hit ? path.join(TMP, hit) : null
}

function convertPdfToJpegs(srcPath, outDir, prefix) {
  fs.mkdirSync(outDir, { recursive: true })
  // Clear prior pages
  for (const f of fs.readdirSync(outDir)) {
    if (f.startsWith(prefix) && f.endsWith('.jpg')) fs.unlinkSync(path.join(outDir, f))
  }
  const py = `
import sys
from pathlib import Path
import pypdfium2 as pdfium

src = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
prefix = sys.argv[3]
doc = pdfium.PdfDocument(str(src))
paths = []
for i, page in enumerate(doc):
    # ~150 DPI: scale = 150/72
    bitmap = page.render(scale=150/72)
    pil = bitmap.to_pil()
    dest = out_dir / f"{prefix}-{i+1}.jpg"
    pil.save(dest, format="JPEG", quality=85)
    paths.append(str(dest))
    page.close()
print(len(paths))
`
  const r = spawnSync('python', ['-c', py, srcPath, outDir, prefix], {
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.status !== 0) {
    throw new Error(`PDF convert failed for ${srcPath}: ${r.stderr || r.stdout}`)
  }
  const count = Number((r.stdout || '').trim().split('\n').pop())
  const pages = []
  for (let i = 1; i <= count; i++) {
    pages.push(path.join(outDir, `${prefix}-${i}.jpg`))
  }
  return pages
}

function copyJpeg(srcPath, outDir, destName) {
  fs.mkdirSync(outDir, { recursive: true })
  const dest = path.join(outDir, destName)
  fs.copyFileSync(srcPath, dest)
  return [dest]
}

function publicUrl(absPath) {
  const rel = path.relative(path.join(ROOT, 'web/public'), absPath).replace(/\\/g, '/')
  return `/${rel}`
}

function slugifyStopIdGuess(itinerary) {
  /** Build map siteId -> first primary stop id */
  const bySite = new Map()
  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      if (stop.siteId && !bySite.has(stop.siteId)) bySite.set(stop.siteId, stop.id)
    }
  }
  return bySite
}

function resolveStopIds(itinerary, preferred, guideId) {
  const existing = preferred.filter((id) =>
    itinerary.days.some((d) => d.stops.some((s) => s.id === id)),
  )
  if (existing.length) return existing
  // All stops that already use this guide as siteId
  const bySite = []
  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      if (stop.siteId === guideId) bySite.push(stop.id)
    }
  }
  if (bySite.length) return bySite
  const first = slugifyStopIdGuess(itinerary).get(guideId)
  return first ? [first] : []
}

function ensureStopFields(stop) {
  if (!stop.tickets) stop.tickets = []
  if (!stop.mapPages) stop.mapPages = []
  if (!stop.guideIds) stop.guideIds = stop.siteId ? [stop.siteId] : []
}

function main() {
  if (!fs.existsSync(TMP)) {
    console.error('TMP folder missing')
    process.exit(1)
  }

  // Clear old ticket/map trees
  for (const sub of ['tickets', 'maps']) {
    const dir = path.join(PUBLIC, sub)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
  }

  const itinerary = JSON.parse(fs.readFileSync(path.join(PACK, 'itinerary.json'), 'utf8'))
  const sites = JSON.parse(fs.readFileSync(path.join(PACK, 'sites.json'), 'utf8'))
  const assets = JSON.parse(fs.readFileSync(path.join(PACK, 'assets.json'), 'utf8'))

  // Ensure every stop has empty arrays
  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      stop.tickets = []
      stop.mapPages = []
      stop.guideIds = stop.siteId ? [stop.siteId] : []
    }
    // food stays; nullability handled in UI when name empty
  }

  // Ensure guides exist + attachments array
  const siteById = new Map(sites.map((s) => [s.id, s]))
  for (const s of sites) {
    if (!s.attachments) s.attachments = []
  }
  for (const g of NEW_GUIDES) {
    if (!siteById.has(g.id)) {
      const ng = emptyGuide(g)
      sites.push(ng)
      siteById.set(g.id, ng)
    }
  }

  // Clear baths map special-case from assets.sites if present (will re-add via mapPages)
  if (assets.sites?.['baths-of-caracalla']?.map) {
    delete assets.sites['baths-of-caracalla'].map
  }

  const converted = []

  for (const entry of MAPPING) {
    const src = findTmpFile(entry.file)
    if (!src) {
      console.warn('MISSING TMP file:', entry.file)
      continue
    }

    const stopIds = resolveStopIds(itinerary, entry.stopIds, entry.guideId)
    if (!stopIds.length) {
      console.warn('No stop for', entry.file, entry.guideId)
    }

    let pageAbs = []
    const lower = src.toLowerCase()
    if (lower.endsWith('.pdf')) {
      if (entry.kind === 'map') {
        const outDir = path.join(PUBLIC, 'maps', entry.guideId)
        pageAbs = convertPdfToJpegs(src, outDir, 'map-page')
      } else if (entry.kind === 'guide-attachment') {
        const outDir = path.join(PUBLIC, 'guides', entry.guideId)
        pageAbs = convertPdfToJpegs(src, outDir, 'attach-page')
      } else {
        const outDir = path.join(PUBLIC, 'tickets', entry.guideId)
        // For multi-ticket same guide (return flights), use label slug folder
        const ticketKey =
          entry.guideId.startsWith('flight-') || entry.guideId === 'bounce-bag-storage'
            ? entry.guideId
            : entry.guideId
        const ticketDir = path.join(PUBLIC, 'tickets', ticketKey)
        pageAbs = convertPdfToJpegs(src, ticketDir, 'ticket-page')
      }
    } else {
      // JPEG / extensionless JPEG
      if (entry.kind === 'map') {
        const outDir = path.join(PUBLIC, 'maps', entry.guideId)
        pageAbs = copyJpeg(src, outDir, 'map-page-1.jpg')
      } else {
        const outDir = path.join(PUBLIC, 'tickets', entry.guideId)
        pageAbs = copyJpeg(src, outDir, 'ticket-page-1.jpg')
      }
    }

    const urls = pageAbs.map(publicUrl)
    console.log(`${entry.kind} ${entry.guideId}: ${urls.length} page(s) → ${stopIds.join(',') || '(no stop)'}`)

    // Ensure guide exists
    if (!siteById.has(entry.guideId)) {
      const ng = emptyGuide({ id: entry.guideId, name: entry.label, aliases: [] })
      sites.push(ng)
      siteById.set(entry.guideId, ng)
    }

    if (entry.kind === 'guide-attachment') {
      const guide = siteById.get(entry.guideId)
      guide.attachments = [
        { id: `${entry.guideId}-att`, label: entry.label, pages: urls },
      ]
      for (const sid of stopIds) {
        for (const day of itinerary.days) {
          const stop = day.stops.find((s) => s.id === sid)
          if (!stop) continue
          ensureStopFields(stop)
          if (!stop.guideIds.includes(entry.guideId)) stop.guideIds.push(entry.guideId)
          if (!stop.guideIds.includes('sainte-chapelle') && entry.guideId.startsWith('sainte')) {
            /* visitor guide only */
          }
          // Keep primary sainte-chapelle guide too
          if (stop.siteId === 'sainte-chapelle' && !stop.guideIds.includes('sainte-chapelle')) {
            stop.guideIds.unshift('sainte-chapelle')
          }
        }
      }
    } else if (entry.kind === 'map') {
      for (const sid of stopIds) {
        for (const day of itinerary.days) {
          const stop = day.stops.find((s) => s.id === sid)
          if (!stop) continue
          ensureStopFields(stop)
          stop.mapPages = urls
          if (!stop.guideIds.includes(entry.guideId)) stop.guideIds.push(entry.guideId)
          if (!stop.siteId) stop.siteId = entry.guideId
        }
      }
    } else {
      // ticket
      for (const sid of stopIds) {
        for (const day of itinerary.days) {
          const stop = day.stops.find((s) => s.id === sid)
          if (!stop) continue
          ensureStopFields(stop)
          // Replace same-label ticket if re-run
          stop.tickets = stop.tickets.filter((t) => t.id !== entry.guideId)
          stop.tickets.push({ id: entry.guideId, label: entry.label, pages: urls })
          if (!stop.guideIds.includes(entry.guideId)) stop.guideIds.push(entry.guideId)
          if (!stop.siteId) stop.siteId = entry.guideId
        }
      }
    }

    converted.push(entry.guideId)
  }

  // Also attach map/ticket to ALL stops sharing the same siteId (e.g. tower viewpoints)
  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      if (!stop.siteId) continue
      ensureStopFields(stop)
      if (!stop.guideIds.includes(stop.siteId)) stop.guideIds.push(stop.siteId)
      // Copy tickets/maps from a sibling stop that already has them
      if (!stop.tickets.length || !stop.mapPages.length) {
        for (const d2 of itinerary.days) {
          for (const s2 of d2.stops) {
            if (s2.id === stop.id || s2.siteId !== stop.siteId) continue
            if (!stop.tickets.length && s2.tickets?.length) stop.tickets = structuredClone(s2.tickets)
            if (!stop.mapPages.length && s2.mapPages?.length) stop.mapPages = [...s2.mapPages]
          }
        }
      }
    }
  }

  // assets: keep photos only
  const newAssets = {
    sites: assets.sites || {},
    tickets: {},
    maps: {},
  }

  // Write pack + web data copies
  const pretty = (obj) => JSON.stringify(obj, null, 2) + '\n'
  fs.writeFileSync(path.join(PACK, 'itinerary.json'), pretty(itinerary))
  fs.writeFileSync(path.join(PACK, 'sites.json'), pretty(sites))
  fs.writeFileSync(path.join(PACK, 'assets.json'), pretty(newAssets))
  fs.writeFileSync(path.join(WEB_DATA, 'itinerary.json'), pretty(itinerary))
  fs.writeFileSync(path.join(WEB_DATA, 'sites.json'), pretty(sites))
  fs.writeFileSync(path.join(WEB_DATA, 'assets.json'), pretty(newAssets))

  console.log(`Done. Converted ${converted.length} TMP entries.`)
}

main()
