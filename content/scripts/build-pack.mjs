/**
 * Hash trip pack files into data/blobs/<aa>/<sha256> and write manifest.json.
 *
 * Usage:
 *   node content/scripts/build-pack.mjs [slug]
 *   (no slug = build all packs under content/trips/)
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const TRIPS = path.join(ROOT, 'content', 'trips')
const BLOBS = path.join(ROOT, 'data', 'blobs')
const WEB_PUBLIC = path.join(ROOT, 'web', 'public')

const SKIP_NAMES = new Set(['manifest.json', '.DS_Store'])

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
  }
  return map[ext] || 'application/octet-stream'
}

function kindFor(relPath) {
  const p = relPath.replace(/\\/g, '/')
  if (p.endsWith('.json')) return 'json'
  if (p.startsWith('images/tickets/')) return 'ticket'
  if (p.startsWith('images/maps/')) return 'map'
  if (p.startsWith('images/')) return 'image'
  return 'file'
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_NAMES.has(name)) continue
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, base, out)
    else out.push(full)
  }
  return out
}

function ensureImagesLinked(slug) {
  const packImages = path.join(TRIPS, slug, 'images')
  const webImages = path.join(WEB_PUBLIC, 'images')
  if (fs.existsSync(packImages)) return
  if (!fs.existsSync(webImages)) return
  // Junction/symlink when possible; else copy for Docker build friendliness use copy on Windows if symlink fails
  try {
    fs.symlinkSync(webImages, packImages, 'junction')
    console.log(`[${slug}] linked images -> web/public/images`)
  } catch {
    fs.cpSync(webImages, packImages, { recursive: true })
    console.log(`[${slug}] copied images into pack`)
  }
}

export function buildOne(slug) {
  const pack = path.join(TRIPS, slug)
  if (!fs.existsSync(pack)) {
    throw new Error(`Pack not found: ${pack}`)
  }
  ensureImagesLinked(slug)

  const files = walk(pack)
  const entries = []
  let totalBytes = 0

  for (const full of files) {
    const rel = path.relative(pack, full).replace(/\\/g, '/')
    if (rel === 'manifest.json') continue
    const sha = sha256File(full)
    const bytes = fs.statSync(full).size
    totalBytes += bytes
    const destDir = path.join(BLOBS, sha.slice(0, 2))
    fs.mkdirSync(destDir, { recursive: true })
    const dest = path.join(destDir, sha)
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(full, dest)
    }
    entries.push({
      path: rel,
      sha256: sha,
      bytes,
      mime: mimeFor(full),
      kind: kindFor(rel),
    })
  }

  entries.sort((a, b) => a.path.localeCompare(b.path))
  const tripMetaPath = path.join(pack, 'trip.json')
  let tripId = slug
  if (fs.existsSync(tripMetaPath)) {
    const meta = JSON.parse(fs.readFileSync(tripMetaPath, 'utf8'))
    tripId = meta.id || tripId
  }

  const versionHash = crypto
    .createHash('sha256')
    .update(entries.map((e) => e.sha256).join(''))
    .digest('hex')
    .slice(0, 12)

  const manifest = {
    tripId,
    slug,
    version: versionHash,
    generatedAt: new Date().toISOString(),
    fileCount: entries.length,
    totalBytes,
    files: entries,
  }

  fs.writeFileSync(
    path.join(pack, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
  console.log(
    `[${slug}] ${entries.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB, version ${versionHash}`,
  )
  return manifest
}

function main() {
  fs.mkdirSync(BLOBS, { recursive: true })
  const arg = process.argv[2]
  const slugs = arg
    ? [arg]
    : fs
        .readdirSync(TRIPS, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
  for (const slug of slugs) {
    buildOne(slug)
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
