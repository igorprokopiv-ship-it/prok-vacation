import {
  AlarmClock,
  Map as MapIcon,
  MapPinned,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { GuideSectionsEditor } from '@/components/GuideSectionsEditor'
import { RichText } from '@/components/RichText'
import { RichTextEditor } from '@/components/RichTextEditor'
import { SortableStringList } from '@/components/SortableStringList'
import type { ItineraryStop, Site, StopKind } from '@/data/types'
import { isEmptyRichText, normalizeRichText } from '@/lib/richText'
import {
  asStringList,
  guideHasVisibleContent,
  showCost,
  showDuration,
  showGuideSection,
  showHours,
  showMealExtras,
  showTransitExtras,
  stopDetailFields,
  type GuideSectionKey,
  visibleGuideSections,
} from '@/data/stopFields'
import {
  getGuidesForStop,
  getMapPages,
  getSitePhoto,
  getTicketSets,
  stopHasMap,
  stopHasTickets,
} from '@/lib/data'
import {
  displayDuration,
  formatDurationMinutes,
  nextStopInSequence,
  spanMinutes,
} from '@/lib/duration'
import { cn } from '@/lib/utils'

const SECTION_LABELS: Record<GuideSectionKey, string> = {
  logistics: 'Logistics',
  proTips: 'Pro-Tips',
  history: 'History',
  route: 'The Route',
}

const STOP_KINDS: StopKind[] = [
  'attraction',
  'transit',
  'meal',
  'hotel',
  'show',
  'photo',
  'shopping',
  'rest',
]

const inputClass =
  'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea'

export type AttachmentType = 'ticket' | 'map' | 'mapsUrl'

type AttachmentRow =
  | { type: 'ticket'; id: string; label: string; pages: string[] }
  | { type: 'map'; id: 'map'; pages: string[] }
  | { type: 'mapsUrl'; id: 'mapsUrl'; url: string }

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-soft break-words">{value}</dd>
    </div>
  )
}

function emptyGuideDraft(name: string): Site {
  return {
    id: '',
    name,
    aliases: [],
    logistics: [],
    proTips: [],
    history: [],
    route: [],
    attachments: [],
  }
}

function buildAttachments(stop: ItineraryStop): AttachmentRow[] {
  const rows: AttachmentRow[] = []
  for (const t of getTicketSets(stop)) {
    rows.push({ type: 'ticket', id: t.id, label: t.label, pages: t.pages })
  }
  const mapPages = getMapPages(stop)
  if (mapPages.length) {
    rows.push({ type: 'map', id: 'map', pages: mapPages })
  }
  if (stop.mapsUrl) {
    rows.push({ type: 'mapsUrl', id: 'mapsUrl', url: stop.mapsUrl })
  }
  return rows
}

