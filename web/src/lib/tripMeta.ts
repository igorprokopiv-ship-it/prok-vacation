export type TripLocation = {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  notes?: string | null
}

export type TripMetaExtras = {
  vacation_notes?: string | null
  locations?: TripLocation[]
}

export function formatLocationLine(loc: TripLocation): string {
  const dates = [loc.start_date, loc.end_date].filter(Boolean).join(' → ')
  return dates ? `${loc.name} (${dates})` : loc.name
}
