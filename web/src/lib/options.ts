import type { ItineraryStop } from '@/data/types'
import { parseTimeMinutes } from '@/lib/duration'

export type OptionChoice = { group: string; label: string; primary: boolean }

export type OptionWindow = {
  group: string | null
  optionStartMinutes: number | null
  convergeMinutes: number | null
}

/** Unique (group, label) pairs + primary flag per group. */
export function collectOptionChoices(
  stops: ItineraryStop[],
): Map<string, OptionChoice[]> {
  const byGroup = new Map<string, OptionChoice[]>()
  for (const stop of stops) {
    if (!stop.optionGroup || !stop.optionLabel) continue
    const list = byGroup.get(stop.optionGroup) ?? []
    if (!list.some((c) => c.label === stop.optionLabel)) {
      list.push({
        group: stop.optionGroup,
        label: stop.optionLabel,
        primary: Boolean(stop.primary),
      })
    } else if (stop.primary) {
      const existing = list.find((c) => c.label === stop.optionLabel)
      if (existing) existing.primary = true
    }
    byGroup.set(stop.optionGroup, list)
  }
  return byGroup
}

export function defaultLabelForGroup(choices: OptionChoice[]): string {
  return choices.find((c) => c.primary)?.label ?? choices[0]?.label ?? ''
}

export function flatOptionChoices(stops: ItineraryStop[]): OptionChoice[] {
  const out: OptionChoice[] = []
  for (const choices of collectOptionChoices(stops).values()) {
    out.push(...choices)
  }
  return out
}

/**
 * Option start = earliest time among optioned stops.
 * Converge = earliest shared stop after at least one optioned stop (array order).
 */
export function optionWindow(stops: ItineraryStop[]): OptionWindow {
  let optionStartMinutes: number | null = null
  let group: string | null = null
  for (const stop of stops) {
    if (!stop.optionGroup || !stop.optionLabel) continue
    const mins = parseTimeMinutes(stop.time)
    if (mins == null) continue
    if (optionStartMinutes == null || mins < optionStartMinutes) {
      optionStartMinutes = mins
      group = stop.optionGroup
    }
  }

  let convergeMinutes: number | null = null
  let seenOptioned = false
  for (const stop of stops) {
    if (stop.optionGroup && stop.optionLabel) {
      seenOptioned = true
      continue
    }
    if (!seenOptioned) continue
    const mins = parseTimeMinutes(stop.time)
    if (mins == null) continue
    convergeMinutes = mins
    break
  }

  return { group, optionStartMinutes, convergeMinutes }
}

/** True when stop time is in [optionStart, converge). Orphan optioned stops also qualify. */
export function stopInOptionWindow(
  stop: ItineraryStop,
  window: OptionWindow,
): boolean {
  if (window.optionStartMinutes == null) return false
  const mins = parseTimeMinutes(stop.time)
  if (mins == null) return Boolean(stop.optionLabel)
  if (mins < window.optionStartMinutes) return false
  if (window.convergeMinutes != null && mins >= window.convergeMinutes) {
    return false
  }
  return true
}

export function shouldShowBranchPicker(
  stop: ItineraryStop,
  dayStops: ItineraryStop[],
): boolean {
  const choices = flatOptionChoices(dayStops)
  if (!choices.length) return false
  if (stop.optionLabel) return true
  return stopInOptionWindow(stop, optionWindow(dayStops))
}

export function stopsWithOptionLabel(
  stops: ItineraryStop[],
  group: string,
  label: string,
): ItineraryStop[] {
  return stops.filter(
    (s) => s.optionGroup === group && s.optionLabel === label,
  )
}

/**
 * Stops to clear when marking converge at `fromStop`:
 * the stop itself plus every later stop in the same option group.
 * Only valid at/after the first optioned stop on the day.
 */
export function stopsToClearForConverge(
  stops: ItineraryStop[],
  fromStop: ItineraryStop,
): ItineraryStop[] {
  const idx = stops.findIndex((s) => s.id === fromStop.id)
  if (idx < 0) return []

  const firstOptionIdx = stops.findIndex(
    (s) => s.optionGroup && s.optionLabel,
  )
  if (firstOptionIdx < 0 || idx < firstOptionIdx) return []

  const group =
    fromStop.optionGroup ||
    stops.slice(idx).find((s) => s.optionGroup)?.optionGroup ||
    stops[firstOptionIdx]?.optionGroup ||
    null
  if (!group) return []

  return stops
    .slice(idx)
    .filter((s) => s.id === fromStop.id || s.optionGroup === group)
}

export function dayOptionGroupId(
  stops: ItineraryStop[],
  dayId: string,
): string {
  const existing = stops.find((s) => s.optionGroup)?.optionGroup
  return existing || `${dayId}-options`
}

export function isPrimaryLabelForGroup(
  stops: ItineraryStop[],
  group: string,
  label: string,
): boolean {
  const existingInGroup = stops.filter((s) => s.optionGroup === group)
  const labelsInGroup = [
    ...new Set(
      existingInGroup
        .map((s) => s.optionLabel)
        .filter((l): l is string => Boolean(l)),
    ),
  ]
  return (
    !labelsInGroup.length ||
    labelsInGroup[0] === label ||
    label.toLowerCase().includes('option 1')
  )
}
