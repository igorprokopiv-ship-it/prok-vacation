import type { TripSummary } from '@/lib/contentSync'

export function TripPicker({
  trips,
  onSelect,
  onImportClick,
}: {
  trips: TripSummary[]
  onSelect: (trip: TripSummary) => void
  onImportClick?: () => void
}) {
  return (
    <div className="mx-auto min-h-svh w-full max-w-lg px-4 pb-16 pt-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
        Prok Vacation
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Your trips</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Each trip works offline after a quick sync. Pick one to open.
      </p>

      <ul className="mt-8 space-y-3">
        {trips.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className="w-full rounded-2xl border border-line/80 bg-paper px-4 py-4 text-left shadow-sm transition hover:border-sea/40"
            >
              <div className="font-display text-lg font-bold text-ink">{t.title}</div>
              <div className="mt-1 text-sm text-ink-soft">
                {[t.start_date, t.end_date].filter(Boolean).join(' → ') || t.slug}
                {t.status ? ` · ${t.status}` : ''}
              </div>
            </button>
          </li>
        ))}
        {!trips.length ? (
          <li className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            No trips yet. Sync online or import a content pack.
          </li>
        ) : null}
      </ul>

      {onImportClick ? (
        <button
          type="button"
          onClick={onImportClick}
          className="mt-6 w-full rounded-xl border border-line py-3 text-sm font-semibold text-sea"
        >
          Import historical trip pack (.zip)
        </button>
      ) : null}
    </div>
  )
}
