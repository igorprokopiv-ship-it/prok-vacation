import bundledAssets from '@/data/assets.json'
import bundledItinerary from '@/data/itinerary.json'
import bundledSites from '@/data/sites.json'
import type { Assets, Itinerary, ItineraryStop, Site } from '@/data/types'
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

export function getTicketPages(siteId: string | null | undefined): string[] {
  if (!siteId) return []
  return assets.tickets[siteId] ?? []
}

export function getMapPages(siteId: string | null | undefined): string[] {
  if (!siteId) return []
  const fromMaps = assets.maps[siteId]
  if (fromMaps?.length) return fromMaps
  return assets.sites[siteId]?.map ?? []
}

export function getSitePhoto(siteId: string | null | undefined): string | undefined {
  if (!siteId) return undefined
  return assets.sites[siteId]?.photo
}

export function stopHasGuide(stop: ItineraryStop): boolean {
  const site = getSite(stop.siteId)
  if (!site) return false
  return Boolean(
    site.logistics.length ||
      site.proTips.length ||
      site.history.length ||
      site.route.length,
  )
}
