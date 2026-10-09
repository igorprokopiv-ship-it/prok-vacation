import {
  ChevronDown,
  Maximize2,
  Map as MapIcon,
  MapPinned,
  Pencil,
  Plus,
  Star,
  Ticket,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  showDuration,
  stopDetailFields,
  stopHasVisibleDetails,
} from '@/data/stopFields'
import type { ItineraryDay, ItineraryStop } from '@/data/types'
import {
  getMapPages,
  getTicketSets,
  stopCanExpand,
  stopHasMap,
  stopHasTickets,
} from '@/lib/data'
import { cn } from '@/lib/utils'

export type ViewerTarget =
  | { kind: 'ticket'; stop: ItineraryStop; ticketId?: string; title: string }
  | { kind: 'map'; stop: ItineraryStop; title: string }
  | {
      kind: 'expand'
      stop: ItineraryStop
      title: string
      edit?: boolean
    }

export type AdminAction = 'toggle-highlight' | 'delete-event'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-soft break-words">{value}</dd>
    </div>
  )
}

type OptionChoice = { group: string; label: string; primary: boolean }

function collectOptionChoices(stops: ItineraryStop[]): Map<string, OptionChoice[]> {
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

function defaultLabelForGroup(choices: OptionChoice[]): string {
  return choices.find((c) => c.primary)?.label ?? choices[0]?.label ?? ''
}

type TimelineItem =
  | { type: 'option-toggle'; group: string; choices: OptionChoice[] }
  | { type: 'option-banner'; key: string; label: string }
  | { type: 'converge'; key: string }
  | { type: 'stop'; stop: ItineraryStop }

function buildTimeline(
  stops: ItineraryStop[],
  selectedByGroup: Record<string, string>,
): TimelineItem[] {
  const choicesByGroup = collectOptionChoices(stops)
  const items: TimelineItem[] = []
  let lastGroup: string | null = null
  let lastLabel: string | null = null
  let shownToggleFor = new Set<string>()
  let inOptionBlock = false

  for (const stop of stops) {
    const group = stop.optionGroup
    const label = stop.optionLabel

    if (!group || !label) {
      if (inOptionBlock) {
        items.push({ type: 'converge', key: `converge-${lastGroup ?? 'x'}` })
        inOptionBlock = false
      }
      lastGroup = null
      lastLabel = null
      items.push({ type: 'stop', stop })
      continue
    }

    const choices = choicesByGroup.get(group) ?? []
    const selected = selectedByGroup[group] ?? defaultLabelForGroup(choices)
    if (label !== selected) {
      // Skip non-selected branch; still track that we entered a fork
      if (!shownToggleFor.has(group) && choices.length > 1) {
        items.push({ type: 'option-toggle', group, choices })
        shownToggleFor.add(group)
        items.push({
          type: 'option-banner',
          key: `${group}-${selected}`,
          label: selected,
        })
        inOptionBlock = true
        lastGroup = group
        lastLabel = selected
      } else if (!shownToggleFor.has(group) && choices.length === 1) {
        items.push({
          type: 'option-banner',
          key: `${group}-${label}`,
          label,
        })
        shownToggleFor.add(group)
        inOptionBlock = true
        lastGroup = group
        lastLabel = label
      }
      continue
    }

    if (!shownToggleFor.has(group)) {
      if (choices.length > 1) {
        items.push({ type: 'option-toggle', group, choices })
      }
      items.push({
        type: 'option-banner',
        key: `${group}-${label}`,
        label,
      })
      shownToggleFor.add(group)
      inOptionBlock = true
    } else if (label !== lastLabel || group !== lastGroup) {
      items.push({
        type: 'option-banner',
        key: `${group}-${label}`,
        label,
      })
    }

    lastGroup = group
    lastLabel = label
    inOptionBlock = true
    items.push({ type: 'stop', stop })
  }

  return items
}

function StopCard({
  stop,
  expanded,
  adminMode,
  onToggle,
  onOpen,
  onEdit,
  onAdminAction,
  isHighlight,
  hideOptionPill,
}: {
  stop: ItineraryStop
  expanded: boolean
  adminMode: boolean
  onToggle: () => void
  onOpen: (target: ViewerTarget) => void
  onEdit?: () => void
  onAdminAction?: (action: AdminAction, stop: ItineraryStop, extra?: string) => void
  isHighlight: boolean
  hideOptionPill?: boolean
}) {
  const ticketSets = getTicketSets(stop)
  const maps = getMapPages(stop)
  const hasTickets = stopHasTickets(stop)
  const hasMap = stopHasMap(stop)
  const canExpand = stopCanExpand(stop)
  const hasViewer =
    Boolean(stop.mapsUrl) || hasTickets || hasMap || canExpand
  const details = stopDetailFields(stop)
  const hasDetailFields = stopHasVisibleDetails(stop)
  const expandable = hasDetailFields || hasViewer || adminMode

  const header = (
    <>
      <div className="w-14 shrink-0 pt-0.5">
        <div className="font-mono text-sm font-bold text-accent">{stop.time}</div>
        {showDuration(stop.kind) && stop.duration ? (
          <div className="text-[11px] text-ink-soft">{stop.duration}</div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {stop.optionLabel && !hideOptionPill ? (
          <div className="mb-1 inline-flex rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {stop.optionLabel}
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          {isHighlight ? (
            <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
          ) : null}
          <div className="font-semibold leading-snug text-ink">{stop.title}</div>
        </div>
        {stop.kind && stop.kind !== 'attraction' ? (
          <div className="mt-0.5 text-[11px] tracking-wide text-ink-soft">
            {stop.kind.charAt(0).toUpperCase() + stop.kind.slice(1)}
          </div>
        ) : null}
      </div>
    </>
  )

  return (
    <article className="overflow-hidden rounded-xl bg-paper/90 ring-1 ring-line/80">
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-3 px-3 py-3 text-left"
        >
          {header}
          <ChevronDown
            className={cn(
              'mt-1 h-5 w-5 shrink-0 text-ink-soft transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>
      ) : (
        <div className="flex w-full items-start gap-3 px-3 py-3">{header}</div>
      )}

      {expandable ? (
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 border-t border-line/70 px-3 py-3">
              {hasDetailFields ? (
                <dl className="space-y-2">
                  {details.cost ? (
                    <DetailRow label="Cost" value={details.cost} />
                  ) : null}
                  {details.bookingRef ? (
                    <DetailRow label="Booking" value={details.bookingRef} />
                  ) : null}
                  {details.bags ? (
                    <DetailRow label="Bags" value={details.bags} />
                  ) : null}
                  {details.transit ? (
                    <DetailRow label="Transit" value={details.transit} />
                  ) : null}
                  {details.notes ? (
                    <DetailRow label="Notes" value={details.notes} />
                  ) : null}
                  {stop.mapsUrl ? (
                    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                      <dt className="font-semibold text-ink">Maps</dt>
                      <dd className="text-ink-soft break-all">
                        <a
                          href={stop.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-sea underline decoration-sea/40 underline-offset-2"
                        >
                          Open in Google Maps
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {hasViewer || adminMode ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {stop.mapsUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={stop.mapsUrl} target="_blank" rel="noreferrer">
                        <MapPinned className="h-3.5 w-3.5" /> Maps
                      </a>
                    </Button>
                  ) : null}
                  {ticketSets.map((t) =>
                    t.pages.length ? (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpen({
                            kind: 'ticket',
                            stop,
                            ticketId: t.id,
                            title: `${stop.title} · ${t.label}`,
                          })
                        }
                      >
                        <Ticket className="h-3.5 w-3.5" /> {t.label}
                      </Button>
                    ) : null,
                  )}
                  {hasMap ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onOpen({ kind: 'map', stop, title: stop.title })
                      }
                    >
                      <MapIcon className="h-3.5 w-3.5" /> Map
                      {maps.length > 1 ? (
                        <span className="text-[10px] opacity-70">
                          · {maps.length}
                        </span>
                      ) : null}
                    </Button>
                  ) : null}
                  {canExpand ? (
                    <Button
                      variant="sea"
                      size="sm"
                      onClick={() =>
                        onOpen({ kind: 'expand', stop, title: stop.title })
                      }
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> Expand
                    </Button>
                  ) : null}
                  {adminMode && onAdminAction ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAdminAction('toggle-highlight', stop)}
                      >
                        <Star
                          className={cn(
                            'h-3.5 w-3.5',
                            isHighlight && 'fill-accent text-accent',
                          )}
                        />
                        {isHighlight ? 'Unhighlight' : 'Highlight'}
                      </Button>
                      {onEdit ? (
                        <Button variant="outline" size="sm" onClick={onEdit}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAdminAction('delete-event', stop)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function SchedulePanel({
  day,
  adminMode = false,
  onOpen,
  onAdminAction,
  onAddEvent,
}: {
  day: ItineraryDay
  adminMode?: boolean
  onOpen: (target: ViewerTarget) => void
  onAdminAction?: (action: AdminAction, stop: ItineraryStop, extra?: string) => void
  onAddEvent?: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const choicesByGroup = useMemo(
    () => collectOptionChoices(day.stops),
    [day.stops],
  )
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string>>({})

  useEffect(() => {
    setSelectedByGroup((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [group, choices] of choicesByGroup) {
        if (!next[group] || !choices.some((c) => c.label === next[group])) {
          next[group] = defaultLabelForGroup(choices)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [choicesByGroup, day.id])

  const highlightIds = useMemo(
    () => new Set(day.highlights.map((h) => h.stopId)),
    [day.highlights],
  )

  const timeline = useMemo(
    () => buildTimeline(day.stops, selectedByGroup),
    [day.stops, selectedByGroup],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2 px-1">
        <p className="text-sm text-ink-soft">
          Full timeline — tap a row for details
          {adminMode ? ' (admin: edit, options, attachments)' : ''}.
        </p>
        {adminMode && onAddEvent ? (
          <Button variant="outline" size="sm" onClick={onAddEvent}>
            <Plus className="h-3.5 w-3.5" /> Event
          </Button>
        ) : null}
      </div>
      {timeline.map((item) => {
        if (item.type === 'option-toggle') {
          const selected =
            selectedByGroup[item.group] ?? defaultLabelForGroup(item.choices)
          return (
            <div
              key={`toggle-${item.group}`}
              className="flex flex-wrap gap-2 rounded-xl bg-paper-deep/50 p-2"
            >
              {item.choices.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() =>
                    setSelectedByGroup((s) => ({ ...s, [item.group]: c.label }))
                  }
                  className={cn(
                    'min-h-10 flex-1 rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
                    selected === c.label
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-paper text-ink ring-1 ring-line hover:bg-paper-deep',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )
        }
        if (item.type === 'option-banner') {
          return (
            <div
              key={item.key}
              className="sticky top-[7.5rem] z-[5] -mx-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
            >
              {item.label}
            </div>
          )
        }
        if (item.type === 'converge') {
          return (
            <div
              key={item.key}
              className="sticky top-[7.5rem] z-[5] -mx-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-paper shadow-sm"
            >
              Converge — everyone together
            </div>
          )
        }
        return (
          <StopCard
            key={item.stop.id}
            stop={item.stop}
            adminMode={adminMode}
            expanded={expandedId === item.stop.id}
            isHighlight={highlightIds.has(item.stop.id)}
            hideOptionPill
            onToggle={() =>
              setExpandedId((id) => (id === item.stop.id ? null : item.stop.id))
            }
            onOpen={onOpen}
            onAdminAction={onAdminAction}
            onEdit={
              adminMode
                ? () =>
                    onOpen({
                      kind: 'expand',
                      stop: item.stop,
                      title: item.stop.title,
                      edit: true,
                    })
                : undefined
            }
          />
        )
      })}
    </div>
  )
}
