import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Site, StopKind } from '@/data/types'
import { getItinerary, getSites } from '@/lib/data'
import { dayLocationLabel } from '@/lib/dayLocations'
import type { TripLocation } from '@/lib/tripMeta'
import { cn } from '@/lib/utils'

const ALL_KINDS: Array<StopKind | 'all'> = [
  'all',
  'attraction',
  'transit',
  'meal',
  'hotel',
  'show',
  'photo',
  'shopping',
  'rest',
]

function citiesForSite(siteId: string, locations: TripLocation[]): string[] {
  const cities = new Set<string>()
  for (const day of getItinerary().days) {
    if (!day.stops.some((s) => s.siteId === siteId)) continue
    const label = dayLocationLabel(day, locations)
    if (!label || label === 'Unassigned') continue
    for (const part of label.split(' · ')) {
      const name = part.trim()
      if (name) cities.add(name)
    }
  }
  return [...cities].sort((a, b) => a.localeCompare(b))
}

export function SitePickerDialog({
  open,
  onOpenChange,
  defaultKind,
  locations = [],
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultKind?: StopKind
  locations?: TripLocation[]
  onSelect: (site: Site) => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<StopKind | 'all'>(defaultKind ?? 'all')
  const [city, setCity] = useState<string>('all')

  useEffect(() => {
    if (!open) return
    setKind(defaultKind ?? 'all')
    setQuery('')
    setCity('all')
  }, [open, defaultKind])

  const sites = useMemo(() => getSites(), [open])

  const cityOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of sites) {
      for (const c of citiesForSite(s.id, locations)) set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [sites, locations])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sites
      .filter((s) => (kind === 'all' ? true : s.kind === kind))
      .filter((s) => {
        if (city === 'all') return true
        if (city === 'other') return citiesForSite(s.id, locations).length === 0
        return citiesForSite(s.id, locations).includes(city)
      })
      .filter((s) => {
        if (!q) return true
        return s.name.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [sites, kind, city, query, locations])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b border-line px-4 py-3">
          <DialogTitle>Use existing site</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 border-b border-line px-4 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name…"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {ALL_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'rounded-lg px-2 py-1 text-[11px] font-semibold capitalize',
                  kind === k
                    ? 'bg-sea text-white'
                    : 'bg-paper-deep text-ink-soft ring-1 ring-line',
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCity('all')}
              className={cn(
                'rounded-lg px-2 py-1 text-[11px] font-semibold',
                city === 'all'
                  ? 'bg-accent text-white'
                  : 'bg-paper-deep text-ink-soft ring-1 ring-line',
              )}
            >
              All locations
            </button>
            {cityOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCity(c)}
                className={cn(
                  'rounded-lg px-2 py-1 text-[11px] font-semibold',
                  city === c
                    ? 'bg-accent text-white'
                    : 'bg-paper-deep text-ink-soft ring-1 ring-line',
                )}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCity('other')}
              className={cn(
                'rounded-lg px-2 py-1 text-[11px] font-semibold',
                city === 'other'
                  ? 'bg-accent text-white'
                  : 'bg-paper-deep text-ink-soft ring-1 ring-line',
              )}
            >
              Other
            </button>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">
              No sites match.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((s) => {
                const locs = citiesForSite(s.id, locations)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left hover:bg-paper-deep"
                      onClick={() => {
                        onSelect(s)
                        onOpenChange(false)
                      }}
                    >
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span className="text-[11px] text-ink-soft">
                        {s.kind}
                        {locs.length ? ` · ${locs.join(', ')}` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-line px-4 py-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
