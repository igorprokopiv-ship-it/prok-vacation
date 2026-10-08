import { CalendarDays, Compass } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DayDrawer } from '@/components/DayDrawer'
import { HighlightsPanel } from '@/components/HighlightsPanel'
import { ImageViewer } from '@/components/ImageViewer'
import { SchedulePanel, type ViewerTarget } from '@/components/SchedulePanel'
import { SiteGuide } from '@/components/SiteGuide'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getMapPages,
  getSite,
  getTicketPages,
  itinerary,
} from '@/lib/data'

type Overlay =
  | { type: 'ticket'; title: string; pages: string[] }
  | { type: 'map'; title: string; pages: string[] }
  | { type: 'guide'; siteId: string | null }
  | null

export default function App() {
  const [dayId, setDayId] = useState(itinerary.days[0]?.id ?? '')
  const [tab, setTab] = useState('highlights')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>(null)

  const day = useMemo(
    () => itinerary.days.find((d) => d.id === dayId) ?? itinerary.days[0],
    [dayId],
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTab('highlights')
    setOverlay(null)
  }, [dayId])

  const openViewer = (target: ViewerTarget) => {
    if (target.kind === 'guide') {
      setOverlay({ type: 'guide', siteId: target.siteId })
      return
    }
    if (target.kind === 'ticket') {
      setOverlay({
        type: 'ticket',
        title: `${target.title} · Ticket`,
        pages: getTicketPages(target.siteId),
      })
      return
    }
    setOverlay({
      type: 'map',
      title: `${target.title} · Map`,
      pages: getMapPages(target.siteId),
    })
  }

  if (!day) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-ink-soft">
        No itinerary loaded.
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh w-full max-w-lg pb-28">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
              EU2026 Trip Companion
            </p>
            <h1 className="mt-1 font-display text-[1.55rem] font-bold leading-tight text-ink">
              {day.city}
            </h1>
            <p className="mt-0.5 text-sm text-ink-soft">{day.dateLabel}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setDrawerOpen(true)}
          >
            <CalendarDays className="h-4 w-4" /> Days
          </Button>
        </div>
        <div className="px-4 pb-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="highlights">Highlights</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {day.heroImage ? (
        <div className="relative h-[42vh] min-h-[220px] w-full overflow-hidden">
          <img
            src={day.heroImage}
            alt={day.headline}
            className="h-full w-full object-cover animate-in fade-in duration-700"
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
          <h2 className="font-display text-2xl font-bold leading-tight">{day.headline}</h2>
          <p className="mt-2 text-sm text-white/75">Transit day — details in Highlights & Schedule.</p>
        </div>
      )}

      <main className="px-4 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="highlights" className="mt-0">
            <HighlightsPanel day={day} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
            <SchedulePanel day={day} onOpen={openViewer} />
          </TabsContent>
        </Tabs>
      </main>

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
        days={itinerary.days}
        currentId={day.id}
        onSelect={setDayId}
      />

      {overlay?.type === 'ticket' ? (
        <ImageViewer
          title={overlay.title}
          pages={overlay.pages}
          emptyTitle="Ticket not added yet"
          emptyDetail="Drop ticket PDF pages into public/images/tickets/<site-id>/ and list them in assets.json."
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.type === 'map' ? (
        <ImageViewer
          title={overlay.title}
          pages={overlay.pages}
          emptyTitle="No map yet"
          emptyDetail="Add map page images under public/images/maps/<site-id>/ and wire them in assets.json."
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.type === 'guide' ? (
        <SiteGuide site={getSite(overlay.siteId)} onClose={() => setOverlay(null)} />
      ) : null}
    </div>
  )
}
