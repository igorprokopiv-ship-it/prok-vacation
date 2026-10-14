import type { ItineraryDay } from '@/data/types'
import type { TripLocation } from '@/lib/tripMeta'

/** Resolve display label for a day's locations (with city fallback). */
export function dayLocationLabel(
  day: Pick<ItineraryDay, 'locationIds' | 'city'>,
  locations: TripLocation[] | undefined | null,
): string {
  const ids = day.locationIds?.filter(Boolean) ?? []
  if (ids.length) {
    const byId = new Map((locations ?? []).map((loc) => [loc.id, loc.name]))
    const names = ids
      .map((id) => byId.get(id)?.trim())
      .filter((n): n is string => Boolean(n))
    if (names.length) return names.join(' · ')
  }
  const legacy = day.city?.trim()
  return legacy || 'Unassigned'
}

export function locationIdsUsedInDays(
  days: Array<Pick<ItineraryDay, 'locationIds'>>,
): Set<string> {
  const used = new Set<string>()
  for (const day of days) {
    for (const id of day.locationIds ?? []) {
      if (id) used.add(id)
    }
  }
  return used
}
