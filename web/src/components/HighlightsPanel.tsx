import { AlarmClock, ChevronDown, ExternalLink, MapPinned, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/RichText'
import { siteKind } from '@/data/stopFields'
import type { ItineraryDay, ItineraryStop } from '@/data/types'
import { getSiteForStop, stopTitle } from '@/lib/data'
import { displayDuration, nextStopInSequence } from '@/lib/duration'
import { isEmptyRichText } from '@/lib/richText'
import { cn } from '@/lib/utils'

function byTime<T extends { time: string }>(a: T, b: T) {
  return (a.time || '99:99').localeCompare(b.time || '99:99')
}

export function HighlightsPanel({
  day,
  adminMode = false,
  onEditBriefing,
}: {
  day: ItineraryDay
  adminMode?: boolean
  onEditBriefing?: () => void
}) {
  const stopsById = useMemo(() => {
    const m = new Map<string, ItineraryStop>()
    for (const s of day.stops) m.set(s.id, s)
    return m
  }, [day.stops])

  const sortedHighlights = useMemo(() => {
    return [...day.highlights].sort(byTime).filter((h) => {
      const stop = stopsById.get(h.stopId)
      if (!stop) return true
      return siteKind(getSiteForStop(stop)) !== 'meal'
    })
  }, [day.highlights, stopsById])

  const foodMeals = useMemo(() => {
    return day.highlights
      .map((h) => stopsById.get(h.stopId))
      .filter((s): s is ItineraryStop =>
        Boolean(s && siteKind(getSiteForStop(s)) === 'meal'),
      )
      .sort(byTime)
  }, [day.highlights, stopsById])

  const [openId, setOpenId] = useState<string | null>(
    sortedHighlights[0]?.stopId ?? foodMeals[0]?.id ?? null,
  )

  const dayMaps = day.mapsUrls ?? []

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-paper/80 p-4 shadow-[0_8px_24px_rgba(28,42,58,0.06)] ring-1 ring-line/70">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">The Briefing</h2>
          {adminMode && onEditBriefing ? (
            <Button variant="outline" size="sm" onClick={onEditBriefing}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {day.briefing || (adminMode ? 'No briefing yet — tap Edit to add one.' : '')}
        </p>
      </section>

      <section className="rounded-2xl bg-paper/80 p-4 shadow-[0_8px_24px_rgba(28,42,58,0.06)] ring-1 ring-line/70">
        <h2 className="font-display text-lg font-bold text-ink">Main attractions</h2>
        <div className="mt-3 space-y-2">
          {sortedHighlights.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No highlight stops for this day — check the Schedule tab.
              {adminMode
                ? ' Highlight non-meal events on Schedule to show them here.'
                : ''}
            </p>
          ) : (
            sortedHighlights.map((h) => {
              const open = openId === h.stopId
              const stop = stopsById.get(h.stopId)
              return (
                <div key={h.stopId} className="overflow-hidden rounded-xl bg-paper-deep/50">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    onClick={() => setOpenId(open ? null : h.stopId)}
                  >
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-sea">
                        {[
                          h.time,
                          stop
                            ? displayDuration(
                                stop,
                                nextStopInSequence(day.stops, stop.id),
                              ) || null
                            : h.duration || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="font-semibold text-ink">{h.title}</div>
                        {stop?.timedEntry ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                            <AlarmClock className="h-3 w-3" />
                            Timed
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 shrink-0 text-ink-soft transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-300',
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3 pb-3 text-sm leading-relaxed text-ink-soft">
                        {h.summary ? <RichText value={h.summary} /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {foodMeals.length > 0 ? (
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-sea to-sea-soft p-4 text-white shadow-[0_8px_24px_rgba(47,111,122,0.25)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
            Food focus
          </p>
          <ul className="mt-3 space-y-3">
            {foodMeals.map((meal) => {
              const mealSite = getSiteForStop(meal)
              return (
              <li key={meal.id} className="rounded-xl bg-white/10 px-3 py-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  {meal.time}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <h3 className="font-display text-lg font-bold">{stopTitle(meal)}</h3>
                  {meal.timedEntry ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      <AlarmClock className="h-3 w-3" />
                      Timed
                    </span>
                  ) : null}
                </div>
                {mealSite?.vibe?.length ? (
                  <p className="mt-1.5 text-sm text-white/90">
                    {mealSite.vibe.join(' · ')}
                  </p>
                ) : null}
                {mealSite?.mustTry?.length ? (
                  <p className="mt-1.5 text-xs text-white/75">
                    Must try: {mealSite.mustTry.join(' · ')}
                  </p>
                ) : null}
                {mealSite?.summary && !isEmptyRichText(mealSite.summary) ? (
                  <div className="mt-1.5 text-sm text-white/90">
                    <RichText value={mealSite.summary} />
                  </div>
                ) : null}
                {mealSite?.cost ? (
                  <p className="mt-1.5 text-xs text-white/75">{mealSite.cost}</p>
                ) : null}
              </li>
              )
            })}
          </ul>
          {adminMode ? (
            <p className="mt-3 text-xs text-white/65">
              Highlight meal events on Schedule to add or remove them here.
            </p>
          ) : null}
        </section>
      ) : null}

      {dayMaps.length ? (
        <section className="rounded-2xl bg-paper/80 p-4 shadow-[0_8px_24px_rgba(28,42,58,0.06)] ring-1 ring-line/70">
          <h2 className="font-display text-lg font-bold text-ink">Day maps</h2>
          <ul className="mt-3 space-y-1.5">
            {dayMaps.map((m) => (
              <li key={m.id}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-paper-deep/60 px-3 py-2.5 text-sm font-semibold text-sea hover:bg-paper-deep"
                >
                  <MapPinned className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
