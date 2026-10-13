import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Lock,
  LockOpen,
  Pencil,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import { AdminLoginDialog } from '@/components/AdminLoginDialog'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
import { DayDrawer } from '@/components/DayDrawer'
import { DeviceIdentityGate } from '@/components/DeviceIdentityGate'
import { HighlightsPanel } from '@/components/HighlightsPanel'
import { NotesPanel } from '@/components/NotesPanel'
import {
  SchedulePanel,
  type AdminAction,
  type ViewerTarget,
} from '@/components/SchedulePanel'
import { EventExpand, type CreateEventPayload } from '@/components/EventExpand'
import { SyncChip } from '@/components/SyncChip'
import { TripPicker } from '@/components/TripPicker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ItineraryStop, Site } from '@/data/types'
import {
  dayOptionGroupId,
  isPrimaryLabelForGroup,
  resolvedOptionOrder,
  planConvergeAt,
  stopsWithOptionLabel,
} from '@/lib/options'
import {
  adminClearHero,
  adminClearMap,
  adminClearSitePhoto,
  adminCreateDay,
  adminCreateStop,
  adminDeleteDay,
  adminDeleteStop,
  adminDeleteTicket,
  adminLinkGuide,
  adminLogout,
  adminMe,
  adminPatchDay,
  adminSetDayHighlights,
  adminSetSitePhoto,
  adminUnlinkGuide,
  adminUpdateStop,
  adminUploadHero,
  adminUploadMap,
  adminUploadSitePhoto,
  adminUploadTicket,
  adminUpsertGuide,
} from '@/lib/adminApi'
import {
  applyTripDocument,
  getItinerary,
  getMapPages,
  getSitePhoto,
  getSites,
  getSiteForStop,
  getTicketSets,
  stopTitle,
  resetToBundled,
} from '@/lib/data'
import {
  getActiveTripId,
  getLocalTripDoc,
  listTrips,
  resolveAssetUrls,
  setActiveTripId,
  syncTripContent,
  syncUserData,
  type SyncStatus,
  type TripSummary,
} from '@/lib/contentSync'
import { getDeviceUser } from '@/lib/deviceIdentity'

const EU2026_ID = 'a1111111-1111-4111-8111-111111111111'

type Overlay =
  | { type: 'expand'; stop: ItineraryStop; edit?: boolean }
  | { type: 'create' }
  | null

type PromptState = { kind: 'briefing' } | { kind: 'day-meta' } | null

const inputClass =
  'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea'

