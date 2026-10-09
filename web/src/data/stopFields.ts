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
  cost?: string
  bookingRef?: string
  bags?: string
  transit?: string
  notes?: string
} {
  const kind = stop.kind
  return {
    cost: showCost(kind) && stop.cost ? stop.cost : undefined,
    bookingRef:
      showTransitExtras(kind) && stop.bookingRef ? stop.bookingRef : undefined,
    bags: showTransitExtras(kind) && stop.bags ? stop.bags : undefined,
    transit: showTransitExtras(kind) && stop.transit ? stop.transit : undefined,
    notes: stop.notes || undefined,
  }
}

export function stopHasVisibleDetails(stop: ItineraryStop): boolean {
  const d = stopDetailFields(stop)
  return Boolean(
    d.cost || d.bookingRef || d.bags || d.transit || d.notes || stop.mapsUrl,
  )
}

export function guideHasVisibleContent(site: Site, kind: StopKind): boolean {
  return visibleGuideSections(kind).some((key) => (site[key]?.length ?? 0) > 0)
}
