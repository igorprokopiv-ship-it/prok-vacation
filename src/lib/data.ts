import assetsJson from '@/data/assets.json'
import itineraryJson from '@/data/itinerary.json'
import sitesJson from '@/data/sites.json'
import type { Assets, Itinerary, ItineraryStop, Site } from '@/data/types'

export const itinerary = itineraryJson as Itinerary
export const sites = sitesJson as Site[]
export const assets = assetsJson as Assets

const siteById = new Map(sites.map((s) => [s.id, s]))

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