export default function App() {
  const dialog = useAppDialog()
  const [deviceUser, setDeviceUserState] = useState<string | null>(() => getDeviceUser())
  const [adminMode, setAdminMode] = useState(false)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [tripId, setTripId] = useState<string | null>(null)
  const [tripMeta, setTripMeta] = useState<TripSummary | null>(null)
  const [ready, setReady] = useState(false)
  const [dayId, setDayId] = useState('')
  const [tab, setTab] = useState('highlights')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncDetail, setSyncDetail] = useState<string | undefined>()
  const [appVersion, setAppVersion] = useState(
    () => import.meta.env.VITE_APP_VERSION?.trim() || '0.1.0',
  )
  const [tick, setTick] = useState(0)
  const [prompt, setPrompt] = useState<PromptState>(null)
  const [promptValue, setPromptValue] = useState('')
  const [promptExtra, setPromptExtra] = useState('')
  const [promptBusy, setPromptBusy] = useState(false)
  const [heroPicker, setHeroPicker] = useState<{
    title: string
    options: AttachmentPickOption[]
    onSelect: (id: string) => void
  } | null>(null)

  const tripSlug = tripMeta?.slug ?? 'eu2026'
  const itinerary = getItinerary()
  const days = itinerary.days
  const day = useMemo(() => {
    void tick
    const list = getItinerary().days
    return list.find((d) => d.id === dayId) ?? list[0]
  }, [dayId, tick])

  const dayIndex = useMemo(
    () => days.findIndex((d) => d.id === day?.id),
    [days, day?.id],
  )
  const canPrev = dayIndex > 0
  const canNext = dayIndex >= 0 && dayIndex < days.length - 1

  const applyAdminDoc = (doc: {
    itinerary: ReturnType<typeof getItinerary>
    sites: ReturnType<typeof getSites>
    assets: unknown
    trip?: { title?: string; start_date?: string; end_date?: string; slug?: string }
  }) => {
    applyTripDocument(doc as Parameters<typeof applyTripDocument>[0])
    if (doc.trip && tripMeta) {
      setTripMeta({
        ...tripMeta,
        title: doc.trip.title ?? tripMeta.title,
        start_date: doc.trip.start_date ?? tripMeta.start_date,
        end_date: doc.trip.end_date ?? tripMeta.end_date,
      })
    }
    setTick((n) => n + 1)
  }

  const refreshTrips = async () => {
    const remote = await listTrips()
    setTrips(remote)
    if (tripMeta && !remote.some((t) => t.id === tripMeta.id)) {
      setTripId(null)
      setTripMeta(null)
    } else if (tripMeta) {
      const updated = remote.find((t) => t.id === tripMeta.id)
      if (updated) setTripMeta(updated)
    }
  }

  const uploadHeroFile = async (file: File) => {
    if (!day) return
    const doc = await adminUploadHero(tripSlug, day.id, file)
    applyAdminDoc(doc)
  }

  /** Unique site photos on this day (path → site name), for reuse as day hero. */
  const daySitePhotoOptions = useMemo(() => {
    if (!day) return [] as AttachmentPickOption[]
    void tick
    const seen = new Set<string>()
    const opts: AttachmentPickOption[] = []
    for (const stop of day.stops) {
      const site = getSiteForStop(stop)
      const photo = site?.id ? getSitePhoto(site.id) : undefined
      if (!photo || seen.has(photo)) continue
      seen.add(photo)
      opts.push({
        id: photo,
        label: site?.name || stopTitle(stop),
      })
    }
    return opts
  }, [day, tick])

  const openHeroPhotoActions = () => {
    if (!day) return
    const options: AttachmentPickOption[] = [
      { id: '__upload__', label: 'Upload new picture' },
      ...daySitePhotoOptions
        .filter((o) => o.id !== day.heroImage)
        .map((o) => ({ id: o.id, label: `Reuse: ${o.label}` })),
    ]
    if (options.length === 1) {
      void pickFile('image/*').then((file) => {
        if (!file) return
        void uploadHeroFile(file).catch((err) =>
          void dialog.alert(
            err instanceof Error ? err.message : 'Upload failed',
          ),
        )
      })
      return
    }
    setHeroPicker({
      title: 'Day picture',
      options,
      onSelect: (id) => {
        if (id === '__upload__') {
          void pickFile('image/*').then((file) => {
            if (!file) return
            void uploadHeroFile(file).catch((err) =>
              void dialog.alert(
                err instanceof Error ? err.message : 'Upload failed',
              ),
            )
          })
          return
        }
        void (async () => {
          try {
            const doc = await adminPatchDay(tripSlug, day.id, {
              heroImage: id,
            })
            applyAdminDoc(doc)
          } catch (e) {
            await dialog.alert(e instanceof Error ? e.message : 'Failed')
          }
        })()
      },
    })
  }

  async function runSync(id: string) {
    try {
      await syncTripContent(id, (info) => {
        setSyncStatus(info.status)
        if (info.status === 'downloading' && info.total) {
          const mb = (info.bytes / (1024 * 1024)).toFixed(1)
          setSyncDetail(`${info.done}/${info.total} · ${mb} MB`)
        } else {
          setSyncDetail(undefined)
        }
      })
      const doc = await getLocalTripDoc(id)
      if (doc) {
        applyTripDocument(doc)
        setTick((n) => n + 1)
      }
      await syncUserData(id)
      setSyncStatus(navigator.onLine ? 'synced' : 'offline')
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
    }
  }

  async function openTrip(trip: TripSummary, sync = true) {
    setTripId(trip.id)
    setTripMeta(trip)
    await setActiveTripId(trip.id)

    const local = await getLocalTripDoc(trip.id)
    if (local) {
      applyTripDocument(local)
      setDayId(local.itinerary.days[0]?.id ?? '')
      setTick((n) => n + 1)
    } else if (trip.slug === 'eu2026' || trip.id === EU2026_ID) {
      resetToBundled()
      setDayId(getItinerary().days[0]?.id ?? '')
      setTick((n) => n + 1)
    }

    if (sync) {
      await runSync(trip.id)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/config')
        if (res.ok) {
          const cfg = (await res.json()) as { version?: string }
          if (cfg.version) setAppVersion(cfg.version)
        }
      } catch {
        /* bundled VITE_APP_VERSION is enough offline */
      }
      const me = await adminMe()
      setAdminMode(me.admin)
      resetToBundled()
      let remote = await listTrips()
      if (!remote.length) {
        remote = [
          {
            id: EU2026_ID,
            slug: 'eu2026',
            title: 'EU2026 European Grand Tour',
            start_date: '2026-10-28',
            end_date: '2026-11-08',
            status: 'active',
            source: 'bundled',
          },
        ]
      }
      setTrips(remote)
      const saved = await getActiveTripId()
      const initial =
        remote.find((t) => t.id === saved || t.slug === saved) ?? remote[0]
      if (initial) {
        await openTrip(initial, false)
      }
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (!dayId && itinerary.days[0]) setDayId(itinerary.days[0].id)
  }, [itinerary, dayId, tick])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setOverlay(null)
  }, [dayId])

  const openPagesWindow = (title: string, pages: string[]) => {
    if (!pages.length) {
      void dialog.alert(title ? `${title}: no pages yet` : 'No pages yet')
      return
    }
    const win = window.open('', '_blank')
    if (!win) {
      void dialog.alert('Pop-up blocked — allow pop-ups to open attachments.')
      return
    }
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const imgs = pages
      .map(
        (src) =>
          `<img src="${esc(src)}" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto 1.25rem;box-shadow:0 2px 12px rgba(0,0,0,.2)" />`,
      )
      .join('')
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body { margin: 0; padding: 1rem; background: #1c2a3a; color: #f4f1ea; font-family: system-ui, sans-serif; }
    h1 { font-size: 1.1rem; margin: 0 0 1rem; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${imgs}
</body>
</html>`)
    win.document.close()
  }

  const openViewer = async (target: ViewerTarget) => {
    if (target.kind === 'expand') {
      setOverlay({
        type: 'expand',
        stop: target.stop,
        edit: Boolean(target.edit),
      })
      return
    }
    let raw: string[] = []
    if (target.kind === 'ticket') {
      const sets = getTicketSets(target.stop)
      const set = target.ticketId
        ? sets.find((t) => t.id === target.ticketId)
        : sets[0]
      raw = set?.pages ?? []
    } else {
      const all = getMapPages(target.stop)
      raw =
        typeof target.pageIndex === 'number' && all[target.pageIndex]
          ? [all[target.pageIndex]]
          : all
    }
    const pages = tripId ? await resolveAssetUrls(tripId, raw) : raw
    openPagesWindow(target.title, pages)
  }

  const pickFile = (accept: string): Promise<File | null> =>
    new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.click()
    })

  const onAdminAction = async (
    action: AdminAction,
    stop: ItineraryStop,
  ) => {
    if (!day) return
    if (action === 'delete-event') {
      const ok = await dialog.confirm({
        title: 'Delete event',
        message: `Delete “${stopTitle(stop)}”?`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      if (!ok) return
      try {
        const doc = await adminDeleteStop(tripSlug, day.id, stop.id)
        applyAdminDoc(doc)
        setOverlay(null)
      } catch (e) {
        await dialog.alert(e instanceof Error ? e.message : 'Failed')
      }
      return
    }
    if (action === 'toggle-highlight') {
      const ids = day.highlights.map((h) => h.stopId)
      const next = ids.includes(stop.id)
        ? ids.filter((id) => id !== stop.id)
        : [...ids, stop.id]
      try {
        const doc = await adminSetDayHighlights(tripSlug, day.id, next)
        applyAdminDoc(doc)
      } catch (e) {
        await dialog.alert(e instanceof Error ? e.message : 'Failed')
      }
      return
    }
    if (action === 'toggle-timed') {
      try {
        const doc = await adminUpdateStop(tripSlug, day.id, stop.id, {
          timedEntry: !stop.timedEntry,
        })
        applyAdminDoc(doc)
      } catch (e) {
        await dialog.alert(e instanceof Error ? e.message : 'Failed')
      }
      return
    }
    if (action === 'mark-converge') {
      const plan = planConvergeAt(day.stops, stop, stopTitle)
      if (!plan) {
        await dialog.alert(
          'No option branch to converge. Assign events to options first, then mark converge on the first shared event after the fork.',
        )
        return
      }
      if (plan.unresolved.length) {
        const names = plan.unresolved.map((s) => stopTitle(s)).join(', ')
        await dialog.alert(
          `Can't move converge here yet — assign these events to Boys/Hanna (or another option) first: ${names}`,
        )
        return
      }
      if (!plan.clear.length && !plan.restore.length) {
        await dialog.alert('Already converging here.')
        return
      }
      const bits: string[] = []
      if (plan.restore.length) {
        bits.push(
          `put ${plan.restore.length} earlier event(s) back under options`,
        )
      }
      if (plan.clear.length) {
        bits.push(
          `clear branch from “${stopTitle(stop)}”${
            plan.clear.length > 1
              ? ` and ${plan.clear.length - 1} later event(s)`
              : ''
          }`,
        )
      } else {
        bits.push(`reunite everyone at “${stopTitle(stop)}”`)
      }
      const ok = await dialog.confirm({
        title: 'Mark converge',
        message: `${bits.join(', and ')}?`,
        confirmLabel: 'Mark converge',
      })
      if (!ok) return
      try {
        let doc = null as Awaited<ReturnType<typeof adminUpdateStop>> | null
        for (const r of plan.restore) {
          doc = await adminUpdateStop(tripSlug, day.id, r.stop.id, {
            optionGroup: r.group,
            optionLabel: r.label,
            primary: r.primary,
          })
        }
        for (const s of plan.clear) {
          doc = await adminUpdateStop(tripSlug, day.id, s.id, {
            optionGroup: null,
            optionLabel: null,
            primary: true,
          })
        }
        if (doc) applyAdminDoc(doc)
      } catch (e) {
        await dialog.alert(e instanceof Error ? e.message : 'Failed')
      }
    }
  }

  const submitPrompt = async () => {
    if (!day || !prompt) return
    setPromptBusy(true)
    try {
      if (prompt.kind === 'briefing') {
        const doc = await adminPatchDay(tripSlug, day.id, {
          briefing: promptValue,
        })
        applyAdminDoc(doc)
      } else if (prompt.kind === 'day-meta') {
        const doc = await adminPatchDay(tripSlug, day.id, {
          city: promptValue.trim() || day.city,
          headline: promptExtra.trim() || day.headline,
        })
        applyAdminDoc(doc)
      }
      setPrompt(null)
      setPromptValue('')
      setPromptExtra('')
    } catch (e) {
      await dialog.alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setPromptBusy(false)
    }
  }

  const onImport = () => {
    if (!adminMode) {
      setAdminLoginOpen(true)
      return
    }
    void (async () => {
      const ok = await dialog.confirm({
        title: 'Import vacation',
        message:
          'Import a vacation backup (.json) or historical pack (.zip). JSON restores schedule and guides only — image files are not included.',
        confirmLabel: 'Choose file',
      })
      if (!ok) return
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,.zip,application/json,application/zip'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const fd = new FormData()
        fd.append('file', file)
        setSyncStatus('downloading')
        try {
          const res = await fetch('/api/trips/import', {
            method: 'POST',
            body: fd,
            credentials: 'include',
          })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(text || 'Import failed')
          }
          const tripsNow = await listTrips()
          setTrips(tripsNow)
          setSyncStatus('synced')
          await dialog.alert('Vacation imported.')
        } catch (e) {
          setSyncStatus('error')
          await dialog.alert(e instanceof Error ? e.message : 'Import failed')
        }
      }
      input.click()
    })()
  }

  if (!deviceUser) {
    return <DeviceIdentityGate onChosen={(name) => setDeviceUserState(name)} />
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-ink-soft">
        Loading…
      </div>
    )
  }

  if (!tripId) {
    return (
      <>
        <TripPicker
          trips={trips}
          adminMode={adminMode}
          onSelect={(t) => void openTrip(t)}
          onImportClick={onImport}
          onTripsChanged={refreshTrips}
          onRequestAdmin={() => setAdminLoginOpen(true)}
        />
        <AdminLoginDialog
          open={adminLoginOpen}
          onOpenChange={setAdminLoginOpen}
          onSuccess={() => setAdminMode(true)}
        />
      </>
    )
  }

  if (!day) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <p className="text-ink-soft">No itinerary loaded for this trip.</p>
        <Button variant="outline" onClick={() => setTripId(null)}>
          Back to trips
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh w-full max-w-lg pb-10">
      <Tabs value={tab} onValueChange={setTab}>
        <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTripId(null)}
                  className="rounded-full p-1 text-ink-soft hover:bg-ink/5"
                  aria-label="All trips"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
                  {tripMeta?.title ?? 'Prok Vacation'}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="font-display text-[1.55rem] font-bold leading-tight text-ink">
                  {day.city}
                </h1>
                {adminMode ? (
                  <button
                    type="button"
                    className="rounded-full p-1 text-ink-soft hover:bg-ink/5"
                    aria-label="Edit day location and subject"
                    onClick={() => {
                      setPromptValue(day.city)
                      setPromptExtra(day.headline)
                      setPrompt({ kind: 'day-meta' })
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">
                {day.dateLabel}
                {adminMode ? ' · Admin' : ''} · {deviceUser}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <SyncChip
                status={syncStatus}
                detail={syncDetail}
                onClick={() => tripId && void runSync(tripId)}
              />
              {appVersion ? (
                <span
                  className="select-all text-[10px] tabular-nums tracking-wide text-ink-soft/70"
                  title="App version"
                >
                  v{appVersion}
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (adminMode) {
                    void adminLogout().then(() => setAdminMode(false))
                  } else {
                    setAdminLoginOpen(true)
                  }
                }}
                aria-label={adminMode ? 'Lock admin' : 'Unlock admin'}
              >
                {adminMode ? (
                  <LockOpen className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-stretch gap-2 px-4 pb-3">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => canPrev && setDayId(days[dayIndex - 1].id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-deep/70 text-ink ring-1 ring-line disabled:opacity-35"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-xl bg-ink px-3 py-2 text-paper shadow-sm"
              aria-label="Pick a day"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-paper/70">
                Day {dayIndex + 1} of {days.length}
              </span>
              <span className="truncate text-base font-bold leading-tight">
                {day.navLabel}
              </span>
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => canNext && setDayId(days[dayIndex + 1].id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper-deep/70 text-ink ring-1 ring-line disabled:opacity-35"
              aria-label="Next day"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          <div className="px-4 pb-3">
            <TabsList>
              <TabsTrigger value="highlights" className="px-1.5 text-xs">
                Highlights
              </TabsTrigger>
              <TabsTrigger value="schedule" className="px-1.5 text-xs">
                Schedule
              </TabsTrigger>
              <TabsTrigger value="notes" className="px-1.5 text-xs">
                Notes
              </TabsTrigger>
            </TabsList>
          </div>
        </header>

        <div
          className="relative"
          onPaste={(e) => {
            if (!adminMode) return
            const item = [...e.clipboardData.items].find((i) =>
              i.type.startsWith('image/'),
            )
            const file = item?.getAsFile()
            if (!file) return
            e.preventDefault()
            void uploadHeroFile(file).catch((err) =>
              void dialog.alert(
                err instanceof Error ? err.message : 'Upload failed',
              ),
            )
          }}
        >
          {day.heroImage ? (
            <div className="relative h-[42vh] min-h-[220px] w-full overflow-hidden">
              <img
                src={day.heroImage}
                alt={day.headline}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-paper">
                <h2 className="font-display text-2xl font-bold leading-tight drop-shadow-sm">
                  {day.headline}
                </h2>
                {(day.weather || day.sunrise) && (
                  <p className="mt-2 text-xs text-white/80">
                    {[
                      day.sunrise && day.sunset
                        ? `Rise ${day.sunrise} · Set ${day.sunset}`
                        : null,
                      day.weather,
                    ]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-ink via-[#243447] to-sea px-5 pb-6 pt-8 text-paper">
              <h2 className="font-display text-2xl font-bold leading-tight">
                {day.headline}
              </h2>
              <p className="mt-2 text-sm text-white/75">
                {adminMode
                  ? 'Paste or upload a day picture — details in Highlights & Schedule.'
                  : 'Details in Highlights & Schedule.'}
              </p>
            </div>
          )}
          {adminMode ? (
            <div className="absolute right-3 top-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-paper/90"
                onClick={() => openHeroPhotoActions()}
              >
                <ImagePlus className="h-3.5 w-3.5" /> Photo
              </Button>
              {day.heroImage ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-paper/90"
                  onClick={() => {
                    void (async () => {
                      const ok = await dialog.confirm({
                        title: 'Remove picture',
                        message: 'Remove day picture?',
                        confirmLabel: 'Remove',
                        destructive: true,
                      })
                      if (!ok) return
                      try {
                        const doc = await adminClearHero(tripSlug, day.id)
                        applyAdminDoc(doc)
                      } catch (e) {
                        await dialog.alert(
                          e instanceof Error ? e.message : 'Failed',
                        )
                      }
                    })()
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <main className="px-4 pt-4">
          <TabsContent value="highlights" className="mt-0">
            <HighlightsPanel
              day={day}
              adminMode={adminMode}
              onEditBriefing={() => {
                setPromptValue(day.briefing ?? '')
                setPrompt({ kind: 'briefing' })
              }}
            />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
            <SchedulePanel
              day={day}
              adminMode={adminMode}
              onOpen={(t) => void openViewer(t)}
              onAdminAction={(a, s) => void onAdminAction(a, s)}
              onSetDayMaps={async (maps) => {
                const doc = await adminPatchDay(tripSlug, day.id, {
                  mapsUrls: maps,
                })
                applyAdminDoc(doc)
              }}
              onAddEvent={() => setOverlay({ type: 'create' })}
              onAddOption={async (label, seedStopId) => {
                const g = dayOptionGroupId(day.stops, day.id)
                const primary = isPrimaryLabelForGroup(day.stops, g, label)
                let doc = await adminUpdateStop(tripSlug, day.id, seedStopId, {
                  optionGroup: g,
                  optionLabel: label,
                  primary,
                })
                const order = resolvedOptionOrder(day.stops, day.optionOrder)
                if (!order.includes(label)) {
                  doc = await adminPatchDay(tripSlug, day.id, {
                    optionOrder: [...order, label],
                  })
                }
                applyAdminDoc(doc)
              }}
              onRenameOption={async (group, fromLabel, toLabel) => {
                const targets = stopsWithOptionLabel(
                  day.stops,
                  group,
                  fromLabel,
                )
                let doc = null as Awaited<
                  ReturnType<typeof adminUpdateStop>
                > | null
                for (const s of targets) {
                  doc = await adminUpdateStop(tripSlug, day.id, s.id, {
                    optionGroup: group,
                    optionLabel: toLabel,
                    primary: s.primary,
                  })
                }
                const order = resolvedOptionOrder(day.stops, day.optionOrder)
                const nextOrder = order.map((l) =>
                  l === fromLabel ? toLabel : l,
                )
                if (nextOrder.join('\0') !== order.join('\0')) {
                  doc = await adminPatchDay(tripSlug, day.id, {
                    optionOrder: nextOrder,
                  })
                } else if (day.optionOrder?.includes(fromLabel)) {
                  doc = await adminPatchDay(tripSlug, day.id, {
                    optionOrder: day.optionOrder.map((l) =>
                      l === fromLabel ? toLabel : l,
                    ),
                  })
                }
                if (doc) applyAdminDoc(doc)
              }}
              onDeleteOption={async (group, label) => {
                const targets = stopsWithOptionLabel(day.stops, group, label)
                let doc = null as Awaited<
                  ReturnType<typeof adminUpdateStop>
                > | null
                for (const s of targets) {
                  doc = await adminUpdateStop(tripSlug, day.id, s.id, {
                    optionGroup: null,
                    optionLabel: null,
                    primary: true,
                  })
                }
                const nextOrder = resolvedOptionOrder(
                  day.stops,
                  day.optionOrder,
                ).filter((l) => l !== label)
                doc = await adminPatchDay(tripSlug, day.id, {
                  optionOrder: nextOrder,
                })
                applyAdminDoc(doc)
              }}
              onReorderOptions={async (order) => {
                const doc = await adminPatchDay(tripSlug, day.id, {
                  optionOrder: order,
                })
                applyAdminDoc(doc)
              }}
            />
          </TabsContent>
          <TabsContent value="notes" className="mt-0">
            <NotesPanel tripId={tripId} dayId={day.id} deviceUser={deviceUser} />
          </TabsContent>
        </main>
      </Tabs>

      <DayDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        days={getItinerary().days}
        currentId={day.id}
        onSelect={setDayId}
        adminMode={adminMode}
        onAddDay={() => {
          void adminCreateDay(tripSlug)
            .then((doc) => {
              applyAdminDoc(doc)
              const newId = doc.day?.id as string | undefined
              if (newId) setDayId(newId)
              setDrawerOpen(false)
            })
            .catch((e) =>
              void dialog.alert(e instanceof Error ? e.message : 'Failed'),
            )
        }}
        onRemoveDay={(id) => {
          void (async () => {
            const ok = await dialog.confirm({
              title: 'Remove day',
              message: 'Remove this day from the vacation?',
              confirmLabel: 'Remove',
              destructive: true,
            })
            if (!ok) return
            try {
              const doc = await adminDeleteDay(tripSlug, id)
              applyAdminDoc(doc)
              if (id === day.id) {
                const next = (
                  doc.itinerary?.days as { id: string }[] | undefined
                )?.[0]
                setDayId(next?.id ?? '')
              }
            } catch (e) {
              await dialog.alert(e instanceof Error ? e.message : 'Failed')
            }
          })()
        }}
      />

      <AdminLoginDialog
        open={adminLoginOpen}
        onOpenChange={setAdminLoginOpen}
        onSuccess={() => setAdminMode(true)}
      />

      <Dialog open={Boolean(prompt)} onOpenChange={(o) => !o && setPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {prompt?.kind === 'briefing'
                ? 'Edit briefing'
                : prompt?.kind === 'day-meta'
                  ? 'Day location & subject'
                  : 'Edit'}
            </DialogTitle>
          </DialogHeader>
          {prompt?.kind === 'briefing' ? (
            <textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              rows={6}
              placeholder="Day briefing"
              className={inputClass}
            />
          ) : null}
          {prompt?.kind === 'day-meta' ? (
            <div className="space-y-2">
              <input
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder="Location / city"
                className={inputClass}
              />
              <input
                value={promptExtra}
                onChange={(e) => setPromptExtra(e.target.value)}
                placeholder="Day subject / headline"
                className={inputClass}
              />
            </div>
          ) : null}
          <Button disabled={promptBusy} onClick={() => void submitPrompt()}>
            Save
          </Button>
        </DialogContent>
      </Dialog>

      {overlay?.type === 'create' ? (
        <EventExpand
          mode="create"
          dayStops={day.stops}
          optionOrder={day.optionOrder}
          adminMode={adminMode}
          initialEditMode
          onClose={() => setOverlay(null)}
          onCreate={async (payload: CreateEventPayload) => {
            let doc
            if (payload.siteId) {
              doc = await adminCreateStop(tripSlug, day.id, {
                time: payload.time,
                siteId: payload.siteId,
                timedEntry: payload.timedEntry,
              })
            } else {
              doc = await adminCreateStop(tripSlug, day.id, {
                time: payload.time,
                name: payload.name,
                kind: payload.kind,
                duration: payload.duration,
                timedEntry: payload.timedEntry,
              })
              const siteId = (doc.stop?.siteId as string) || ''
              if (siteId) {
                doc = await adminUpsertGuide(tripSlug, {
                  id: siteId,
                  name: payload.name,
                  kind: payload.kind,
                  duration: payload.duration,
                  hours: payload.hours,
                  cost: payload.cost,
                  summary: payload.summary,
                  bookingRef: payload.bookingRef,
                  bags: payload.bags,
                  transit: payload.transit,
                  vibe: payload.vibe,
                  mustTry: payload.mustTry,
                  notes: payload.notes,
                  logistics: payload.logistics,
                  proTips: payload.proTips,
                  history: payload.history,
                  route: payload.route,
                  mapsUrl: payload.mapsUrl,
                  tickets: payload.tickets,
                  mapPages: payload.mapPages,
                })
              }
            }
            applyAdminDoc(doc)
            setOverlay(null)
          }}
        />
      ) : null}

      {overlay?.type === 'expand' ? (
        <EventExpand
          stop={
            day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
          }
          dayStops={day.stops}
          optionOrder={day.optionOrder}
          adminMode={adminMode}
          initialEditMode={Boolean(overlay.edit)}
          onClose={() => setOverlay(null)}
          onOpenTicket={(ticketId, title) => {
            void openViewer({
              kind: 'ticket',
              stop:
                day.stops.find((s) => s.id === overlay.stop.id) ??
                overlay.stop,
              ticketId,
              title,
            })
          }}
          onOpenMap={(title, pageIndex) => {
            void openViewer({
              kind: 'map',
              stop:
                day.stops.find((s) => s.id === overlay.stop.id) ??
                overlay.stop,
              title,
              pageIndex,
            })
          }}
          onSaveStop={async (patch) => {
            const stopId = overlay.stop.id
            const doc = await adminUpdateStop(tripSlug, day.id, stopId, patch)
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: false } : o,
            )
          }}
          onSaveGuide={async (guide: Site) => {
            const stopId = overlay.stop.id
            const payload = {
              ...guide,
              id: guide.id || undefined,
              name: guide.name,
            }
            if (!payload.name?.trim() && !guide.id) return
            const guideDoc = await adminUpsertGuide(tripSlug, payload)
            const guideId = (guideDoc.guide?.id as string) || guide.id
            let doc = guideDoc
            if (guideId) {
              const current =
                day.stops.find((s) => s.id === stopId) ?? overlay.stop
              if (current.siteId !== guideId) {
                doc = await adminLinkGuide(tripSlug, day.id, stopId, guideId)
              }
            }
            applyAdminDoc(doc)
          }}
          onUnlinkGuide={async (guideId) => {
            const stopId = overlay.stop.id
            const doc = await adminUnlinkGuide(
              tripSlug,
              day.id,
              stopId,
              guideId,
            )
            applyAdminDoc(doc)
          }}
          pickFile={pickFile}
          onAddTicket={async (label, file) => {
            const doc = await adminUploadTicket(
              tripSlug,
              day.id,
              overlay.stop.id,
              label,
              file,
            )
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onRemoveTicket={async (ticketId) => {
            const doc = await adminDeleteTicket(
              tripSlug,
              day.id,
              overlay.stop.id,
              ticketId,
            )
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onAddMap={async (file) => {
            const doc = await adminUploadMap(
              tripSlug,
              day.id,
              overlay.stop.id,
              file,
            )
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onRemoveMap={async () => {
            const doc = await adminClearMap(tripSlug, day.id, overlay.stop.id)
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          dayHeroImage={day.heroImage}
          onUploadPhoto={async () => {
            const stop =
              day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
            const site = getSiteForStop(stop)
            if (!site?.id) {
              await dialog.alert('Event has no linked site')
              return
            }
            const file = await pickFile('image/*')
            if (!file) return
            const doc = await adminUploadSitePhoto(tripSlug, site.id, file)
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
            const photo =
              (typeof doc.photo === 'string' && doc.photo) ||
              getSitePhoto(site.id)
            if (photo && photo !== day.heroImage) {
              const also = await dialog.confirm({
                title: 'Use as day picture?',
                message:
                  'Also use this photo as the day banner? (same image, no copy)',
                confirmLabel: 'Use for day',
              })
              if (also) {
                const heroDoc = await adminPatchDay(tripSlug, day.id, {
                  heroImage: photo,
                })
                applyAdminDoc(heroDoc)
              }
            }
          }}
          onClearPhoto={async () => {
            const stop =
              day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
            const site = getSiteForStop(stop)
            if (!site?.id) return
            const doc = await adminClearSitePhoto(tripSlug, site.id)
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onReusePhoto={async (path) => {
            const stop =
              day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
            const site = getSiteForStop(stop)
            if (!site?.id) {
              await dialog.alert('Event has no linked site')
              return
            }
            const doc = await adminSetSitePhoto(tripSlug, site.id, path)
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onSetMapsUrl={async (url) => {
            const stop =
              day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
            const site = getSiteForStop(stop)
            if (!site) {
              await dialog.alert('Event has no linked site')
              return
            }
            const doc = await adminUpsertGuide(tripSlug, {
              ...site,
              mapsUrl: url,
            })
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onConvertTicketToMap={async (ticketId) => {
            const stop =
              day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
            const site = getSiteForStop(stop)
            if (!site) return
            const ticket = getTicketSets(site).find((t) => t.id === ticketId)
            if (!ticket?.pages.length) return
            await adminUpsertGuide(tripSlug, {
              ...site,
              mapPages: ticket.pages,
              tickets: (site.tickets ?? []).filter((t) => t.id !== ticketId),
            })
            const doc = await adminDeleteTicket(
              tripSlug,
              day.id,
              stop.id,
              ticketId,
            )
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onConvertMapToTicket={async (label) => {
            const stop =
              day.stops.find((s) => s.id === overlay.stop.id) ?? overlay.stop
            const site = getSiteForStop(stop)
            if (!site) return
            const pages = getMapPages(site)
            if (!pages.length) return
            const ticketId = `ticket-${Date.now().toString(36)}`
            const tickets = [
              ...getTicketSets(site).filter((t) => t.id !== ticketId),
              { id: ticketId, label, pages },
            ]
            const doc = await adminUpsertGuide(tripSlug, {
              ...site,
              tickets,
              mapPages: [],
            })
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onAssignOption={async (label, group) => {
            const existingGroups = [
              ...new Set(
                day.stops
                  .map((s) => s.optionGroup)
                  .filter((g): g is string => Boolean(g)),
              ),
            ]
            const g = group || existingGroups[0] || `${day.id}-options`
            const existingInGroup = day.stops.filter((s) => s.optionGroup === g)
            const labelsInGroup = [
              ...new Set(
                existingInGroup
                  .map((s) => s.optionLabel)
                  .filter((l): l is string => Boolean(l)),
              ),
            ]
            const isPrimary =
              !labelsInGroup.length ||
              labelsInGroup[0] === label ||
              label.toLowerCase().includes('option 1')
            const doc = await adminUpdateStop(
              tripSlug,
              day.id,
              overlay.stop.id,
              {
                optionGroup: g,
                optionLabel: label,
                primary: isPrimary,
              },
            )
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
          onClearOption={async () => {
            const doc = await adminUpdateStop(
              tripSlug,
              day.id,
              overlay.stop.id,
              {
                optionGroup: null,
                optionLabel: null,
                primary: true,
              },
            )
            applyAdminDoc(doc)
            setOverlay((o) =>
              o?.type === 'expand' ? { ...o, edit: true } : o,
            )
          }}
        />
      ) : null}

      {heroPicker ? (
        <AttachmentPicker
          open
          onOpenChange={(open) => {
            if (!open) setHeroPicker(null)
          }}
          title={heroPicker.title}
          options={heroPicker.options}
          onSelect={(id) => {
            heroPicker.onSelect(id)
            setHeroPicker(null)
          }}
        />
      ) : null}
    </div>
  )
}
