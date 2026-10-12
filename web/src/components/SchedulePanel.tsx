import {
  AlarmClock,
  ChevronDown,
  ExternalLink,
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
import { useAppDialog } from '@/components/AppDialogs'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/RichText'
import {
  showGuideSection,
  stopDetailFields,
  stopHasVisibleDetails,
  type GuideSectionKey,
  visibleGuideSections,
} from '@/data/stopFields'
import type { DayMapLink, ItineraryDay, ItineraryStop } from '@/data/types'
import {
  getGuidesForStop,
  getMapPages,
  getTicketSets,
  stopCanExpand,
  stopHasMap,
  stopHasTickets,
  stopHasVisibleGuideContent,
} from '@/lib/data'
import { displayDuration } from '@/lib/duration'
import { cn } from '@/lib/utils'

const GUIDE_SECTION_LABELS: Record<GuideSectionKey, string> = {
  logistics: 'Logistics',
  proTips: 'Pro-Tips',
  history: 'History',
  route: 'The Route',
}

/** Prefer full Expand when guide text is long enough to benefit from a wider panel. */
function guideNeedsFullExpand(stop: ItineraryStop): boolean {
  const sections = visibleGuideSections(stop.kind)
  let chars = 0
  let items = 0
  for (const g of getGuidesForStop(stop)) {
    for (const key of sections) {
      for (const line of g[key] ?? []) {
        items += 1
        chars += line.length
      }
    }
  }
  return items >= 8 || chars >= 600
}

export type ViewerTarget =
  | { kind: 'ticket'; stop: ItineraryStop; ticketId?: string; title: string }
  | {
      kind: 'map'
      stop: ItineraryStop
      title: string
      /** Open a single page; omit for all pages. */
      pageIndex?: number
    }
  | {
      kind: 'expand'
      stop: ItineraryStop
      title: string
      edit?: boolean
    }

export type AdminAction = 'toggle-highlight' | 'toggle-timed' | 'delete-event'

function DayMapsBar({
  maps,
  adminMode,
  onChange,
}: {
  maps: DayMapLink[]
  adminMode: boolean
  onChange?: (next: DayMapLink[]) => void | Promise<void>
}) {
  const dialog = useAppDialog()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      await dialog.alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (!maps.length && !adminMode) return null

  return (
    <div className="rounded-xl bg-paper/80 p-3 ring-1 ring-line/70">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Day maps
        </p>
        {adminMode && onChange ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              void (async () => {
                const values = await dialog.prompt({
                  title: 'Add day map',
                  confirmLabel: 'Add',
                  fields: [
                    {
                      name: 'url',
                      label: 'URL',
                      placeholder: 'https://maps.app.goo.gl/...',
                      required: true,
                    },
                    {
                      name: 'label',
                      label: 'Label',
                      defaultValue: maps.length
                        ? `Map ${maps.length + 1}`
                        : 'Walking route',
                      required: true,
                    },
                  ],
                })
                if (!values?.url.trim()) return
                await run(() =>
                  onChange([
                    ...maps,
                    {
                      id: `map-${Date.now().toString(36)}`,
                      label: values.label.trim() || 'Day map',
                      url: values.url.trim(),
                    },
                  ]),
                )
              })()
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Map
          </Button>
        ) : null}
      </div>
      {maps.length ? (
        <ul className="mt-2 space-y-1.5">
          {maps.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg bg-paper-deep/60 px-2.5 py-2"
            >
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-sea hover:underline"
              >
                <MapPinned className="h-4 w-4 shrink-0" />
                <span className="truncate">{m.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </a>
              {adminMode && onChange ? (
                <span className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                    aria-label="Edit map"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        const values = await dialog.prompt({
                          title: 'Edit day map',
                          confirmLabel: 'Save',
                          fields: [
                            {
                              name: 'url',
                              label: 'URL',
                              defaultValue: m.url,
                              required: true,
                            },
                            {
                              name: 'label',
                              label: 'Label',
                              defaultValue: m.label,
                              required: true,
                            },
                          ],
                        })
                        if (!values) return
                        if (!values.url.trim()) {
                          await run(() =>
                            onChange(maps.filter((x) => x.id !== m.id)),
                          )
                          return
                        }
                        await run(() =>
                          onChange(
                            maps.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    url: values.url.trim(),
                                    label: values.label.trim() || 'Day map',
                                  }
                                : x,
                            ),
                          ),
                        )
                      })()
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-ink-soft hover:bg-paper hover:text-accent"
                    aria-label="Remove map"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        const ok = await dialog.confirm({
                          title: 'Remove map',
                          message: `Remove “${m.label}”?`,
                          confirmLabel: 'Remove',
                          destructive: true,
                        })
                        if (!ok) return
                        await run(() =>
                          onChange(maps.filter((x) => x.id !== m.id)),
                        )
                      })()
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">No day maps yet.</p>
      )}
    </div>
  )
}

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
  nextStop,
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
  nextStop?: ItineraryStop | null
  expanded: boolean
  adminMode: boolean
  onToggle: () => void
  onOpen: (target: ViewerTarget) => void
  onEdit?: () => void
  onAdminAction?: (action: AdminAction, stop: ItineraryStop, extra?: string) => void
  isHighlight: boolean
  hideOptionPill?: boolean
}) {
  const ticketSets = getTicketSets(stop).filter((t) => t.pages.length)
  const maps = getMapPages(stop)
  const hasTickets = stopHasTickets(stop)
  const hasMap = stopHasMap(stop)
  const guides = getGuidesForStop(stop)
  const guide = guides[0]
  const hasGuideContent = stopHasVisibleGuideContent(stop)
  const guideSections = visibleGuideSections(stop.kind)
  const showFullExpand = stopCanExpand(stop) && guideNeedsFullExpand(stop)
  const hasViewer =
    Boolean(stop.mapsUrl) || hasTickets || hasMap || showFullExpand
  const details = stopDetailFields(stop)
  const hasDetailFields = stopHasVisibleDetails(stop)
  const expandable =
    hasDetailFields || hasViewer || hasGuideContent || adminMode

  const [picker, setPicker] = useState<{
    title: string
    options: AttachmentPickOption[]
    onSelect: (id: string) => void
  } | null>(null)

  const openTickets = () => {
    if (ticketSets.length === 1) {
      const t = ticketSets[0]
      onOpen({
        kind: 'ticket',
        stop,
        ticketId: t.id,
        title: `${stop.title} · ${t.label}`,
      })
      return
    }
    setPicker({
      title: 'Which ticket?',
      options: ticketSets.map((t) => ({ id: t.id, label: t.label })),
      onSelect: (id) => {
        const t = ticketSets.find((x) => x.id === id)
        if (!t) return
        onOpen({
          kind: 'ticket',
          stop,
          ticketId: t.id,
          title: `${stop.title} · ${t.label}`,
        })
      },
    })
  }

  const openMap = () => {
    if (maps.length <= 1) {
      onOpen({ kind: 'map', stop, title: stop.title })
      return
    }
    setPicker({
      title: 'Which map page?',
      options: [
        ...maps.map((_, i) => ({
          id: String(i),
          label: `Page ${i + 1}`,
        })),
        { id: 'all', label: 'All pages' },
      ],
      onSelect: (id) => {
        if (id === 'all') {
          onOpen({ kind: 'map', stop, title: stop.title })
          return
        }
        const pageIndex = Number(id)
        onOpen({
          kind: 'map',
          stop,
          title: `${stop.title} · page ${pageIndex + 1}`,
          pageIndex,
        })
      },
    })
  }

  const durationLabel = displayDuration(stop, nextStop)

  const header = (
    <>
      <div className="w-14 shrink-0 pt-0.5">
        <div className="font-mono text-sm font-bold text-accent">{stop.time}</div>
        {durationLabel ? (
          <div className="text-[11px] text-ink-soft">{durationLabel}</div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {stop.optionLabel && !hideOptionPill ? (
          <div className="mb-1 inline-flex rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {stop.optionLabel}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {isHighlight ? (
            <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
          ) : null}
          <div className="font-semibold leading-snug text-ink">{stop.title}</div>
          {stop.timedEntry ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              <AlarmClock className="h-3 w-3" />
              Timed
            </span>
          ) : null}
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
                  {details.hours ? (
                    <DetailRow label="Hours" value={details.hours} />
                  ) : null}
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
                    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                      <dt className="font-semibold text-ink">Transit</dt>
                      <dd className="text-ink-soft">
                        <RichText value={details.transit} />
                      </dd>
                    </div>
                  ) : null}
                  {details.vibe ? (
                    <DetailRow label="Vibe" value={details.vibe} />
                  ) : null}
                  {details.mustTry ? (
                    <DetailRow label="Must try" value={details.mustTry} />
                  ) : null}
                  {details.notes ? (
                    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                      <dt className="font-semibold text-ink">Notes</dt>
                      <dd className="text-ink-soft">
                        <RichText value={details.notes} />
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {hasGuideContent && guide ? (
                <div className="space-y-4">
                  {guideSections.map((key) => {
                    if (!showGuideSection(stop.kind, key)) return null
                    const items = guide[key] ?? []
                    if (!items.length) return null
                    return (
                      <section key={key}>
                        <h4 className="mb-1.5 font-display text-base font-bold text-ink">
                          {GUIDE_SECTION_LABELS[key]}
                        </h4>
                        <ul className="space-y-1.5">
                          {items.map((item, i) => (
                            <li
                              key={`${key}-${i}`}
                              className="relative rounded-lg bg-paper-deep/70 px-3 py-2 pl-4 text-sm leading-relaxed text-ink-soft before:absolute before:left-1.5 before:top-3 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent"
                            >
                              <RichText value={item} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              ) : null}

              {hasViewer ||
              stop.mapsUrl ||
              hasTickets ||
              hasMap ||
              showFullExpand ||
              adminMode ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {stop.mapsUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={stop.mapsUrl} target="_blank" rel="noreferrer">
                        <MapPinned className="h-3.5 w-3.5" /> Maps
                      </a>
                    </Button>
                  ) : null}
                  {ticketSets.length === 1 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTickets()}
                    >
                      <Ticket className="h-3.5 w-3.5" /> {ticketSets[0].label}
                    </Button>
                  ) : ticketSets.length > 1 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTickets()}
                    >
                      <Ticket className="h-3.5 w-3.5" /> Ticket
                      <span className="text-[10px] opacity-70">
                        · {ticketSets.length}
                      </span>
                    </Button>
                  ) : null}
                  {hasMap ? (
                    <Button variant="outline" size="sm" onClick={() => openMap()}>
                      <MapIcon className="h-3.5 w-3.5" /> Map
                      {maps.length > 1 ? (
                        <span className="text-[10px] opacity-70">
                          · {maps.length}
                        </span>
                      ) : null}
                    </Button>
                  ) : null}
                  {showFullExpand ? (
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAdminAction('toggle-timed', stop)}
                      >
                        <AlarmClock
                          className={cn(
                            'h-3.5 w-3.5',
                            stop.timedEntry && 'text-accent',
                          )}
                        />
                        {stop.timedEntry ? 'Untimed' : 'Timed'}
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

      <AttachmentPicker
        open={Boolean(picker)}
        onOpenChange={(o) => !o && setPicker(null)}
        title={picker?.title ?? ''}
        options={picker?.options ?? []}
        onSelect={(id) => picker?.onSelect(id)}
      />
    </article>
  )
}

export function SchedulePanel({
  day,
  adminMode = false,
  onOpen,
  onAdminAction,
  onAddEvent,
  onSetDayMaps,
}: {
  day: ItineraryDay
  adminMode?: boolean
  onOpen: (target: ViewerTarget) => void
  onAdminAction?: (action: AdminAction, stop: ItineraryStop, extra?: string) => void
  onAddEvent?: () => void
  onSetDayMaps?: (maps: DayMapLink[]) => void | Promise<void>
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

  const timelineStops = useMemo(
    () =>
      timeline
        .filter((item): item is { type: 'stop'; stop: ItineraryStop } =>
          item.type === 'stop',
        )
        .map((item) => item.stop),
    [timeline],
  )

  const dayMaps = day.mapsUrls ?? []

  return (
    <div className="space-y-2">
      <DayMapsBar
        maps={dayMaps}
        adminMode={adminMode}
        onChange={onSetDayMaps}
      />
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
        const stopIndex = timelineStops.findIndex((s) => s.id === item.stop.id)
        const nextStop =
          stopIndex >= 0 ? timelineStops[stopIndex + 1] ?? null : null
        return (
          <StopCard
            key={item.stop.id}
            stop={item.stop}
            nextStop={nextStop}
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
