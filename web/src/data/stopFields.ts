import type { ItineraryStop, Site, StopKind } from '@/data/types'

export type GuideSectionKey = keyof Pick<
  Site,
  'logistics' | 'proTips' | 'history' | 'route'
>

export function showDuration(kind: StopKind): boolean {
  return kind === 'transit'
}

export function showCost(kind: StopKind): boolean {
  return kind !== 'photo' && kind !== 'rest'
}

/** bookingRef, bags, transit free-text */
export function showTransitExtras(kind: StopKind): boolean {
  return kind === 'transit'
}

/** vibe, mustTry */
export function showMealExtras(kind: StopKind): boolean {
  return kind === 'meal'
}

/** opening hours */
export function showHours(kind: StopKind): boolean {
  return kind === 'meal' || kind === 'attraction'
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

export function showHistoryGuide(kind: StopKind): boolean {
  return kind === 'show' || kind === 'photo' || kind === 'attraction'
}

export function showRouteGuide(kind: StopKind): boolean {
  return kind === 'attraction' || kind === 'photo' || kind === 'shopping'
}

export function showGuideSection(
  kind: StopKind,
  key: GuideSectionKey,
): boolean {
  if (key === 'logistics' || key === 'proTips') return true
  if (key === 'history') return showHistoryGuide(kind)
  if (key === 'route') return showRouteGuide(kind)
  return false
}

export function visibleGuideSections(kind: StopKind): GuideSectionKey[] {
  return (
    ['logistics', 'proTips', 'history', 'route'] as GuideSectionKey[]
  ).filter((key) => showGuideSection(kind, key))
}

export function stopDetailFields(stop: ItineraryStop): {
  hours?: string
  cost?: string
  bookingRef?: string
  bags?: string
  transit?: string
  notes?: string
  vibe?: string
  mustTry?: string
} {
  const kind = stop.kind
  const vibe = showMealExtras(kind) ? asStringList(stop.vibe) : []
  const mustTry = showMealExtras(kind) ? asStringList(stop.mustTry) : []
  return {
    hours: showHours(kind) && stop.hours ? stop.hours : undefined,
    cost: showCost(kind) && stop.cost ? stop.cost : undefined,
    bookingRef:
      showTransitExtras(kind) && stop.bookingRef ? stop.bookingRef : undefined,
    bags: showTransitExtras(kind) && stop.bags ? stop.bags : undefined,
    transit: showTransitExtras(kind) && stop.transit ? stop.transit : undefined,
    notes: stop.notes || undefined,
    vibe: vibe.length ? vibe.join(' · ') : undefined,
    mustTry: mustTry.length ? mustTry.join(' · ') : undefined,
  }
}

export function stopHasVisibleDetails(stop: ItineraryStop): boolean {
  const d = stopDetailFields(stop)
  return Boolean(
    d.hours ||
      d.cost ||
      d.bookingRef ||
      d.bags ||
      d.transit ||
      d.notes ||
      d.vibe ||
      d.mustTry,
  )
}

export function guideHasVisibleContent(site: Site, kind: StopKind): boolean {
  return visibleGuideSections(kind).some((key) => (site[key]?.length ?? 0) > 0)
}