export function EventExpand({
  stop,
  dayStops = [],
  onClose,
  adminMode = false,
  initialEditMode = false,
  onSaveStop,
  onSaveGuide,
  onUnlinkGuide,
  onAddTicket,
  onRemoveTicket,
  onAddMap,
  onRemoveMap,
  onSetMapsUrl,
  onConvertTicketToMap,
  onConvertMapToTicket,
  onAssignOption,
  onClearOption,
  onOpenTicket,
  onOpenMap,
}: {
  stop: ItineraryStop
  dayStops?: ItineraryStop[]
  onClose: () => void
  adminMode?: boolean
  initialEditMode?: boolean
  onSaveStop?: (patch: Record<string, unknown>) => void | Promise<void>
  onSaveGuide?: (guide: Site) => void | Promise<void>
  onUnlinkGuide?: (guideId: string) => void | Promise<void>
  onAddTicket?: (label: string) => void | Promise<void>
  onRemoveTicket?: (ticketId: string) => void | Promise<void>
  onAddMap?: () => void | Promise<void>
  onRemoveMap?: () => void | Promise<void>
  onSetMapsUrl?: (url: string | null) => void | Promise<void>
  onConvertTicketToMap?: (ticketId: string) => void | Promise<void>
  onConvertMapToTicket?: (label: string) => void | Promise<void>
  onAssignOption?: (label: string, group?: string) => void | Promise<void>
  onClearOption?: () => void | Promise<void>
  onOpenTicket?: (ticketId: string, title: string) => void
  onOpenMap?: (title: string, pageIndex?: number) => void
}) {
  const dialog = useAppDialog()
  const [editing, setEditing] = useState(Boolean(adminMode && initialEditMode))
  const [busy, setBusy] = useState(false)

  const guides = getGuidesForStop(stop)
  const [activeId, setActiveId] = useState(guides[0]?.id ?? '')
  const active = guides.find((g) => g.id === activeId) ?? guides[0]
  /** Only show the guide editor when a guide is linked, or the user opts in. */
  const [guideEditorOpen, setGuideEditorOpen] = useState(guides.length > 0)
  const [guideDraft, setGuideDraft] = useState<Site | null>(
    active ? { ...active, attachments: active.attachments ?? [] } : null,
  )
  /** Guide ids detached this edit session — pending until Save (or already saved via Remove). */
  const [pendingUnlinkIds, setPendingUnlinkIds] = useState<string[]>([])

  const [time, setTime] = useState(stop.time)
  const [title, setTitle] = useState(stop.title)
  const [kind, setKind] = useState<StopKind>(stop.kind || 'attraction')
  const [duration, setDuration] = useState(stop.duration || '')
  const [hours, setHours] = useState(stop.hours || '')
  const [cost, setCost] = useState(stop.cost || '')
  const [booking, setBooking] = useState(stop.bookingRef || '')
  const [bags, setBags] = useState(stop.bags || '')
  const [transit, setTransit] = useState(stop.transit || '')
  const [notes, setNotes] = useState(stop.notes || '')
  const [vibe, setVibe] = useState<string[]>(() => asStringList(stop.vibe))
  const [mustTry, setMustTry] = useState<string[]>(() =>
    asStringList(stop.mustTry),
  )
  const [optionLabel, setOptionLabel] = useState(stop.optionLabel || '')
  const [timedEntry, setTimedEntry] = useState(Boolean(stop.timedEntry))

  const sections = useMemo(() => visibleGuideSections(kind), [kind])
  const details = stopDetailFields(stop)
  const ticketSets = getTicketSets(stop).filter((t) => t.pages.length)
  const maps = getMapPages(stop)
  const hasTickets = stopHasTickets(stop)
  const hasMap = stopHasMap(stop)
  const attachments = buildAttachments(stop)
  const [picker, setPicker] = useState<{
    title: string
    options: AttachmentPickOption[]
    onSelect: (id: string) => void
  } | null>(null)

  const openTickets = () => {
    if (!onOpenTicket || !ticketSets.length) return
    if (ticketSets.length === 1) {
      const t = ticketSets[0]
      onOpenTicket(t.id, `${stop.title} · ${t.label}`)
      return
    }
    setPicker({
      title: 'Which ticket?',
      options: ticketSets.map((t) => ({ id: t.id, label: t.label })),
      onSelect: (id) => {
        const t = ticketSets.find((x) => x.id === id)
        if (!t) return
        onOpenTicket(t.id, `${stop.title} · ${t.label}`)
      },
    })
  }

  const openMap = () => {
    if (!onOpenMap) return
    if (maps.length <= 1) {
      onOpenMap(stop.title)
      return
    }
    setPicker({
      title: 'Which map page?',
      options: [
        ...maps.map((_, i) => ({ id: String(i), label: `Page ${i + 1}` })),
        { id: 'all', label: 'All pages' },
      ],
      onSelect: (id) => {
        if (id === 'all') {
          onOpenMap(stop.title)
          return
        }
        const pageIndex = Number(id)
        onOpenMap(`${stop.title} · page ${pageIndex + 1}`, pageIndex)
      },
    })
  }

  // Sync form from stop when not editing — never wipe in-progress edits
  // (e.g. clearing a duration override) on sync / parent re-renders.
  useEffect(() => {
    if (editing) return
    setTime(stop.time)
    setTitle(stop.title)
    setKind(stop.kind || 'attraction')
    setDuration(stop.duration || '')
    setHours(stop.hours || '')
    setCost(stop.cost || '')
    setBooking(stop.bookingRef || '')
    setBags(stop.bags || '')
    setTransit(stop.transit || '')
    setNotes(stop.notes || '')
    setVibe(asStringList(stop.vibe))
    setMustTry(asStringList(stop.mustTry))
    setOptionLabel(stop.optionLabel || '')
    setTimedEntry(Boolean(stop.timedEntry))
  }, [stop, editing])

  const guideIdsKey = (
    stop.guideIds?.length
      ? stop.guideIds
      : stop.siteId
        ? [stop.siteId]
        : []
  ).join('|')

  useEffect(() => {
    if (!guides.some((g) => g.id === activeId)) {
      setActiveId(guides[0]?.id ?? '')
    }
  }, [guideIdsKey, activeId, guides])

  // Sync draft when switching guides / leaving edit — never wipe in-progress edits
  // (dialog re-renders used to reset draft because `guides` is a new array each render).
  useEffect(() => {
    if (editing && pendingUnlinkIds.length) return
    const next = guides.find((g) => g.id === activeId) ?? guides[0] ?? null
    if (next) {
      setGuideEditorOpen(true)
      setGuideDraft((d) => {
        if (editing && d && d.id === next.id) return d
        return { ...next, attachments: next.attachments ?? [] }
      })
      return
    }
    if (!editing) {
      setGuideEditorOpen(false)
      setGuideDraft(null)
      setPendingUnlinkIds([])
    }
  }, [activeId, guideIdsKey, editing, pendingUnlinkIds.length, guides])

  const photo = guideDraft?.id ? getSitePhoto(guideDraft.id) : undefined
  const hasGuideBody = guideDraft
    ? guideHasVisibleContent(guideDraft, kind)
    : false

  const startNewGuide = () => {
    setPendingUnlinkIds([])
    setGuideEditorOpen(true)
    setGuideDraft(emptyGuideDraft(title.trim() || stop.title))
    setActiveId('')
  }

  const queueRemoveGuide = async (guideId: string) => {
    const name =
      guides.find((g) => g.id === guideId)?.name ||
      guideDraft?.name ||
      'this guide'
    const ok = await dialog.confirm({
      title: 'Remove guide',
      message: `Remove “${name}” from this event? The guide itself is kept in the trip library.`,
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    const nextPending = pendingUnlinkIds.includes(guideId)
      ? pendingUnlinkIds
      : [...pendingUnlinkIds, guideId]
    setPendingUnlinkIds(nextPending)
    const remaining = guides.filter((g) => !nextPending.includes(g.id))
    if (remaining.length) {
      setActiveId(remaining[0].id)
      setGuideDraft({
        ...remaining[0],
        attachments: remaining[0].attachments ?? [],
      })
      setGuideEditorOpen(true)
    } else {
      setActiveId('')
      setGuideDraft(null)
      setGuideEditorOpen(false)
    }
  }

  const updateAllSections = (
    next: Record<GuideSectionKey, string[]>,
  ) => {
    setGuideEditorOpen(true)
    setGuideDraft((d) => {
      const base = d ?? emptyGuideDraft(title.trim() || stop.title)
      return {
        ...base,
        logistics: next.logistics ?? base.logistics,
        proTips: next.proTips ?? base.proTips,
        history: next.history ?? base.history,
        route: next.route ?? base.route,
      }
    })
  }

  const editItem = async (key: GuideSectionKey, index: number) => {
    const current = guideDraft?.[key][index] ?? ''
    const next = await dialog.promptRichText({
      title: 'Edit item',
      label: SECTION_LABELS[key],
      defaultValue: current,
      required: false,
      confirmLabel: 'Save',
    })
    if (next === null) return
    setGuideDraft((d) => {
      if (!d) return d
      const list = d[key] ?? []
      if (!next) {
        return { ...d, [key]: list.filter((_, i) => i !== index) }
      }
      return {
        ...d,
        [key]: list.map((item, i) => (i === index ? next : item)),
      }
    })
  }

  const removeItem = (key: GuideSectionKey, index: number) => {
    setGuideDraft((d) => {
      if (!d) return d
      return { ...d, [key]: (d[key] ?? []).filter((_, i) => i !== index) }
    })
  }

  const addItem = async (key: GuideSectionKey) => {
    const next = await dialog.promptRichText({
      title: 'Add note',
      message: `Starts in ${SECTION_LABELS[key]} — drag to another section anytime.`,
      label: 'Note',
      confirmLabel: 'Add',
    })
    if (!next) return
    setGuideEditorOpen(true)
    setGuideDraft((d) => {
      const base = d ?? emptyGuideDraft(title.trim() || stop.title)
      return { ...base, [key]: [...(base[key] ?? []), next] }
    })
  }

  const editStringList = async (
    list: string[],
    setList: (next: string[]) => void,
    index: number,
    label: string,
  ) => {
    const current = list[index] ?? ''
    const next = await dialog.promptText({
      title: `Edit ${label}`,
      label,
      defaultValue: current,
      multiline: true,
      required: false,
      confirmLabel: 'Save',
    })
    if (next === null) return
    if (!next.trim()) {
      setList(list.filter((_, i) => i !== index))
      return
    }
    setList(list.map((item, i) => (i === index ? next.trim() : item)))
  }

  const addStringListItem = async (
    list: string[],
    setList: (next: string[]) => void,
    label: string,
  ) => {
    const next = await dialog.promptText({
      title: `Add ${label}`,
      label,
      multiline: true,
      confirmLabel: 'Add',
    })
    if (!next?.trim()) return
    setList([...list, next.trim()])
  }

  const stopDirty =
    time !== stop.time ||
    title !== stop.title ||
    kind !== (stop.kind || 'attraction') ||
    duration !== (stop.duration || '') ||
    hours !== (stop.hours || '') ||
    cost !== (stop.cost || '') ||
    booking !== (stop.bookingRef || '') ||
    bags !== (stop.bags || '') ||
    normalizeRichText(transit) !== normalizeRichText(stop.transit || '') ||
    normalizeRichText(notes) !== normalizeRichText(stop.notes || '') ||
    timedEntry !== Boolean(stop.timedEntry) ||
    JSON.stringify(vibe) !== JSON.stringify(asStringList(stop.vibe)) ||
    JSON.stringify(mustTry) !== JSON.stringify(asStringList(stop.mustTry))

  const linkedGuides = guides.filter((g) => !pendingUnlinkIds.includes(g.id))
  const linkedActive =
    linkedGuides.find((g) => g.id === activeId) ?? linkedGuides[0]

  const guideDirty =
    pendingUnlinkIds.length > 0 ||
    (Boolean(guideDraft) &&
      guideEditorOpen &&
      (linkedGuides.length === 0
        ? // New guide draft — only dirty if the user added real content
          sections.some((key) => (guideDraft?.[key]?.length ?? 0) > 0)
        : Boolean(linkedActive) &&
          Boolean(guideDraft) &&
          (guideDraft!.name !== linkedActive!.name ||
            sections.some(
              (key) =>
                JSON.stringify(guideDraft![key]) !==
                JSON.stringify(linkedActive![key] ?? []),
            ))))

  const dirty = stopDirty || Boolean(guideDirty)

  const nextStop = nextStopInSequence(dayStops, stop.id)
  const durationLabel = displayDuration(
    { ...stop, time, kind, duration },
    nextStop,
  )
  const computedSpanMins = nextStop
    ? spanMinutes(time.trim() || stop.time, nextStop.time)
    : null
  const computedSpan =
    computedSpanMins != null ? formatDurationMinutes(computedSpanMins) : ''

  const saveAll = async () => {
    if (!onSaveStop && !onSaveGuide && !onUnlinkGuide) return
    setBusy(true)
    try {
      // Detach first so a later upsert cannot re-link a removed guide.
      if (onUnlinkGuide && pendingUnlinkIds.length) {
        for (const id of pendingUnlinkIds) {
          await onUnlinkGuide(id)
        }
        setPendingUnlinkIds([])
      }

      if (onSaveStop && stopDirty) {
        await onSaveStop({
          time: time.trim(),
          title: title.trim(),
          kind,
          // Empty string clears the transit override; non-transit always clears.
          duration: showDuration(kind) ? duration.trim() : '',
          hours: showHours(kind) ? hours.trim() || null : null,
          notes: normalizeRichText(notes) || null,
          cost: showCost(kind) ? cost.trim() || null : null,
          bookingRef: showTransitExtras(kind) ? booking.trim() || null : null,
          bags: showTransitExtras(kind) ? bags.trim() || null : null,
          transit: showTransitExtras(kind)
            ? normalizeRichText(transit) || null
            : null,
          vibe: showMealExtras(kind) ? vibe : [],
          mustTry: showMealExtras(kind) ? mustTry : [],
          timedEntry,
        })
      }

      if (onSaveGuide && guideDraft && guideEditorOpen) {
        const hasContent = sections.some(
          (key) => (guideDraft[key]?.length ?? 0) > 0,
        )
        const stillLinked =
          Boolean(guideDraft.id) &&
          linkedGuides.some((g) => g.id === guideDraft.id)

        if (stillLinked && !hasContent) {
          // Emptied a linked guide → detach instead of saving blank content
          // (which would wipe a shared library guide).
          if (onUnlinkGuide) {
            await onUnlinkGuide(guideDraft.id)
          }
          setGuideDraft(null)
          setGuideEditorOpen(false)
        } else if (
          hasContent &&
          (stillLinked
            ? guideDraft.name !== linkedActive?.name ||
              sections.some(
                (key) =>
                  JSON.stringify(guideDraft[key]) !==
                  JSON.stringify(linkedActive?.[key] ?? []),
              )
            : true)
        ) {
          await onSaveGuide({
            ...guideDraft,
            name: guideDraft.name.trim() || title.trim() || stop.title,
          })
        }
      }

      setEditing(false)
      setGuideEditorOpen(linkedGuides.length > 0)
    } catch (e) {
      await dialog.alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const changeAttachmentType = async (
    row: AttachmentRow,
    nextType: AttachmentType,
  ) => {
    if (row.type === nextType) return
    setBusy(true)
    try {
      if (row.type === 'ticket' && nextType === 'map') {
        if (!onConvertTicketToMap) {
          await dialog.alert('Cannot convert ticket to map')
          return
        }
        const ok = await dialog.confirm({
          title: 'Convert to map',
          message: 'Convert this ticket into the venue map?',
          confirmLabel: 'Convert',
        })
        if (!ok) return
        await onConvertTicketToMap(row.id)
        return
      }
      if (row.type === 'map' && nextType === 'ticket') {
        if (!onConvertMapToTicket) {
          await dialog.alert('Cannot convert map to ticket')
          return
        }
        const label = await dialog.promptText({
          title: 'Ticket label',
          label: 'Label',
          defaultValue: 'Ticket',
          confirmLabel: 'Convert',
        })
        if (!label?.trim()) return
        await onConvertMapToTicket(label.trim())
        return
      }
      if (row.type === 'mapsUrl' && nextType !== 'mapsUrl') {
        await dialog.alert(
          'Clear the Map URL and add a Ticket or Map instead.',
        )
        return
      }
      if (nextType === 'mapsUrl') {
        await dialog.alert(
          'Use “Map URL” to set a link. Remove this attachment first if needed.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const existingOptions = useMemo(() => {
    const map = new Map<string, { group: string; label: string }>()
    for (const s of dayStops) {
      if (s.optionGroup && s.optionLabel) {
        map.set(`${s.optionGroup}|${s.optionLabel}`, {
          group: s.optionGroup,
          label: s.optionLabel,
        })
      }
    }
    return [...map.values()]
  }, [dayStops])

  const kindLabel = kind
    ? kind.charAt(0).toUpperCase() + kind.slice(1)
    : ''

  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      await dialog.alert(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-12">
      <div className="flex h-full max-h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <header className="shrink-0 border-b border-line bg-paper/95 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      placeholder="20:40"
                      className={cn(inputClass, 'w-24 font-mono font-bold')}
                    />
                    {showDuration(kind) ? (
                      <input
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder={computedSpan || '5h 55m'}
                        title="Duration override (leave blank to use span until next event)"
                        className={cn(inputClass, 'w-28')}
                      />
                    ) : durationLabel ? (
                      <span className="text-xs text-ink-soft">{durationLabel}</span>
                    ) : null}
                  </div>
                  {showDuration(kind) ? (
                    <p className="text-[11px] text-ink-soft">
                      Override — blank uses span to next event
                      {computedSpan ? ` (${computedSpan})` : ''}.
                    </p>
                  ) : null}
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Event title"
                    className={cn(inputClass, 'font-display text-lg font-bold')}
                  />
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as StopKind)}
                    className={inputClass}
                  >
                    {STOP_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={timedEntry}
                      onChange={(e) => setTimedEntry(e.target.checked)}
                      className="h-4 w-4 rounded border-line"
                    />
                    <AlarmClock className="h-3.5 w-3.5 text-accent" />
                    Timed entry / reservation
                  </label>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-bold text-accent">
                      {stop.time}
                    </span>
                    {durationLabel ? (
                      <span className="text-xs text-ink-soft">
                        {durationLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-ink">
                      {stop.title}
                    </h2>
                    {stop.timedEntry ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">
                        <AlarmClock className="h-3.5 w-3.5" />
                        Timed
                      </span>
                    ) : null}
                  </div>
                  {kindLabel ? (
                    <p className="mt-0.5 text-xs tracking-wide text-ink-soft">
                      {stop.kind.charAt(0).toUpperCase() + stop.kind.slice(1)}
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {adminMode && !editing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPendingUnlinkIds([])
                    setGuideEditorOpen(guides.length > 0)
                    setEditing(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X />
              </Button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Event fields */}
          <div className="space-y-4 border-b border-line/70 p-4">
            {editing ? (
              <div className="space-y-3">
                {showHours(kind) ? (
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Hours
                    </span>
                    <input
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className={inputClass}
                      placeholder="09:00 – 17:00"
                    />
                  </label>
                ) : null}
                {showCost(kind) ? (
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Cost
                    </span>
                    <input
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className={inputClass}
                      placeholder="$874.80 pp"
                    />
                  </label>
                ) : null}
                {showTransitExtras(kind) ? (
                  <>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Booking
                      </span>
                      <input
                        value={booking}
                        onChange={(e) => setBooking(e.target.value)}
                        className={inputClass}
                        placeholder="Confirmation / PNR"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Bags
                      </span>
                      <input
                        value={bags}
                        onChange={(e) => setBags(e.target.value)}
                        className={inputClass}
                        placeholder="Carry-on / checked limits"
                      />
                    </label>
                    <div className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Transit
                      </span>
                      <RichTextEditor
                        value={transit}
                        onChange={setTransit}
                        placeholder="How you get there"
                      />
                    </div>
                  </>
                ) : null}
                {showMealExtras(kind) ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                          Vibe
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void addStringListItem(vibe, setVibe, 'Vibe')
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {vibe.length ? (
                        <SortableStringList
                          items={vibe}
                          editing
                          onReorder={setVibe}
                          onEdit={(i) =>
                            void editStringList(vibe, setVibe, i, 'Vibe')
                          }
                          onRemove={(i) =>
                            setVibe(vibe.filter((_, j) => j !== i))
                          }
                        />
                      ) : (
                        <p className="text-sm text-ink-soft">No items yet.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                          Must try
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void addStringListItem(
                              mustTry,
                              setMustTry,
                              'Must try',
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {mustTry.length ? (
                        <SortableStringList
                          items={mustTry}
                          editing
                          onReorder={setMustTry}
                          onEdit={(i) =>
                            void editStringList(
                              mustTry,
                              setMustTry,
                              i,
                              'Must try',
                            )
                          }
                          onRemove={(i) =>
                            setMustTry(mustTry.filter((_, j) => j !== i))
                          }
                        />
                      ) : (
                        <p className="text-sm text-ink-soft">No items yet.</p>
                      )}
                    </div>
                  </>
                ) : null}
                <div className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Notes
                  </span>
                  <RichTextEditor
                    value={notes}
                    onChange={setNotes}
                    placeholder="Notes…"
                  />
                </div>
              </div>
            ) : (
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
                {details.transit && !isEmptyRichText(details.transit) ? (
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
                {details.notes && !isEmptyRichText(details.notes) ? (
                  <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                    <dt className="font-semibold text-ink">Notes</dt>
                    <dd className="text-ink-soft">
                      <RichText value={details.notes} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            )}

            {/* View: icon buttons only. Edit: manage list + add. */}
            {editing ? (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Attachments
                </h3>
                <div className="space-y-2">
                  {attachments.map((row) => (
                    <div
                      key={`${row.type}-${row.id}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-paper-deep/50 px-2 py-1.5 text-sm"
                    >
                      <select
                        value={row.type}
                        disabled={busy}
                        onChange={(e) =>
                          void changeAttachmentType(
                            row,
                            e.target.value as AttachmentType,
                          )
                        }
                        className="rounded-lg border border-line bg-paper px-2 py-1 text-xs font-semibold"
                      >
                        <option value="ticket">Ticket</option>
                        <option value="map">Map</option>
                        <option value="mapsUrl">Map URL</option>
                      </select>
                      {row.type === 'ticket' ? (
                        <span className="min-w-0 flex-1 font-medium text-ink">
                          {row.label}
                        </span>
                      ) : null}
                      {row.type === 'map' ? (
                        <span className="min-w-0 flex-1 font-medium text-ink">
                          Venue map
                          {row.pages.length > 1
                            ? ` · ${row.pages.length} pages`
                            : ''}
                        </span>
                      ) : null}
                      {row.type === 'mapsUrl' ? (
                        <span className="min-w-0 flex-1 truncate text-ink-soft">
                          {row.url}
                        </span>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          void (async () => {
                            if (row.type === 'ticket') {
                              const ok = await dialog.confirm({
                                title: 'Remove ticket',
                                message: 'Remove this ticket?',
                                confirmLabel: 'Remove',
                                destructive: true,
                              })
                              if (!ok) return
                              await run(() => onRemoveTicket?.(row.id))
                            } else if (row.type === 'map') {
                              const ok = await dialog.confirm({
                                title: 'Remove map',
                                message: 'Remove venue map?',
                                confirmLabel: 'Remove',
                                destructive: true,
                              })
                              if (!ok) return
                              await run(() => onRemoveMap?.())
                            } else {
                              const ok = await dialog.confirm({
                                title: 'Clear Map URL',
                                message: 'Clear Map URL?',
                                confirmLabel: 'Clear',
                                destructive: true,
                              })
                              if (!ok) return
                              await run(() => onSetMapsUrl?.(null))
                            }
                          })()
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        const label = await dialog.promptText({
                          title: 'Add ticket',
                          label: 'Label',
                          defaultValue: 'Ticket',
                          confirmLabel: 'Add',
                        })
                        if (!label?.trim()) return
                        await run(() => onAddTicket?.(label.trim()))
                      })()
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ticket
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => onAddMap?.())}
                  >
                    <Plus className="h-3.5 w-3.5" />{' '}
                    {hasMap ? 'Replace map' : 'Map'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        const url = await dialog.promptText({
                          title: 'Map URL',
                          label: 'Google Maps URL',
                          defaultValue: stop.mapsUrl ?? '',
                          placeholder: 'https://maps.app.goo.gl/...',
                          required: false,
                          confirmLabel: 'Save',
                        })
                        if (url === null) return
                        await run(() => onSetMapsUrl?.(url.trim() || null))
                      })()
                    }}
                  >
                    <MapPinned className="h-3.5 w-3.5" /> Map URL
                  </Button>
                </div>
              </section>
            ) : stop.mapsUrl || hasTickets || hasMap ? (
              <div className="flex flex-wrap gap-2">
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
                {hasMap && onOpenMap ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMap()}
                  >
                    <MapIcon className="h-3.5 w-3.5" /> Map
                    {maps.length > 1 ? (
                      <span className="text-[10px] opacity-70">
                        · {maps.length}
                      </span>
                    ) : null}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Guide sections */}
          {(editing && guideEditorOpen) ||
          (!editing && (hasGuideBody || linkedGuides.length > 0)) ? (
            <>
              <div className="border-b border-line px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sea">
                      Guide
                    </p>
                    {editing && guideDraft ? (
                      <input
                        value={guideDraft.name}
                        onChange={(e) =>
                          setGuideDraft({
                            ...guideDraft,
                            name: e.target.value,
                          })
                        }
                        className="mt-0.5 w-full truncate border-0 bg-transparent font-display text-lg font-bold text-ink outline-none ring-0"
                        placeholder="Guide name"
                      />
                    ) : guideDraft?.name ? (
                      <h3 className="truncate font-display text-lg font-bold text-ink">
                        {guideDraft.name}
                      </h3>
                    ) : null}
                  </div>
                  {editing &&
                  ((guideDraft?.id &&
                    linkedGuides.some((g) => g.id === guideDraft.id)) ||
                    (!guideDraft?.id && guideEditorOpen)) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      title="Detach this guide from the event"
                      onClick={() => {
                        if (guideDraft?.id) {
                          void queueRemoveGuide(guideDraft.id)
                          return
                        }
                        // Discard unsaved new draft
                        setGuideDraft(null)
                        setGuideEditorOpen(false)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  ) : null}
                </div>
                {linkedGuides.length > 1 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {linkedGuides.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setActiveId(g.id)}
                        className={cn(
                          'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                          g.id === guideDraft?.id
                            ? 'bg-sea text-white'
                            : 'bg-paper-deep text-ink-soft ring-1 ring-line',
                        )}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {photo && !editing ? (
                <div className="relative h-36 w-full overflow-hidden">
                  <img
                    src={photo}
                    alt={guideDraft?.name ?? ''}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                </div>
              ) : null}

              <div className="space-y-5 p-4 pb-6">
                {!hasGuideBody && !editing ? (
                  linkedGuides.length > 0 ? (
                    <EmptyState
                      title="Guide coming"
                      detail="No logistics, tips, history, or route yet."
                    />
                  ) : null
                ) : (
                  <>
                    {editing ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-deep/50 px-3 py-2">
                        <p className="text-xs text-ink-soft">
                          Drag notes between Logistics, Pro-Tips, History, and
                          Route.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void addItem('logistics')}
                        >
                          <Plus className="h-3.5 w-3.5" /> Note
                        </Button>
                      </div>
                    ) : null}
                    <GuideSectionsEditor
                      sections={sections
                        .filter((key) => showGuideSection(kind, key))
                        .filter(
                          (key) =>
                            editing || (guideDraft?.[key]?.length ?? 0) > 0,
                        )
                        .map((key) => ({
                          key,
                          label: SECTION_LABELS[key],
                        }))}
                      values={{
                        logistics: guideDraft?.logistics ?? [],
                        proTips: guideDraft?.proTips ?? [],
                        history: guideDraft?.history ?? [],
                        route: guideDraft?.route ?? [],
                      }}
                      editing={editing}
                      onChange={updateAllSections}
                      onEdit={(key, i) => void editItem(key, i)}
                      onRemove={removeItem}
                      onAdd={(key) => void addItem(key)}
                    />
                  </>
                )}
              </div>
            </>
          ) : null}

          {editing && !guideEditorOpen ? (
            <div className="border-t border-line px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={startNewGuide}
              >
                <Plus className="h-3.5 w-3.5" /> Add guide
              </Button>
            </div>
          ) : null}

          {/* Branch (edit only) */}
          {editing ? (
            <section className="space-y-2 border-t border-line p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Branch
              </h3>
              {existingOptions.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {existingOptions.map((o) => (
                    <button
                      key={`${o.group}-${o.label}`}
                      type="button"
                      className={cn(
                        'rounded-lg px-2 py-1.5 text-xs font-medium ring-1',
                        stop.optionLabel === o.label &&
                          stop.optionGroup === o.group
                          ? 'bg-accent text-white ring-accent'
                          : 'bg-paper-deep text-ink ring-line',
                      )}
                      onClick={() =>
                        void run(() => onAssignOption?.(o.label, o.group))
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <div className="flex min-w-0 flex-1 gap-2">
                  <input
                    value={optionLabel}
                    onChange={(e) => setOptionLabel(e.target.value)}
                    placeholder="Option name"
                    className={inputClass}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !optionLabel.trim()}
                    onClick={() =>
                      void run(() => onAssignOption?.(optionLabel.trim()))
                    }
                  >
                    Assign
                  </Button>
                </div>
                {stop.optionGroup ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => onClearOption?.())}
                  >
                    Mark converge
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-ink-soft">
                {stop.optionLabel
                  ? `Current: ${stop.optionLabel}`
                  : 'Shared path (no option).'}
              </p>
            </section>
          ) : null}
        </div>

        {editing ? (
          <div className="flex shrink-0 gap-2 border-t border-line p-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setEditing(false)
                setPendingUnlinkIds([])
                setGuideEditorOpen(guides.length > 0)
                // reset drafts from stop
                setTime(stop.time)
                setTitle(stop.title)
                setKind(stop.kind || 'attraction')
                setDuration(stop.duration || '')
                setHours(stop.hours || '')
                setCost(stop.cost || '')
                setBooking(stop.bookingRef || '')
                setBags(stop.bags || '')
                setTransit(stop.transit || '')
                setNotes(stop.notes || '')
                setVibe(asStringList(stop.vibe))
                setMustTry(asStringList(stop.mustTry))
                setTimedEntry(Boolean(stop.timedEntry))
                if (guides[0]) {
                  setActiveId(guides[0].id)
                  setGuideDraft({
                    ...guides[0],
                    attachments: guides[0].attachments ?? [],
                  })
                } else {
                  setActiveId('')
                  setGuideDraft(null)
                }
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={busy || !dirty}
              onClick={() => void saveAll()}
            >
              Save
            </Button>
          </div>
        ) : null}
      </div>

      <AttachmentPicker
        open={Boolean(picker)}
        onOpenChange={(o) => !o && setPicker(null)}
        title={picker?.title ?? ''}
        options={picker?.options ?? []}
        onSelect={(id) => picker?.onSelect(id)}
      />
    </div>
  )
}
