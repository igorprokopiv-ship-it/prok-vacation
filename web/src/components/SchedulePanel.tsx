import {
  AlarmClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  siteDetailFields,
  siteHasVisibleDetails,
  siteKind,
  type GuideSectionKey,
  visibleGuideSections,
} from '@/data/stopFields'
import type { DayMapLink, ItineraryDay, ItineraryStop } from '@/data/types'
import {
  getMapPages,
  getSiteForStop,
  getTicketSets,
  stopCanExpand,
  stopHasMap,
  stopHasPhoto,
  stopHasTickets,
  stopHasVisibleGuideContent,
  stopTitle,
} from '@/lib/data'
import { displayDuration } from '@/lib/duration'
import {
  collectOptionChoices,
  defaultLabelForGroup,
  moveOptionInOrder,
  resolvedOptionOrder,
  type OptionChoice,
} from '@/lib/options'
import { cn } from '@/lib/utils'

const SITE_SECTION_LABELS: Record<GuideSectionKey, string> = {
  notes: 'Notes',
  logistics: 'Logistics',
  proTips: 'Pro-Tips',
  history: 'History',
  route: 'The Route',
}

/** Prefer full Expand when guide text is long, or when a site photo is set. */
function siteNeedsFullExpand(stop: ItineraryStop): boolean {
  if (stopHasPhoto(stop)) return true
  const site = getSiteForStop(stop)
  if (!site) return false
  const sections = visibleGuideSections(siteKind(site))
  let chars = 0
  let items = 0
  for (const key of sections) {
    for (const line of site[key] ?? []) {
      items += 1
      chars += line.length
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

export type AdminAction =
  | 'toggle-highlight'
  | 'toggle-timed'
  | 'delete-event'
  | 'mark-converge'

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

type TimelineItem =
  | { type: 'option-toggle'; group: string; choices: OptionChoice[] }
  | { type: 'option-banner'; key: string; label: string }
  | { type: 'converge'; key: string }
  | { type: 'stop'; stop: ItineraryStop }

function buildTimeline(
  stops: ItineraryStop[],
  selectedByGroup: Record<string, string>,
  optionOrder?: string[] | null,
): TimelineItem[] {
  const choicesByGroup = collectOptionChoices(stops, optionOrder)
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
      if (!shownToggleFor.has(group) && choices.length >= 1) {
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
      }
      continue
    }

    if (!shownToggleFor.has(group)) {
      if (choices.length >= 1) {
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
  const site = getSiteForStop(stop)
  const title = stopTitle(stop)
  const kind = siteKind(site)
  const ticketSets = getTicketSets(site).filter((t) => t.pages.length)
  const maps = getMapPages(site)
  const hasTickets = stopHasTickets(stop)
  const hasMap = stopHasMap(stop)
  const hasGuideContent = stopHasVisibleGuideContent(stop)
  const siteSections = visibleGuideSections(kind)
  const showFullExpand = stopCanExpand(stop) && siteNeedsFullExpand(stop)
  const hasViewer =
    Boolean(site?.mapsUrl) || hasTickets || hasMap || showFullExpand
  const details = siteDetailFields(site)
  const hasDetailFields = siteHasVisibleDetails(site)
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
        title: `${title} · ${t.label}`,
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
          title: `${title} · ${t.label}`,
        })
      },
    })
  }

  const openMap = () => {
    if (maps.length <= 1) {
      onOpen({ kind: 'map', stop, title })
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
          onOpen({ kind: 'map', stop, title })
          return
        }
        const pageIndex = Number(id)
        onOpen({
          kind: 'map',
          stop,
          title: `${title} · page ${pageIndex + 1}`,
          pageIndex,
        })
      },
    })
  }

  const durationLabel = displayDuration(stop, nextStop)

  const header = (
    <>
      <div className="w-14 shrink-0 pt-0.5">
        <div className="text-sm font-semibold text-accent">{stop.time}</div>
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
          <div className="font-semibold leading-snug text-ink">{title}</div>
          {stop.timedEntry ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              <AlarmClock className="h-3 w-3" />
              Timed
            </span>
          ) : null}
        </div>
        {kind && kind !== 'attraction' ? (
          <div className="mt-0.5 text-[11px] tracking-wide text-ink-soft">
            {kind.charAt(0).toUpperCase() + kind.slice(1)}
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
                  {details.bags?.length ? (
                    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                      <dt className="font-semibold text-ink">Bags</dt>
                      <dd className="text-ink-soft">
                        <ul className="list-disc space-y-1 pl-4">
                          {details.bags.map((bag, i) => (
                            <li key={i} className="break-words">
                              {bag}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
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
                  {details.summary ? (
                    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                      <dt className="font-semibold text-ink">Summary</dt>
                      <dd className="text-ink-soft">
                        <RichText value={details.summary} />
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {hasGuideContent && site ? (
                <div className="space-y-4">
                  {siteSections.map((key) => {
                    if (!showGuideSection(kind, key)) return null
                    const items = site[key] ?? []
                    if (!items.length) return null
                    return (
                      <section key={key}>
                        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                          {SITE_SECTION_LABELS[key]}
                        </h4>
                        <ul className="space-y-1.5">
                          {items.map((item, i) => (
                            <li
                              key={`${key}-${i}`}
                              className="rounded-lg bg-paper-deep/70 px-3 py-2 text-sm leading-relaxed text-ink-soft"
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
              site?.mapsUrl ||
              hasTickets ||
              hasMap ||
              showFullExpand ||
              adminMode ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {site?.mapsUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={site?.mapsUrl} target="_blank" rel="noreferrer">
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
                        onOpen({ kind: 'expand', stop, title })
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
                        onClick={() => onAdminAction('mark-converge', stop)}
                      >
                        Mark converge
                      </Button>
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
  onAddOption,
  onRenameOption,
  onDeleteOption,
  onReorderOptions,
}: {
  day: ItineraryDay
  adminMode?: boolean
  onOpen: (target: ViewerTarget) => void
  onAdminAction?: (action: AdminAction, stop: ItineraryStop, extra?: string) => void
  onAddEvent?: () => void
  onSetDayMaps?: (maps: DayMapLink[]) => void | Promise<void>
  onAddOption?: (label: string, seedStopId: string) => void | Promise<void>
  onRenameOption?: (
    group: string,
    fromLabel: string,
    toLabel: string,
  ) => void | Promise<void>
  onDeleteOption?: (group: string, label: string) => void | Promise<void>
  onReorderOptions?: (order: string[]) => void | Promise<void>
}) {
  const dialog = useAppDialog()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [optionBusy, setOptionBusy] = useState(false)
  const [seedPicker, setSeedPicker] = useState<{
    label: string
  } | null>(null)
  const optionOrder = day.optionOrder
  const choicesByGroup = useMemo(
    () => collectOptionChoices(day.stops, optionOrder),
    [day.stops, optionOrder],
  )
  const hasOptions = choicesByGroup.size > 0
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
    () => buildTimeline(day.stops, selectedByGroup, optionOrder),
    [day.stops, selectedByGroup, optionOrder],
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

  const runOption = async (fn: () => void | Promise<void>) => {
    setOptionBusy(true)
    try {
      await fn()
    } catch (e) {
      await dialog.alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setOptionBusy(false)
    }
  }

  const startAddOption = () => {
    if (!onAddOption || !day.stops.length) return
    void (async () => {
      const name = await dialog.promptText({
        title: 'Add option',
        label: 'Option name',
        placeholder: 'Option 1 · British Museum',
        required: true,
        confirmLabel: 'Next',
      })
      if (!name?.trim()) return
      setSeedPicker({ label: name.trim() })
    })()
  }

  const renderOptionToggle = (
    group: string,
    choices: OptionChoice[],
  ) => {
    const selected =
      selectedByGroup[group] ?? defaultLabelForGroup(choices)
    const canReorder = Boolean(adminMode && onReorderOptions && choices.length > 1)
    return (
      <div
        key={`toggle-${group}`}
        className="space-y-2 rounded-xl bg-paper-deep/50 p-2"
      >
        <div className="flex flex-wrap gap-2">
          {choices.map((c, index) => (
            <div
              key={c.label}
              className={cn(
                'flex min-h-10 min-w-0 flex-1 items-stretch overflow-hidden rounded-lg ring-1',
                selected === c.label
                  ? 'bg-accent text-white ring-accent shadow-sm'
                  : 'bg-paper text-ink ring-line',
              )}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedByGroup((s) => ({ ...s, [group]: c.label }))
                }
                className="min-w-0 flex-1 px-3 py-2 text-left text-sm font-semibold transition hover:opacity-90"
              >
                {c.label}
              </button>
              {adminMode &&
              (onRenameOption || onDeleteOption || canReorder) ? (
                <span
                  className={cn(
                    'flex shrink-0 items-center border-l',
                    selected === c.label
                      ? 'border-white/25'
                      : 'border-line',
                  )}
                >
                  {canReorder ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          'p-2 transition hover:opacity-80 disabled:opacity-30',
                          selected === c.label
                            ? 'text-white/90'
                            : 'text-ink-soft hover:text-ink',
                        )}
                        aria-label={`Move ${c.label} left`}
                        disabled={optionBusy || index === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          const current = resolvedOptionOrder(
                            day.stops,
                            optionOrder,
                          )
                          const next = moveOptionInOrder(current, c.label, -1)
                          if (next === current) return
                          void runOption(() => onReorderOptions?.(next))
                        }}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'p-2 transition hover:opacity-80 disabled:opacity-30',
                          selected === c.label
                            ? 'text-white/90'
                            : 'text-ink-soft hover:text-ink',
                        )}
                        aria-label={`Move ${c.label} right`}
                        disabled={optionBusy || index === choices.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          const current = resolvedOptionOrder(
                            day.stops,
                            optionOrder,
                          )
                          const next = moveOptionInOrder(current, c.label, 1)
                          if (next === current) return
                          void runOption(() => onReorderOptions?.(next))
                        }}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : null}
                  {onRenameOption ? (
                    <button
                      type="button"
                      className={cn(
                        'p-2 transition hover:opacity-80',
                        selected === c.label
                          ? 'text-white/90'
                          : 'text-ink-soft hover:text-ink',
                      )}
                      aria-label={`Rename ${c.label}`}
                      disabled={optionBusy}
                      onClick={(e) => {
                        e.stopPropagation()
                        void (async () => {
                          const next = await dialog.promptText({
                            title: 'Rename option',
                            label: 'Option name',
                            defaultValue: c.label,
                            required: true,
                            confirmLabel: 'Save',
                          })
                          if (!next?.trim() || next.trim() === c.label) return
                          await runOption(() =>
                            onRenameOption(group, c.label, next.trim()),
                          )
                        })()
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onDeleteOption ? (
                    <button
                      type="button"
                      className={cn(
                        'p-2 transition hover:opacity-80',
                        selected === c.label
                          ? 'text-white/90'
                          : 'text-ink-soft hover:text-accent',
                      )}
                      aria-label={`Delete ${c.label}`}
                      disabled={optionBusy}
                      onClick={(e) => {
                        e.stopPropagation()
                        void (async () => {
                          const ok = await dialog.confirm({
                            title: 'Delete option',
                            message: `Remove “${c.label}” from all events on this day?`,
                            confirmLabel: 'Delete',
                            destructive: true,
                          })
                          if (!ok) return
                          await runOption(() => onDeleteOption(group, c.label))
                        })()
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {adminMode && onAddOption ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={optionBusy || !day.stops.length}
            onClick={startAddOption}
          >
            <Plus className="h-3.5 w-3.5" /> Option
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <DayMapsBar
        maps={dayMaps}
        adminMode={adminMode}
        onChange={onSetDayMaps}
      />
      <p className="px-1 text-sm text-ink-soft">
        Full timeline — tap a row for details
        {adminMode ? ' (admin: edit, options, attachments)' : ''}.
      </p>
      {adminMode && onAddOption && !hasOptions ? (
        <div className="rounded-xl bg-paper-deep/50 p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={optionBusy || !day.stops.length}
            onClick={startAddOption}
          >
            <Plus className="h-3.5 w-3.5" /> Option
          </Button>
        </div>
      ) : null}
      {timeline.map((item) => {
        if (item.type === 'option-toggle') {
          return renderOptionToggle(item.group, item.choices)
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
                      title: stopTitle(item.stop),
                      edit: true,
                    })
                : undefined
            }
          />
        )
      })}
      {adminMode && onAddEvent ? (
        <Button
          variant="outline"
          className="mt-2 w-full"
          onClick={onAddEvent}
        >
          <Plus className="h-3.5 w-3.5" /> Add event
        </Button>
      ) : null}
      <AttachmentPicker
        open={Boolean(seedPicker)}
        onOpenChange={(o) => !o && setSeedPicker(null)}
        title="Which event starts this option?"
        options={day.stops.map((s) => ({
          id: s.id,
          label: `${s.time} · ${stopTitle(s)}`,
        }))}
        onSelect={(id) => {
          const label = seedPicker?.label
          setSeedPicker(null)
          if (!label || !onAddOption) return
          void runOption(() => onAddOption(label, id))
        }}
      />
    </div>
  )
}
