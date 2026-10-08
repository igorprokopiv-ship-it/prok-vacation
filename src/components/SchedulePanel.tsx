import { BookOpen, ChevronDown, Map as MapIcon, MapPinned, Ticket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ItineraryDay, ItineraryStop } from '@/data/types'
import { getMapPages, getTicketPages, stopHasGuide } from '@/lib/data'
import { cn } from '@/lib/utils'

export type ViewerTarget =
  | { kind: 'ticket'; siteId: string | null; title: string }
  | { kind: 'map'; siteId: string | null; title: string }
  | { kind: 'guide'; siteId: string | null; title: string }

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-soft break-words">{value}</dd>
    </div>
  )
}

function StopCard({
  stop,
  expanded,
  onToggle,
  onOpen,
}: {
  stop: ItineraryStop
  expanded: boolean
  onToggle: () => void
  onOpen: (target: ViewerTarget) => void
}) {
  const tickets = getTicketPages(stop.siteId)
  const maps = getMapPages(stop.siteId)
  const hasGuide = stopHasGuide(stop)

  return (
    <article className="overflow-hidden rounded-xl bg-paper/90 ring-1 ring-line/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <div className="w-14 shrink-0 pt-0.5">
          <div className="font-mono text-sm font-bold text-accent">{stop.time}</div>
          <div className="text-[11px] text-ink-soft">{stop.duration}</div>
        </div>
        <div className="min-w-0 flex-1">
          {stop.optionLabel ? (
            <div className="mb-1 inline-flex rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
              {stop.optionLabel}
            </div>
          ) : null}
          <div className="font-semibold leading-snug text-ink">{stop.title}</div>
          {stop.kind !== 'attraction' ? (
            <div className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-soft">{stop.kind}</div>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-5 w-5 shrink-0 text-ink-soft transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-line/70 px-3 py-3">
            <dl className="space-y-2">
              {stop.hours ? <DetailRow label="Hours" value={stop.hours} /> : null}
              {stop.cost ? <DetailRow label="Cost" value={stop.cost} /> : null}
              {stop.bookingRef ? <DetailRow label="Booking" value={stop.bookingRef} /> : null}
              {stop.bags ? <DetailRow label="Bags" value={stop.bags} /> : null}
              {stop.transit ? <DetailRow label="Transit" value={stop.transit} /> : null}
              {stop.notes ? <DetailRow label="Notes" value={stop.notes} /> : null}
              {stop.mapsUrl ? (
                <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                  <dt className="font-semibold text-ink">Maps</dt>
                  <dd className="text-ink-soft break-all">
                    <a
                      href={stop.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sea underline decoration-sea/40 underline-offset-2"
                    >
                      Open in Google Maps
                    </a>
                    <div className="mt-1 text-xs opacity-80">{stop.mapsUrl}</div>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              {stop.mapsUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={stop.mapsUrl} target="_blank" rel="noreferrer">
                    <MapPinned className="h-3.5 w-3.5" /> Maps
                  </a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpen({ kind: 'ticket', siteId: stop.siteId, title: stop.title })}
              >
                <Ticket className="h-3.5 w-3.5" /> Ticket
                {!tickets.length ? <span className="text-[10px] opacity-60">· none</span> : null}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpen({ kind: 'map', siteId: stop.siteId, title: stop.title })}
              >
                <MapIcon className="h-3.5 w-3.5" /> Map
                {!maps.length ? <span className="text-[10px] opacity-60">· none</span> : null}
              </Button>
              <Button
                variant="sea"
                size="sm"
                onClick={() => onOpen({ kind: 'guide', siteId: stop.siteId, title: stop.title })}
              >
                <BookOpen className="h-3.5 w-3.5" /> Guide
                {!hasGuide ? <span className="text-[10px] opacity-70">· none</span> : null}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export function SchedulePanel({
  day,
  onOpen,
}: {
  day: ItineraryDay
  onOpen: (target: ViewerTarget) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const items: Array<
      | { type: 'label'; key: string; label: string }
      | { type: 'stop'; stop: ItineraryStop }
    > = []
    let lastGroup: string | null = null
    for (const stop of day.stops) {
      if (stop.optionGroup && stop.optionLabel && stop.optionGroup !== lastGroup) {
        items.push({
          type: 'label',
          key: `${stop.optionGroup}-${stop.optionLabel}`,
          label: stop.optionLabel,
        })
        lastGroup = stop.optionGroup
      }
      if (!stop.optionGroup) lastGroup = null
      items.push({ type: 'stop', stop })
    }
    return items
  }, [day.stops])

  return (
    <div className="space-y-2">
      <p className="px-1 text-sm text-ink-soft">
        Full EU4 timeline — tap a row for hours, cost, Maps, tickets, and guides.
      </p>
      {grouped.map((item) => {
        if (item.type === 'label') {
          return (
            <div
              key={item.key}
              className="sticky top-[7.5rem] z-[5] -mx-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
            >
              {item.label}
            </div>
          )
        }
        return (
          <StopCard
            key={item.stop.id}
            stop={item.stop}
            expanded={expandedId === item.stop.id}
            onToggle={() =>
              setExpandedId((id) => (id === item.stop.id ? null : item.stop.id))
            }
            onOpen={onOpen}
          />
        )
      })}
    </div>
  )
}
