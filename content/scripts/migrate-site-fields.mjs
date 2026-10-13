/**
 * One-shot pack migration:
 * - drop aliases
 * - move timedEntry from site → stop
 * - bags: string|null → string[] (split on ; / newlines / ". " before capital)
 * - notes (rich text) → summary; add notes: []
 *
 * Updates content/trips/eu2026 and mirrors to web/src/data.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packDir = path.join(root, 'content/trips/eu2026')
const webData = path.join(root, 'web/src/data')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

/** Split legacy bags free-text into bullet lines. */
function splitBags(value) {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean)
  }
  const raw = String(value).trim()
  if (!raw) return []

  let parts = raw
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 1) {
    parts = parts[0]
      .split(/\.\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i, arr) =>
        i < arr.length - 1 && !/[.!?]$/.test(s) ? `${s}.` : s,
      )
  }

  return parts
}

function migrateSites(sites) {
  return sites.map((site) => {
    const timed = Boolean(site.timedEntry)

    // Old `notes` was rich-text string|null → becomes summary
    let summary = null
    if (typeof site.summary === 'string' || site.summary === null) {
      summary = site.summary
    } else if (typeof site.notes === 'string') {
      summary = site.notes
    } else if (site.notes == null) {
      summary = null
    }

    // New notes[]: keep only if already an array of strings
    const notes =
      Array.isArray(site.notes) &&
      !(site.notes.length && typeof site.notes[0] !== 'string')
        ? site.notes.map((x) => String(x).trim()).filter(Boolean)
        : Array.isArray(site.summary)
          ? [] // shouldn't happen
          : []

    // If old notes was string/null, notes bullets start empty
    const notesOut =
      typeof site.notes === 'string' || site.notes == null ? [] : notes

    const next = { ...site }
    delete next.aliases
    delete next.timedEntry
    next.summary = summary
    next.notes = notesOut
    next.bags = splitBags(site.bags)

    return { site: next, timedEntry: timed, id: site.id }
  })
}

function migrate() {
  const sitesPath = path.join(packDir, 'sites.json')
  const itinPath = path.join(packDir, 'itinerary.json')
  const sitesRaw = readJson(sitesPath)
  const itinerary = readJson(itinPath)

  const migrated = migrateSites(sitesRaw)
  const timedBySite = new Map(migrated.map((m) => [m.id, m.timedEntry]))
  const sites = migrated.map((m) => m.site)

  let timedStops = 0
  for (const day of itinerary.days || []) {
    for (const stop of day.stops || []) {
      const fromSite = timedBySite.get(stop.siteId) || false
      stop.timedEntry = Boolean(stop.timedEntry) || fromSite
      if (stop.timedEntry) timedStops += 1
    }
  }

  writeJson(sitesPath, sites)
  writeJson(itinPath, itinerary)
  writeJson(path.join(webData, 'sites.json'), sites)
  writeJson(path.join(webData, 'itinerary.json'), itinerary)

  const bagsNonEmpty = sites.filter((s) => (s.bags || []).length).length
  console.log(
    JSON.stringify(
      {
        ok: true,
        sites: sites.length,
        bagsNonEmpty,
        timedStops,
      },
      null,
      2,
    ),
  )
}

migrate()
