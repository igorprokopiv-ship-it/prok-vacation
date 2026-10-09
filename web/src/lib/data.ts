import bundledAssets from '@/data/assets.json'
import bundledItinerary from '@/data/itinerary.json'
import bundledSites from '@/data/sites.json'
import {
  showDuration,
  stopHasVisibleDetails,
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

export function getGuidesForStop(stop: ItineraryStop): Site[] {
  const ids =
    stop.guideIds?.length
      ? stop.guideIds
      : stop.siteId
        ? [stop.siteId]
        : []
  return ids.map((id) => siteById.get(id)).filter((s): s is Site => Boolean(s))
}

export function getTicketSets(stop: ItineraryStop): TicketSet[] {
  if (stop.tickets?.length) return stop.tickets
  // Legacy fallback: siteId-keyed assets
  if (stop.siteId && assets.tickets?.[stop.siteId]?.length) {
    return [
      {
        id: stop.siteId,
        label: 'Ticket',
        pages: assets.tickets[stop.siteId],
      },
    ]
  }
  return []
}

export function getTicketPages(stopOrSiteId: ItineraryStop | string | null | undefined): string[] {
  if (!stopOrSiteId) return []
  if (typeof stopOrSiteId === 'string') {
    return assets.tickets?.[stopOrSiteId] ?? []
  }
  return getTicketSets(stopOrSiteId).flatMap((t) => t.pages)
}

export function getMapPages(stopOrSiteId: ItineraryStop | string | null | undefined): string[] {
  if (!stopOrSiteId) return []
  if (typeof stopOrSiteId === 'string') {
    const fromMaps = assets.maps?.[stopOrSiteId]
    if (fromMaps?.length) return fromMaps
    return assets.sites[stopOrSiteId]?.map ?? []
  }
  if (stopOrSiteId.mapPages?.length) return stopOrSiteId.mapPages
  if (stopOrSiteId.siteId) {
    const fromMaps = assets.maps?.[stopOrSiteId.siteId]
    if (fromMaps?.length) return fromMaps
    return assets.sites[stopOrSiteId.siteId]?.map ?? []
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
      site.route.length,
  )
}

export function stopHasGuide(stop: ItineraryStop): boolean {
  return getGuidesForStop(stop).length > 0
}

/** Expand opens when there is anything worth a full-event read view. */
export function stopCanExpand(stop: ItineraryStop): boolean {
  if (stopHasVisibleDetails(stop)) return true
  if (stop.mapsUrl || stopHasTickets(stop) || stopHasMap(stop)) return true
  if (getGuidesForStop(stop).length > 0) return true
  if (showDuration(stop.kind) && stop.duration) return true
  return false
}

export function stopHasVisibleGuideContent(stop: ItineraryStop): boolean {
  const sections = visibleGuideSections(stop.kind)
  return getGuidesForStop(stop).some((g) =>
    sections.some((key) => (g[key]?.length ?? 0) > 0),
  )
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
