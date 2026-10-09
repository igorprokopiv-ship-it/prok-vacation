import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { ItineraryDay } from '@/data/types'
import { cn } from '@/lib/utils'

export function HighlightsPanel({ day }: { day: ItineraryDay }) {
  const [openId, setOpenId] = useState<string | null>(day.highlights[0]?.stopId ?? null)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-paper/80 p-4 shadow-[0_8px_24px_rgba(28,42,58,0.06)] ring-1 ring-line/70">
        <h2 className="font-display text-lg font-bold text-ink">The Briefing</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{day.briefing}</p>
      </section>

      {day.type === 'transit' ? (
        <section className="rounded-2xl bg-paper/80 p-4 shadow-[0_8px_24px_rgba(28,42,58,0.06)] ring-1 ring-line/70">
          <h2 className="font-display text-lg font-bold text-ink">The Mission</h2>
          <ol className="mt-3 space-y-2">
            {day.stops
              .filter((s) => s.kind !== 'rest')
              .slice(0, 8)
              .map((stop) => (
                <li
                  key={stop.id}
                  className="rounded-lg bg-paper-deep/60 px-3 py-2 text-sm text-ink-soft"
                >
                  <span className="font-semibold text-ink">{stop.time}</span> — {stop.title}
                  {stop.notes ? <span className="block mt-1 text-ink-soft/90">{stop.notes}</span> : null}
                </li>
              ))}
          </ol>
        </section>
      ) : (
        <section className="rounded-2xl bg-paper/80 p-4 shadow-[0_8px_24px_rgba(28,42,58,0.06)] ring-1 ring-line/70">
          <h2 className="font-display text-lg font-bold text-ink">Main attractions</h2>
          <div className="mt-3 space-y-2">
            {day.highlights.length === 0 ? (
              <p className="text-sm text-ink-soft">No highlight stops for this day — check the Schedule tab.</p>
            ) : (
              day.highlights.map((h) => {
                const open = openId === h.stopId
                return (
                  <div key={h.stopId} className="overflow-hidden rounded-xl bg-paper-deep/50">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                      onClick={() => setOpenId(open ? null : h.stopId)}
                    >
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-sea">
                          {h.time} · {h.duration}
                        </div>
                        <div className="font-semibold text-ink">{h.title}</div>
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
                        <p className="px-3 pb-3 text-sm leading-relaxed text-ink-soft">{h.summary}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-sea to-sea-soft p-4 text-white shadow-[0_8px_24px_rgba(47,111,122,0.25)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Food focus</p>
        <h2 className="mt-1 font-display text-xl font-bold">{day.food.name}</h2>
        <p className="mt-2 text-sm text-white/90">{day.food.vibe}</p>
        <p className="mt-3 text-sm font-semibold">
          Must-try: <span className="font-normal text-white/95">{day.food.mustTry}</span>
        </p>
        {(day.food.hours || day.food.cost) && (
          <p className="mt-2 text-xs text-white/75">
            {[day.food.hours, day.food.cost].filter(Boolean).join(' · ')}
          </p>
        )}
      </section>
    </div>
  )
}
