import { Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/RichText'
import type { Itinerary, ItineraryStop, Site } from '@/data/types'
import { isEmptyRichText } from '@/lib/richText'

function siteName(stop: ItineraryStop, sites: Site[]): string {
  if (!stop.siteId) return 'Untitled stop'
  const site = sites.find((s) => s.id === stop.siteId)
  return site?.name ?? stop.siteId
}

function siteKindLabel(stop: ItineraryStop, sites: Site[]): string | null {
  if (!stop.siteId) return null
  const site = sites.find((s) => s.id === stop.siteId)
  return site?.kind ?? null
}

export function PrintableItinerary({
  title,
  startDate,
  endDate,
  itinerary,
  sites,
  onClose,
}: {
  title: string
  startDate?: string | null
  endDate?: string | null
  itinerary: Itinerary
  sites: Site[]
  onClose: () => void
}) {
  const dateRange = [startDate, endDate].filter(Boolean).join(' → ')

  return (
    <div className="print-root fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="print-toolbar sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-md">
        <p className="text-sm font-medium text-ink-soft">
          Print preview — use Save as PDF in the print dialog
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <article className="print-document mx-auto max-w-3xl px-6 py-8 text-ink">
        <header className="print-cover border-b border-line pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
            Prok Vacation
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight">
            {title || itinerary.title}
          </h1>
          {dateRange ? (
            <p className="mt-3 text-base text-ink-soft">{dateRange}</p>
          ) : null}
          <p className="mt-2 text-sm text-ink-soft">
            {itinerary.days.length} day{itinerary.days.length === 1 ? '' : 's'}
          </p>
        </header>

        {itinerary.days.map((day) => (
          <section key={day.id} className="print-day mt-10 break-inside-avoid">
            <div className="border-b border-line pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sea">
                {day.dateLabel || day.date}
                {day.type ? ` · ${day.type}` : ''}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">{day.city}</h2>
              {day.headline ? (
                <p className="mt-1 text-base text-ink-soft">{day.headline}</p>
              ) : null}
            </div>

            {day.briefing && !isEmptyRichText(day.briefing) ? (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Briefing
                </h3>
                <RichText value={day.briefing} className="mt-1 text-sm leading-relaxed" />
              </div>
            ) : null}

            {day.stops?.length ? (
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Schedule
                </h3>
                <ul className="mt-2 space-y-2">
                  {day.stops.map((stop) => {
                    const kind = siteKindLabel(stop, sites)
                    return (
                      <li
                        key={stop.id}
                        className="flex gap-3 border-b border-line/50 py-2 text-sm"
                      >
                        <span className="w-14 shrink-0 font-semibold tabular-nums">
                          {stop.time || '—'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{siteName(stop, sites)}</span>
                          {kind ? (
                            <span className="ml-2 text-ink-soft">· {kind}</span>
                          ) : null}
                          {stop.optionLabel ? (
                            <span className="ml-2 text-ink-soft">
                              ({stop.optionLabel})
                            </span>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

            {day.highlights?.length ? (
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Highlights
                </h3>
                <ul className="mt-2 space-y-3">
                  {day.highlights.map((h) => (
                    <li key={`${h.stopId}-${h.time}-${h.title}`} className="text-sm">
                      <div className="font-medium">
                        {h.time ? (
                          <span className="tabular-nums text-ink-soft">{h.time} · </span>
                        ) : null}
                        {h.title}
                        {h.duration ? (
                          <span className="ml-2 font-normal text-ink-soft">
                            ({h.duration})
                          </span>
                        ) : null}
                      </div>
                      {h.summary && !isEmptyRichText(h.summary) ? (
                        <RichText
                          value={h.summary}
                          className="mt-1 text-ink-soft leading-relaxed"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {day.food?.name ? (
              <div className="mt-5 text-sm">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Food
                </h3>
                <p className="mt-1 font-medium">{day.food.name}</p>
                {day.food.vibe ? (
                  <p className="text-ink-soft">{day.food.vibe}</p>
                ) : null}
                {day.food.mustTry ? (
                  <p className="text-ink-soft">Must try: {day.food.mustTry}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        ))}
      </article>
    </div>
  )
}
