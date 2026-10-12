import type { ItineraryStop } from '@/data/types'
import { showDuration } from '@/data/stopFields'

/** Parse "HH:MM" / "H:MM" to minutes from midnight. */
export function parseTimeMinutes(time: string): number | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Format a positive minute span like "4h", "4h 30m", or "45m". */
export function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Minutes from `fromTime` to `toTime`.
 * If to ≤ from (overnight continuation on the same day list), wrap +24h.
 */
export function spanMinutes(fromTime: string, toTime: string): number | null {
  const from = parseTimeMinutes(fromTime)
  const to = parseTimeMinutes(toTime)
  if (from == null || to == null) return null
  let diff = to - from
  if (diff <= 0) diff += 24 * 60
  return diff
}

/** Next stop in list order after `stopId` (timeline / day order). */
export function nextStopInSequence(
  stops: ItineraryStop[],
  stopId: string,
): ItineraryStop | null {
  const idx = stops.findIndex((s) => s.id === stopId)
  if (idx < 0 || idx >= stops.length - 1) return null
  return stops[idx + 1] ?? null
}

/**
 * Duration shown in the timeline:
 * - transit with a stored override → use override
 * - otherwise → span from this start to the next sequential start
 */
export function displayDuration(
  stop: ItineraryStop,
  next: ItineraryStop | null | undefined,
): string {
  if (showDuration(stop.kind) && stop.duration?.trim()) {
    return stop.duration.trim()
  }
  if (!next) return ''
  const mins = spanMinutes(stop.time, next.time)
  if (mins == null) return ''
  return formatDurationMinutes(mins)
}
