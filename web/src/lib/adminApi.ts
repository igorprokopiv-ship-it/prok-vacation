import type { Assets, Itinerary, Site } from '@/data/types'

export type AdminMe = { admin: boolean }

export async function adminMe(): Promise<AdminMe> {
  try {
    const res = await fetch('/api/admin/me', { credentials: 'include' })
    if (!res.ok) return { admin: false }
    return (await res.json()) as AdminMe
  } catch {
    return { admin: false }
  }
}

export async function adminLogin(password: string): Promise<boolean> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return res.ok
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Admin request failed (${res.status})`)
  }
  return res
}

export async function adminCreateStop(
  tripSlug: string,
  dayId: string,
  body: {
    time: string
    siteId?: string | null
    name?: string
    kind?: string
    duration?: string
    optionGroup?: string | null
    optionLabel?: string | null
    primary?: boolean
    timedEntry?: boolean
  },
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/days/${dayId}/stops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function adminUpdateStop(
  tripSlug: string,
  dayId: string,
  stopId: string,
  patch: Record<string, unknown>,
) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  )
  return res.json()
}

export async function adminDeleteStop(tripSlug: string, dayId: string, stopId: string) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}`,
    { method: 'DELETE' },
  )
  return res.json()
}

export async function adminUploadTicket(
  tripSlug: string,
  dayId: string,
  stopId: string,
  label: string,
  file: File,
) {
  const fd = new FormData()
  fd.append('label', label)
  fd.append('file', file)
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}/tickets`,
    { method: 'POST', body: fd },
  )
  return res.json()
}

export async function adminDeleteTicket(
  tripSlug: string,
  dayId: string,
  stopId: string,
  ticketId: string,
) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}/tickets/${ticketId}`,
    { method: 'DELETE' },
  )
  return res.json()
}

export async function adminUploadMap(
  tripSlug: string,
  dayId: string,
  stopId: string,
  file: File,
) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}/map`,
    { method: 'POST', body: fd },
  )
  return res.json()
}

export async function adminClearMap(tripSlug: string, dayId: string, stopId: string) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}/map`,
    { method: 'DELETE' },
  )
  return res.json()
}

export async function adminSetMapsUrl(
  tripSlug: string,
  guide: {
    id: string
    name: string
    mapsUrl: string | null
  } & Record<string, unknown>,
) {
  return adminUpsertGuide(tripSlug, { ...guide, mapsUrl: guide.mapsUrl })
}

export async function adminUpsertGuide(
  tripSlug: string,
  guide: {
    id?: string
    name: string
    kind?: string
    duration?: string
    hours?: string | null
    cost?: string | null
    summary?: string | null
    mapsUrl?: string | null
    bookingRef?: string | null
    bags?: string[]
    transit?: string | null
    vibe?: string[]
    mustTry?: string[]
    tickets?: unknown[]
    mapPages?: string[]
    notes?: string[]
    logistics?: string[]
    proTips?: string[]
    history?: string[]
    route?: string[]
  },
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/guides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(guide),
  })
  return res.json()
}

export async function adminLinkGuide(
  tripSlug: string,
  dayId: string,
  stopId: string,
  guideId: string,
) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}/guides`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guideId }),
    },
  )
  return res.json()
}

export async function adminUnlinkGuide(
  tripSlug: string,
  dayId: string,
  stopId: string,
  guideId: string,
) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/stops/${stopId}/guides/${guideId}`,
    { method: 'DELETE' },
  )
  return res.json()
}

export async function adminUploadGuideAttachment(
  tripSlug: string,
  guideId: string,
  label: string,
  file: File,
) {
  const fd = new FormData()
  fd.append('label', label)
  fd.append('file', file)
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/guides/${guideId}/attachments`,
    { method: 'POST', body: fd },
  )
  return res.json()
}

export async function adminDeleteGuideAttachment(
  tripSlug: string,
  guideId: string,
  attachmentId: string,
) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/guides/${guideId}/attachments/${attachmentId}`,
    { method: 'DELETE' },
  )
  return res.json()
}

export async function adminSetDayHighlights(
  tripSlug: string,
  dayId: string,
  stopIds: string[],
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/days/${dayId}/highlights`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stopIds }),
  })
  return res.json()
}

export async function adminSetDayFood(
  tripSlug: string,
  dayId: string,
  food: {
    name: string
    vibe?: string
    mustTry?: string
    hours?: string | null
    cost?: string | null
  } | null,
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/days/${dayId}/food`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ food }),
  })
  return res.json()
}

export async function adminCreateTrip(body: {
  title: string
  start_date: string
  slug?: string
}) {
  const res = await adminFetch('/api/admin/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function adminPatchTrip(
  tripSlug: string,
  patch: { title?: string; start_date?: string; end_date?: string; status?: string },
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.json()
}

export async function adminSoftDeleteTrip(tripSlug: string) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}`, { method: 'DELETE' })
  return res.json()
}

export type VacationBackup = {
  format: 'prok-vacation-backup'
  formatVersion: number
  exportedAt: string
  trip: {
    id?: string
    slug: string
    title?: string
    start_date?: string | null
    end_date?: string | null
    status?: string
    record_status?: string
  }
  itinerary: Itinerary
  sites: Site[]
  assets: Assets
}

export async function adminFetchTripBackup(
  tripSlug: string,
): Promise<VacationBackup> {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/export`)
  return (await res.json()) as VacationBackup
}

/** Download JSON-only vacation backup as `{slug}-backup.json`. */
export async function adminDownloadTripBackup(tripSlug: string): Promise<void> {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/export`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tripSlug}-backup.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function adminCreateDay(
  tripSlug: string,
  body?: {
    city?: string
    headline?: string
    briefing?: string
    type?: string
    date?: string
  },
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/days`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return res.json()
}

export async function adminPatchDay(
  tripSlug: string,
  dayId: string,
  patch: Record<string, unknown>,
) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/days/${dayId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.json()
}

export async function adminDeleteDay(tripSlug: string, dayId: string) {
  const res = await adminFetch(`/api/admin/trips/${tripSlug}/days/${dayId}`, {
    method: 'DELETE',
  })
  return res.json()
}

export async function adminUploadHero(
  tripSlug: string,
  dayId: string,
  file: File,
) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/hero`,
    { method: 'POST', body: fd },
  )
  return res.json()
}

export async function adminClearHero(tripSlug: string, dayId: string) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/days/${dayId}/hero`,
    { method: 'DELETE' },
  )
  return res.json()
}

export async function adminUploadSitePhoto(
  tripSlug: string,
  guideId: string,
  file: File,
) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/guides/${guideId}/photo`,
    { method: 'POST', body: fd },
  )
  return res.json()
}

/** Reuse an existing /images/... path as this site's photo (no re-upload). */
export async function adminSetSitePhoto(
  tripSlug: string,
  guideId: string,
  path: string,
) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/guides/${guideId}/photo`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    },
  )
  return res.json()
}

export async function adminClearSitePhoto(tripSlug: string, guideId: string) {
  const res = await adminFetch(
    `/api/admin/trips/${tripSlug}/guides/${guideId}/photo`,
    { method: 'DELETE' },
  )
  return res.json()
}
