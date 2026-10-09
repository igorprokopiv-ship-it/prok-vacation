import { ArrowLeft, CalendarDays, Compass } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DayDrawer } from '@/components/DayDrawer'
import { HighlightsPanel } from '@/components/HighlightsPanel'
import { ImageViewer } from '@/components/ImageViewer'
import { LinksBar } from '@/components/LinksBar'
import { NotesPanel } from '@/components/NotesPanel'
import { PlanPanel } from '@/components/PlanPanel'
import { SchedulePanel, type ViewerTarget } from '@/components/SchedulePanel'
import { SiteGuide } from '@/components/SiteGuide'
import { SyncChip } from '@/components/SyncChip'
import { TripPicker } from '@/components/TripPicker'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  applyTripDocument,
  getItinerary,
  getMapPages,
  getSite,
  getSites,
  getTicketPages,
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

const EU2026_ID = 'a1111111-1111-4111-8111-111111111111'

type Overlay =
  | { type: 'ticket'; title: string; pages: string[] }
  | { type: 'map'; title: string; pages: string[] }
  | { type: 'guide'; siteId: string | null }
  | null

export default function App() {
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
  const [tick, setTick] = useState(0)

  const itinerary = getItinerary()
  const day = useMemo(() => {
    void tick
    const days = getItinerary().days
    return days.find((d) => d.id === dayId) ?? days[0]
  }, [dayId, tick])

  useEffect(() => {
    void (async () => {
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
    setTab('highlights')
    setOverlay(null)
  }, [dayId])

  const openTrip = async (trip: TripSummary, sync = true) => {
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

  const runSync = async (id: string) => {
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

  const openViewer = async (target: ViewerTarget) => {
    if (target.kind === 'guide') {
      setOverlay({ type: 'guide', siteId: target.siteId })
      return
    }
    const raw =
      target.kind === 'ticket'
        ? getTicketPages(target.siteId)
        : getMapPages(target.siteId)
    const pages = tripId ? await resolveAssetUrls(tripId, raw) : raw
    setOverlay({
      type: target.kind,
      title: `${target.title} · ${target.kind === 'ticket' ? 'Ticket' : 'Map'}`,
      pages,
    })
  }

  const onImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const fd = new FormData()
      fd.append('file', file)
      setSyncStatus('downloading')
      try {
        const res = await fetch('/api/trips/import', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('import failed')
        const tripsNow = await listTrips()
        setTrips(tripsNow)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }
    input.click()
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
      <TripPicker
        trips={trips}
        onSelect={(t) => void openTrip(t)}
        onImportClick={onImport}
      />
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
    <div className="mx-auto min-h-svh w-full max-w-lg pb-28">
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
              <h1 className="mt-1 font-display text-[1.55rem] font-bold leading-tight text-ink">
                {day.city}
              </h1>
              <p className="mt-0.5 text-sm text-ink-soft">{day.dateLabel}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <SyncChip
                status={syncStatus}
                detail={syncDetail}
                onClick={() => tripId && void runSync(tripId)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDrawerOpen(true)}
              >
                <CalendarDays className="h-4 w-4" /> Days
              </Button>
            </div>
          </div>
          <LinksBar
            tripId={tripId}
            dayDate={day.date}
            tripStart={tripMeta?.start_date}
            tripEnd={tripMeta?.end_date}
          />
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
              <TabsTrigger value="plan" className="px-1.5 text-xs">
                Plan
              </TabsTrigger>
            </TabsList>
          </div>
        </header>

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
              Transit day — details in Highlights & Schedule.
            </p>
          </div>
        )}

        <main className="px-4 pt-4">
          <TabsContent value="highlights" className="mt-0">
            <HighlightsPanel day={day} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
            <SchedulePanel day={day} onOpen={(t) => void openViewer(t)} />
          </TabsContent>
          <TabsContent value="notes" className="mt-0">
            <NotesPanel tripId={tripId} dayId={day.id} />
          </TabsContent>
          <TabsContent value="plan" className="mt-0">
            <PlanPanel tripId={tripId} sites={getSites()} />
          </TabsContent>
        </main>
      </Tabs>

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_rgba(184,92,56,0.45)] transition hover:scale-105 active:scale-95"
        aria-label="Open day list"
      >
        <Compass className="h-6 w-6" />
      </button>

      <DayDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        days={getItinerary().days}
        currentId={day.id}
        onSelect={setDayId}
      />

      {overlay?.type === 'ticket' ? (
        <ImageViewer
          title={overlay.title}
          pages={overlay.pages}
          emptyTitle="Ticket not added yet"
          emptyDetail="Drop PDFs into content/inbox/tickets, convert, rebuild the pack."
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.type === 'map' ? (
        <ImageViewer
          title={overlay.title}
          pages={overlay.pages}
          emptyTitle="No map yet"
          emptyDetail="Drop maps into content/inbox/maps, convert, rebuild the pack."
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.type === 'guide' ? (
        <SiteGuide site={getSite(overlay.siteId)} onClose={() => setOverlay(null)} />
      ) : null}
    </div>
  )
}
