import type { ItineraryStop } from '@/data/types'
import { parseTimeMinutes } from '@/lib/duration'

export type OptionChoice = { group: string; label: string; primary: boolean }

export type OptionWindow = {
  group: string | null
  optionStartMinutes: number | null
  convergeMinutes: number | null
}

/** Prefer explicit order, then "Option N" numbers, then primary, then label. */
export function compareOptionLabels(
  a: string,
  b: string,
  order?: string[] | null,
  primaryA?: boolean,
  primaryB?: boolean,
): number {
  if (order?.length) {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    if (ia >= 0 && ib >= 0 && ia !== ib) return ia - ib
    if (ia >= 0 && ib < 0) return -1
    if (ib >= 0 && ia < 0) return 1
  }
  const numA = a.match(/option\s*(\d+)/i)?.[1]
  const numB = b.match(/option\s*(\d+)/i)?.[1]
  if (numA != null && numB != null) {
    const diff = Number(numA) - Number(numB)
    if (diff !== 0) return diff
  }
  if (primaryA !== primaryB) {
    if (primaryA) return -1
    if (primaryB) return 1
  }
  return a.localeCompare(b)
}

function sortChoices(
  list: OptionChoice[],
  optionOrder?: string[] | null,
): OptionChoice[] {
  return [...list].sort((a, b) =>
    compareOptionLabels(
      a.label,
      b.label,
      optionOrder,
      a.primary,
      b.primary,
    ),
  )
}

/** Unique (group, label) pairs + primary flag per group, sorted for display. */
export function collectOptionChoices(
  stops: ItineraryStop[],
  optionOrder?: string[] | null,
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
  for (const [group, list] of byGroup) {
    byGroup.set(group, sortChoices(list, optionOrder))
  }
  return byGroup
}

export function defaultLabelForGroup(choices: OptionChoice[]): string {
  return choices.find((c) => c.primary)?.label ?? choices[0]?.label ?? ''
}

export function flatOptionChoices(
  stops: ItineraryStop[],
  optionOrder?: string[] | null,
): OptionChoice[] {
  const out: OptionChoice[] = []
  for (const choices of collectOptionChoices(stops, optionOrder).values()) {
    out.push(...choices)
  }
  return out
}

/** Current display order of option labels (explicit or inferred). */
export function resolvedOptionOrder(
  stops: ItineraryStop[],
  optionOrder?: string[] | null,
): string[] {
  return flatOptionChoices(stops, optionOrder).map((c) => c.label)
}

export function moveOptionInOrder(
  order: string[],
  label: string,
  direction: -1 | 1,
): string[] {
  const i = order.indexOf(label)
  if (i < 0) return order
  const j = i + direction
  if (j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
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
  optionOrder?: string[] | null,
): boolean {
  const choices = flatOptionChoices(dayStops, optionOrder)
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
  return planConvergeAt(stops, fromStop, () => '')?.clear ?? []
}

export type ConvergeRestore = {
  stop: ItineraryStop
  group: string
  label: string
  primary: boolean
}

export type ConvergePlan = {
  group: string
  /** Optioned stops at/after the converge point to make shared. */
  clear: ItineraryStop[]
  /**
   * Shared stops between the fork and converge that should rejoin a branch
   * (matched by title containing an option label, e.g. "Boys" / "Hanna").
   */
  restore: ConvergeRestore[]
  /** Shared stops before converge that could not be matched to a branch. */
  unresolved: ItineraryStop[]
}

function matchOptionLabel(
  title: string,
  labels: string[],
): string | null {
  const hay = title.toLowerCase()
  let best: string | null = null
  for (const label of labels) {
    const needle = label.trim().toLowerCase()
    if (!needle) continue
    if (!hay.includes(needle)) continue
    if (!best || needle.length > best.length) best = label
  }
  return best
}

/**
 * Plan moving the converge banner to `fromStop`.
 * Clears branch assignment from that stop onward, and re-assigns any shared
 * stops stuck between the fork and this point back onto matching option labels.
 */
export function planConvergeAt(
  stops: ItineraryStop[],
  fromStop: ItineraryStop,
  titleOf: (stop: ItineraryStop) => string,
): ConvergePlan | null {
  const idx = stops.findIndex((s) => s.id === fromStop.id)
  if (idx < 0) return null

  const firstOptionIdx = stops.findIndex(
    (s) => s.optionGroup && s.optionLabel,
  )
  if (firstOptionIdx < 0 || idx < firstOptionIdx) return null

  const group =
    fromStop.optionGroup ||
    stops.slice(0, idx + 1).find((s) => s.optionGroup)?.optionGroup ||
    stops.slice(idx).find((s) => s.optionGroup)?.optionGroup ||
    stops[firstOptionIdx]?.optionGroup ||
    null
  if (!group) return null

  const labels = [
    ...new Set(
      stops
        .filter((s) => s.optionGroup === group && s.optionLabel)
        .map((s) => s.optionLabel as string),
    ),
  ]
  if (!labels.length) return null

  const clear = stops
    .slice(idx)
    .filter((s) => s.id === fromStop.id || s.optionGroup === group)
    .filter((s) => Boolean(s.optionGroup && s.optionLabel) || s.id === fromStop.id)

  const restore: ConvergeRestore[] = []
  const unresolved: ItineraryStop[] = []
  for (const stop of stops.slice(firstOptionIdx, idx)) {
    if (stop.optionGroup && stop.optionLabel) continue
    const label = matchOptionLabel(titleOf(stop), labels)
    if (!label) {
      unresolved.push(stop)
      continue
    }
    restore.push({
      stop,
      group,
      label,
      primary: isPrimaryLabelForGroup(stops, group, label),
    })
  }

  // fromStop itself should be shared — don't restore it if somehow matched
  const clearIds = new Set(clear.map((s) => s.id))
  return {
    group,
    clear: clear.filter((s) => s.optionGroup && s.optionLabel),
    restore: restore.filter((r) => !clearIds.has(r.stop.id)),
    unresolved,
  }
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
