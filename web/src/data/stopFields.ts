import type { Site, StopKind } from '@/data/types'
import { isEmptyRichText } from '@/lib/richText'

export type GuideSectionKey = keyof Pick<
  Site,
  'notes' | 'logistics' | 'proTips' | 'history' | 'route'
>

/** Transit-only editable override field (flights, Eurostar, etc.). */
export function showDuration(kind: StopKind): boolean {
  return kind === 'transit'
}

export function showCost(kind: StopKind): boolean {
  return kind !== 'photo' && kind !== 'rest'
}

/** bookingRef, bags[], transit free-text */
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
  if (key === 'notes' || key === 'logistics' || key === 'proTips') return true
  if (key === 'history') return showHistoryGuide(kind)
  if (key === 'route') return showRouteGuide(kind)
  return false
}

export function visibleGuideSections(kind: StopKind): GuideSectionKey[] {
  return (
    ['notes', 'logistics', 'proTips', 'history', 'route'] as GuideSectionKey[]
  ).filter((key) => showGuideSection(kind, key))
}

export function siteKind(site: Site | null | undefined): StopKind {
  return site?.kind || 'attraction'
}

export function siteDetailFields(site: Site | null | undefined): {
  hours?: string
  cost?: string
  bookingRef?: string
  bags?: string[]
  transit?: string
  summary?: string
  vibe?: string
  mustTry?: string
} {
  if (!site) return {}
  const kind = siteKind(site)
  const vibe = showMealExtras(kind) ? asStringList(site.vibe) : []
  const mustTry = showMealExtras(kind) ? asStringList(site.mustTry) : []
  const bags = showTransitExtras(kind) ? asStringList(site.bags) : []
  return {
    hours: showHours(kind) && site.hours ? site.hours : undefined,
    cost: showCost(kind) && site.cost ? site.cost : undefined,
    bookingRef:
      showTransitExtras(kind) && site.bookingRef ? site.bookingRef : undefined,
    bags: bags.length ? bags : undefined,
    transit:
      showTransitExtras(kind) &&
      site.transit &&
      !isEmptyRichText(site.transit)
        ? site.transit
        : undefined,
    summary:
      site.summary && !isEmptyRichText(site.summary)
        ? site.summary
        : undefined,
    vibe: vibe.length ? vibe.join(' · ') : undefined,
    mustTry: mustTry.length ? mustTry.join(' · ') : undefined,
  }
}

/** @deprecated prefer siteDetailFields */
export const stopDetailFields = siteDetailFields

export function siteHasVisibleDetails(site: Site | null | undefined): boolean {
  const d = siteDetailFields(site)
  return Boolean(
    d.hours ||
      d.cost ||
      d.bookingRef ||
      d.bags ||
      d.transit ||
      d.summary ||
      d.vibe ||
      d.mustTry,
  )
}

/** @deprecated prefer siteHasVisibleDetails */
export const stopHasVisibleDetails = siteHasVisibleDetails

export function guideHasVisibleContent(site: Site, kind: StopKind): boolean {
  return visibleGuideSections(kind).some((key) => (site[key]?.length ?? 0) > 0)
}
