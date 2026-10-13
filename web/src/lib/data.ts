import bundledAssets from '@/data/assets.json'
import bundledItinerary from '@/data/itinerary.json'
import bundledSites from '@/data/sites.json'
import {
  siteHasVisibleDetails,
  siteKind,
  visibleGuideSections,
} from '@/data/stopFields'
import type {
  Assets,
  FoodFocus,
  Itinerary,
  ItineraryStop,
  Site,
  TicketSet,
} from '@/data/types'
import type { TripDocument } from '@/lib/contentSync'

let itinerary: Itinerary = bundledItinerary as Itinerary
let sites: Site[] = bundledSites as Site[]
let assets: Assets = bundledAssets as Assets
let siteById = new Map(sites.map((s) => [s.id, s]))

export function getItinerary(): Itinerary {
  return itinerary
}

export function getSites(): Site[] {
  return sites
}

export function getAssets(): Assets {
  return assets
}

export function applyTripDocument(doc: TripDocument): void {
  itinerary = doc.itinerary
  sites = doc.sites
  assets = doc.assets
  siteById = new Map(sites.map((s) => [s.id, s]))
}

export function resetToBundled(): void {
  applyTripDocument({
    itinerary: bundledItinerary as Itinerary,
    sites: bundledSites as Site[],
    assets: bundledAssets as Assets,
  })
}

export function getSite(siteId: string | null | undefined): Site | undefined {
  if (!siteId) return undefined
  return siteById.get(siteId)
}

export function getSiteForStop(stop: ItineraryStop): Site | undefined {
  return getSite(stop.siteId)
}

/** @deprecated prefer getSiteForStop — single site per event */
export function getGuidesForStop(stop: ItineraryStop): Site[] {
  const site = getSiteForStop(stop)
  return site ? [site] : []
}

export function getTicketSets(siteOrStop: Site | ItineraryStop | null | undefined): TicketSet[] {
  if (!siteOrStop) return []
  const site =
    'name' in siteOrStop && 'kind' in siteOrStop
      ? (siteOrStop as Site)
      : getSiteForStop(siteOrStop as ItineraryStop)
  if (site?.tickets?.length) return site.tickets
  const siteId = site?.id ?? (siteOrStop as ItineraryStop).siteId
  if (siteId && assets.tickets?.[siteId]?.length) {
    return [
      {
        id: siteId,
        label: 'Ticket',
        pages: assets.tickets[siteId],
      },
    ]
  }
  return []
}

export function getTicketPages(
  siteOrStopOrId: Site | ItineraryStop | string | null | undefined,
): string[] {
  if (!siteOrStopOrId) return []
  if (typeof siteOrStopOrId === 'string') {
    const site = getSite(siteOrStopOrId)
    if (site?.tickets?.length) {
      return site.tickets.flatMap((t) => t.pages)
    }
    return assets.tickets?.[siteOrStopOrId] ?? []
  }
  return getTicketSets(siteOrStopOrId).flatMap((t) => t.pages)
}

export function getMapPages(
  siteOrStopOrId: Site | ItineraryStop | string | null | undefined,
): string[] {
  if (!siteOrStopOrId) return []
  if (typeof siteOrStopOrId === 'string') {
    const site = getSite(siteOrStopOrId)
    if (site?.mapPages?.length) return site.mapPages
    const fromMaps = assets.maps?.[siteOrStopOrId]
    if (fromMaps?.length) return fromMaps
    return assets.sites[siteOrStopOrId]?.map ?? []
  }
  const site =
    'name' in siteOrStopOrId && 'kind' in siteOrStopOrId
      ? (siteOrStopOrId as Site)
      : getSiteForStop(siteOrStopOrId as ItineraryStop)
  if (site?.mapPages?.length) return site.mapPages
  if (site?.id) {
    const fromMaps = assets.maps?.[site.id]
    if (fromMaps?.length) return fromMaps
    return assets.sites[site.id]?.map ?? []
  }
  return []
}

export function getSitePhoto(siteId: string | null | undefined): string | undefined {
  if (!siteId) return undefined
  return assets.sites[siteId]?.photo
}

export function guideHasContent(site: Site | undefined): boolean {
  if (!site) return false
  return Boolean(
    site.logistics.length ||
      site.proTips.length ||
      site.history.length ||
      site.route.length ||
      (site.notes?.length ?? 0) > 0 ||
      (site.summary && site.summary.trim()) ||
      (site.tickets?.length ?? 0) > 0 ||
      (site.mapPages?.length ?? 0) > 0 ||
      (site.attachments?.length ?? 0) > 0,
  )
}

export function stopHasGuide(stop: ItineraryStop): boolean {
  return Boolean(getSiteForStop(stop))
}

/** Expand opens when there is anything worth a full-event read view. */
export function stopCanExpand(stop: ItineraryStop): boolean {
  const site = getSiteForStop(stop)
  if (siteHasVisibleDetails(site)) return true
  if (site?.mapsUrl || stopHasTickets(stop) || stopHasMap(stop)) return true
  if (site && guideHasContent(site)) return true
  return false
}

export function stopHasVisibleGuideContent(stop: ItineraryStop): boolean {
  const site = getSiteForStop(stop)
  if (!site) return false
  const sections = visibleGuideSections(siteKind(site))
  return sections.some((key) => (site[key]?.length ?? 0) > 0)
}

export function stopHasTickets(stop: ItineraryStop): boolean {
  return getTicketSets(stop).some((t) => t.pages.length > 0)
}

export function stopHasMap(stop: ItineraryStop): boolean {
  return getMapPages(stop).length > 0
}

export function foodHasContent(food: FoodFocus | null | undefined): boolean {
  return Boolean(food?.name?.trim())
}

export function stopTitle(stop: ItineraryStop): string {
  return getSiteForStop(stop)?.name || stop.siteId || stop.id
}
