import type { Assets, Itinerary, Site } from '@/data/types'

export type SyncStatus =
  | 'idle'
  | 'offline'
  | 'checking'
  | 'downloading'
  | 'synced'
  | 'error'

export interface ManifestFile {
  path: string
  sha256: string
  bytes: number
  mime?: string
  kind?: string
}

export interface ContentManifest {
  tripId: string
  slug: string
  version: string
  files: ManifestFile[]
  totalBytes?: number
}

import type { TripLocation } from '@/lib/tripMeta'

export interface TripSummary {
  id: string
  slug: string
  title: string
  start_date?: string | null
  end_date?: string | null
  status?: string
  content_version?: string
  source?: string
  locations?: TripLocation[]
}

export interface TripDocument {
  itinerary: Itinerary
  sites: Site[]
  assets: Assets
}

const DB_NAME = 'prok-vacation'
const DB_VERSION = 2
const CACHE_NAME = 'prok-vacation-blobs-v1'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'sha256' })
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('plan_items')) {
        db.createObjectStore('plan_items', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('trip_links')) {
        db.createObjectStore('trip_links', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('video_offline')) {
        db.createObjectStore('video_offline', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'op_id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(store: string, value: unknown, key?: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    const req = key ? os.put(value, key) : os.put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { credentials: 'same-origin' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listTrips(): Promise<TripSummary[]> {
  const remote = await apiGet<TripSummary[]>('/api/trips')
  if (remote?.length) {
    await idbSet('meta', remote, 'trips')
    return remote
  }
  return (await idbGet<TripSummary[]>('meta', 'trips')) ?? []
}

export async function fetchManifest(tripId: string): Promise<ContentManifest | null> {
  return apiGet<ContentManifest>(`/api/content/${encodeURIComponent(tripId)}/manifest`)
}

/** Cache Storage only — IDB blob meta is accounting, not proof of bytes. */
async function cacheHas(sha: string): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(`/api/content/blobs/${sha}`)
  if (hit) return true
  const meta = await idbGet<{ sha256: string }>('blobs', sha)
  if (meta) await idbDelete('blobs', sha)
  return false
}

async function downloadBlob(sha: string): Promise<void> {
  const url = `/api/content/blobs/${sha}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`blob ${sha} failed: ${res.status}`)
  const cache = await caches.open(CACHE_NAME)
  await cache.put(url, res.clone())
  const buf = await res.arrayBuffer()
  await idbSet('blobs', { sha256: sha, bytes: buf.byteLength })
}

export type ProgressFn = (info: {
  status: SyncStatus
  done: number
  total: number
  bytes: number
}) => void

async function listMissingBlobs(files: ManifestFile[]): Promise<ManifestFile[]> {
  const missing: ManifestFile[] = []
  for (const f of files) {
    if (!(await cacheHas(f.sha256))) missing.push(f)
  }
  return missing
}

export async function syncTripContent(
  tripId: string,
  onProgress?: ProgressFn,
): Promise<ContentManifest | null> {
  if (!navigator.onLine) {
    onProgress?.({ status: 'offline', done: 0, total: 0, bytes: 0 })
    return (await idbGet<ContentManifest>('meta', `manifest:${tripId}`)) ?? null
  }
  onProgress?.({ status: 'checking', done: 0, total: 0, bytes: 0 })
  const manifest = await fetchManifest(tripId)
  if (!manifest) {
    onProgress?.({ status: 'error', done: 0, total: 0, bytes: 0 })
    return (await idbGet<ContentManifest>('meta', `manifest:${tripId}`)) ?? null
  }

  // Persist path→sha before downloads so partial syncs can resolve offline.
  await idbSet('meta', manifest, `manifest:${tripId}`)
  await idbSet('meta', manifest.version, `version:${tripId}`)

  const packTotal = manifest.files?.length ?? 0
  if (!packTotal) {
    onProgress?.({ status: 'error', done: 0, total: 0, bytes: 0 })
    return manifest
  }
  const missing = await listMissingBlobs(manifest.files)
  let cached = packTotal - missing.length
  let bytes = 0
  onProgress?.({
    status: missing.length ? 'downloading' : 'checking',
    done: cached,
    total: packTotal,
    bytes,
  })

  // Download every missing file; continue past individual failures.
  for (const f of missing) {
    try {
      await downloadBlob(f.sha256)
      cached += 1
      bytes += f.bytes
    } catch {
      /* counted in stillMissing below */
    }
    onProgress?.({
      status: 'downloading',
      done: cached,
      total: packTotal,
      bytes,
    })
  }

  const stillMissing = await listMissingBlobs(manifest.files)
  if (stillMissing.length || cached < packTotal) {
    onProgress?.({
      status: 'error',
      done: packTotal - stillMissing.length,
      total: packTotal,
      bytes,
    })
    return manifest
  }

  // Materialize JSON document from blobs or trip API
  const trip = await apiGet<{ trip_document?: TripDocument; slug?: string }>(
    `/api/trips/${encodeURIComponent(tripId)}`,
  )
  if (trip?.trip_document) {
    await idbSet('meta', trip.trip_document, `doc:${tripId}`)
  } else {
    const doc = await materializeDocFromManifest(manifest)
    if (doc) await idbSet('meta', doc, `doc:${tripId}`)
  }

  onProgress?.({
    status: 'synced',
    done: packTotal,
    total: packTotal,
    bytes,
  })
  return manifest
}

async function readBlobJson<T>(sha: string): Promise<T | null> {
  const cache = await caches.open(CACHE_NAME)
  const res = await cache.match(`/api/content/blobs/${sha}`)
  if (!res) return null
  return (await res.json()) as T
}

async function materializeDocFromManifest(
  manifest: ContentManifest,
): Promise<TripDocument | null> {
  const byPath = new Map(manifest.files.map((f) => [f.path, f]))
  const itin = byPath.get('itinerary.json')
  const sites = byPath.get('sites.json')
  const assets = byPath.get('assets.json')
  if (!itin || !sites || !assets) return null
  const itinerary = await readBlobJson<Itinerary>(itin.sha256)
  const sitesJson = await readBlobJson<Site[]>(sites.sha256)
  const assetsJson = await readBlobJson<Assets>(assets.sha256)
  if (!itinerary || !sitesJson || !assetsJson) return null
  return { itinerary, sites: sitesJson, assets: assetsJson }
}

export async function getLocalTripDoc(tripId: string): Promise<TripDocument | null> {
  return (await idbGet<TripDocument>('meta', `doc:${tripId}`)) ?? null
}

/**
 * Resolve a pack path to a usable URL.
 * Offline: only Cache Storage blob URLs (never /images/ — Sync does not cache those).
 * Online: blob cache → /api/content/blobs/{sha} → static /images/ fallback.
 */
export async function resolveAssetUrl(
  tripId: string,
  assetPath: string,
): Promise<string | null> {
  const normalized = assetPath.startsWith('/')
    ? assetPath.slice(1)
    : assetPath
  // assets.json uses /images/... → pack path images/...
  const packPath = normalized.startsWith('images/')
    ? normalized
    : normalized

  const manifest = await idbGet<ContentManifest>('meta', `manifest:${tripId}`)
  const entry = manifest?.files.find((f) => f.path === packPath)
  if (entry) {
    const cache = await caches.open(CACHE_NAME)
    const url = `/api/content/blobs/${entry.sha256}`
    const hit = await cache.match(url)
    if (hit) {
      const blob = await hit.blob()
      return URL.createObjectURL(blob)
    }
    if (navigator.onLine) return url
    return null
  }
  if (!navigator.onLine) return null
  return assetPath.startsWith('/') ? assetPath : `/${assetPath}`
}

/** Resolve paths; drops nulls (missing offline / unresolved). */
export async function resolveAssetUrls(
  tripId: string,
  paths: string[],
): Promise<string[]> {
  const resolved = await Promise.all(paths.map((p) => resolveAssetUrl(tripId, p)))
  return resolved.filter((u): u is string => Boolean(u))
}

// --- Notes / plan / outbox ---

export interface NoteRow {
  id: string
  trip_id: string
  day_id?: string | null
  stop_id?: string | null
  location_id?: string | null
  body: string
  record_status: string
  last_modified_on: string
  created_on?: string
  created_by?: string | null
  last_modified_by?: string | null
  created_on_device?: string
  last_modified_on_device?: string
  dirty?: boolean
}

export interface PlanItemRow {
  id: string
  trip_id: string
  site_id?: string | null
  day_id?: string | null
  kind: string
  title: string
  body: string
  done: boolean
  sort_order: number
  record_status: string
  last_modified_on: string
  dirty?: boolean
}

export interface TripLinkRow {
  id: string
  trip_id: string
  kind: string
  label?: string | null
  payload: Record<string, unknown>
  day_id?: string | null
  record_status: string
  last_modified_on: string
  dirty?: boolean
}

export interface VideoRow {
  id: string
  trip_id: string
  location_id?: string | null
  youtube_id: string
  url: string
  title: string
  thumbnail_url?: string | null
  body?: string
  record_status: string
  last_modified_on: string
  created_on?: string
  created_by?: string | null
  last_modified_by?: string | null
  created_on_device?: string
  last_modified_on_device?: string
  dirty?: boolean
}

export interface VideoOfflineRow {
  id: string
  trip_id: string
  video_id: string
  user_name: string
  downloaded_at?: string | null
  record_status: string
  last_modified_on: string
  created_on?: string
  created_by?: string | null
  last_modified_by?: string | null
  created_on_device?: string
  last_modified_on_device?: string
  dirty?: boolean
}

export async function saveNote(note: NoteRow): Promise<void> {
  const row = { ...note, dirty: true, last_modified_on: new Date().toISOString() }
  await idbSet('notes', row)
  await enqueueOutbox('note', row)
}

/** Soft-delete a note (hidden locally and synced via record_status). */
export async function deleteNote(
  note: NoteRow,
  modifiedBy: string,
): Promise<void> {
  await saveNote({
    ...note,
    record_status: 'deleted',
    last_modified_by: modifiedBy,
    last_modified_on_device: 'web',
  })
}

export async function listNotes(tripId: string): Promise<NoteRow[]> {
  const all = await idbGetAll<NoteRow>('notes')
  return all.filter((n) => n.trip_id === tripId && n.record_status !== 'deleted')
}

export async function savePlanItem(item: PlanItemRow): Promise<void> {
  const row = { ...item, dirty: true, last_modified_on: new Date().toISOString() }
  await idbSet('plan_items', row)
  await enqueueOutbox('plan_item', row)
}

export async function listPlanItems(tripId: string): Promise<PlanItemRow[]> {
  const all = await idbGetAll<PlanItemRow>('plan_items')
  return all
    .filter((n) => n.trip_id === tripId && n.record_status !== 'deleted')
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function saveTripLink(link: TripLinkRow): Promise<void> {
  const row = { ...link, dirty: true, last_modified_on: new Date().toISOString() }
  await idbSet('trip_links', row)
  await enqueueOutbox('trip_link', row)
}

export async function listTripLinks(tripId: string): Promise<TripLinkRow[]> {
  const all = await idbGetAll<TripLinkRow>('trip_links')
  return all.filter((n) => n.trip_id === tripId && n.record_status !== 'deleted')
}

export async function saveVideo(video: VideoRow): Promise<void> {
  const row = {
    ...video,
    dirty: true,
    last_modified_on: new Date().toISOString(),
  }
  await idbSet('videos', row)
  await enqueueOutbox('video', row)
}

export async function deleteVideo(
  video: VideoRow,
  modifiedBy: string,
): Promise<void> {
  await saveVideo({
    ...video,
    record_status: 'deleted',
    last_modified_by: modifiedBy,
    last_modified_on_device: 'web',
  })
}

export async function listVideos(tripId: string): Promise<VideoRow[]> {
  const all = await idbGetAll<VideoRow>('videos')
  return all.filter((v) => v.trip_id === tripId && v.record_status !== 'deleted')
}

export async function saveVideoOffline(row: VideoOfflineRow): Promise<void> {
  const next = {
    ...row,
    dirty: true,
    last_modified_on: new Date().toISOString(),
  }
  await idbSet('video_offline', next)
  await enqueueOutbox('video_offline', next)
}

export async function listVideoOffline(
  tripId: string,
): Promise<VideoOfflineRow[]> {
  const all = await idbGetAll<VideoOfflineRow>('video_offline')
  return all.filter(
    (r) => r.trip_id === tripId && r.record_status !== 'deleted',
  )
}

/** Find or create the current user's offline checklist row for a video. */
export async function upsertVideoOfflineMark(input: {
  tripId: string
  videoId: string
  userName: string
  downloaded: boolean
}): Promise<VideoOfflineRow> {
  const existing = (await listVideoOffline(input.tripId)).find(
    (r) => r.video_id === input.videoId && r.user_name === input.userName,
  )
  const now = new Date().toISOString()
  const row: VideoOfflineRow = existing
    ? {
        ...existing,
        downloaded_at: input.downloaded ? now : null,
        last_modified_by: input.userName,
        last_modified_on_device: 'web',
        record_status: 'active',
      }
    : {
        id: crypto.randomUUID(),
        trip_id: input.tripId,
        video_id: input.videoId,
        user_name: input.userName,
        downloaded_at: input.downloaded ? now : null,
        record_status: 'active',
        last_modified_on: now,
        created_on: now,
        created_by: input.userName,
        last_modified_by: input.userName,
        created_on_device: 'web',
        last_modified_on_device: 'web',
      }
  await saveVideoOffline(row)
  return row
}

async function enqueueOutbox(entity: string, payload: unknown): Promise<void> {
  await idbSet('outbox', {
    op_id: crypto.randomUUID(),
    entity,
    payload,
    created_on: new Date().toISOString(),
  })
}

export async function syncUserData(tripId?: string): Promise<void> {
  if (!navigator.onLine) return
  const outbox = await idbGetAll<{
    op_id: string
    entity: string
    payload:
      | NoteRow
      | PlanItemRow
      | TripLinkRow
      | VideoRow
      | VideoOfflineRow
  }>('outbox')

  const notes: NoteRow[] = []
  const plan_items: PlanItemRow[] = []
  const trip_links: TripLinkRow[] = []
  const videos: VideoRow[] = []
  const video_offline: VideoOfflineRow[] = []
  for (const op of outbox) {
    if (op.entity === 'note') notes.push(op.payload as NoteRow)
    if (op.entity === 'plan_item') plan_items.push(op.payload as PlanItemRow)
    if (op.entity === 'trip_link') trip_links.push(op.payload as TripLinkRow)
    if (op.entity === 'video') videos.push(op.payload as VideoRow)
    if (op.entity === 'video_offline')
      video_offline.push(op.payload as VideoOfflineRow)
  }

  if (
    notes.length ||
    plan_items.length ||
    trip_links.length ||
    videos.length ||
    video_offline.length
  ) {
    await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes,
        plan_items,
        trip_links,
        videos,
        video_offline,
      }),
    })
    // clear outbox
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite')
      tx.objectStore('outbox').clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  const since = (await idbGet<string>('meta', 'sync_since')) ?? '1970-01-01T00:00:00.000Z'
  const qs = new URLSearchParams({ since })
  if (tripId) qs.set('trip_id', tripId)
  const pull = await apiGet<{
    notes: NoteRow[]
    plan_items: PlanItemRow[]
    trip_links: TripLinkRow[]
    videos: VideoRow[]
    video_offline: VideoOfflineRow[]
    server_time: string
  }>(`/api/sync/pull?${qs}`)
  if (!pull) return
  for (const n of pull.notes ?? []) await idbSet('notes', { ...n, dirty: false })
  for (const p of pull.plan_items ?? []) await idbSet('plan_items', { ...p, dirty: false })
  for (const l of pull.trip_links ?? []) await idbSet('trip_links', { ...l, dirty: false })
  for (const v of pull.videos ?? []) await idbSet('videos', { ...v, dirty: false })
  for (const o of pull.video_offline ?? [])
    await idbSet('video_offline', { ...o, dirty: false })
  if (pull.server_time) await idbSet('meta', pull.server_time, 'sync_since')
}

export async function getActiveTripId(): Promise<string | null> {
  return (await idbGet<string>('meta', 'activeTripId')) ?? null
}

export async function setActiveTripId(id: string): Promise<void> {
  await idbSet('meta', id, 'activeTripId')
}
