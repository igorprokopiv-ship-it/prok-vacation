import {
  AlarmClock,
  ChevronDown,
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
import { GuideSectionsEditor } from '@/components/GuideSectionsEditor'
import { RichText } from '@/components/RichText'
import { RichTextEditor } from '@/components/RichTextEditor'
import { SitePickerDialog } from '@/components/SitePickerDialog'
import { SortableStringList } from '@/components/SortableStringList'
import type { ItineraryStop, Site, StopKind, TicketSet } from '@/data/types'
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
  siteDetailFields,
  siteKind,
  type GuideSectionKey,
  visibleGuideSections,
} from '@/data/stopFields'
import {
  getMapPages,
  getSite,
  getSiteForStop,
  getSitePhoto,
  getTicketSets,
  stopTitle,
} from '@/lib/data'
import {
  displayDuration,
  formatDurationMinutes,
  nextStopInSequence,
  spanMinutes,
} from '@/lib/duration'
import {
  flatOptionChoices,
  shouldShowBranchPicker,
} from '@/lib/options'
import { cn } from '@/lib/utils'

export type CreateEventPayload = {
  time: string
  siteId?: string | null
  name: string
  kind: StopKind
  duration: string
  hours: string | null
  cost: string | null
  summary: string | null
  bookingRef: string | null
  bags: string[]
  transit: string | null
  vibe: string[]
  mustTry: string[]
  timedEntry: boolean
  notes: string[]
  logistics: string[]
  proTips: string[]
  history: string[]
  route: string[]
  mapsUrl: string | null
  tickets: TicketSet[]
  mapPages: string[]
}

const EMPTY_STOP: ItineraryStop = {
  id: '',
  time: '09:00',
  siteId: null,
  optionGroup: null,
  optionLabel: null,
  primary: true,
  timedEntry: false,
}

const SECTION_LABELS: Record<GuideSectionKey, string> = {
  notes: 'Notes',
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
  | { type: 'map'; id: string; pageIndex: number; page: string }
  | { type: 'mapsUrl'; id: 'mapsUrl'; url: string }

type AttachmentDraft = {
  tickets: TicketSet[]
  mapPages: string[]
  mapsUrl: string | null
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="text-ink-soft break-words">{value}</dd>
    </div>
  )
}

function emptySiteDraft(name: string, kind: StopKind = 'attraction'): Site {
  return {
    id: '',
    name,
    kind,
    duration: '',
    hours: null,
    cost: null,
    summary: null,
    mapsUrl: null,
    bookingRef: null,
    bags: [],
    transit: null,
    vibe: [],
    mustTry: [],
    tickets: [],
    mapPages: [],
    notes: [],
    logistics: [],
    proTips: [],
    history: [],
    route: [],
    attachments: [],
  }
}

function attachmentDraftFromSite(site: Site | null | undefined): AttachmentDraft {
  return {
    tickets: getTicketSets(site).filter((t) => t.pages.length),
    mapPages: [...getMapPages(site)],
    mapsUrl: site?.mapsUrl ?? null,
  }
}

function buildAttachmentRows(draft: AttachmentDraft): AttachmentRow[] {
  const rows: AttachmentRow[] = []
  for (const t of draft.tickets) {
    rows.push({ type: 'ticket', id: t.id, label: t.label, pages: t.pages })
  }
  draft.mapPages.forEach((page, pageIndex) => {
    rows.push({
      type: 'map',
      id: `map-${pageIndex}`,
      pageIndex,
      page,
    })
  })
  if (draft.mapsUrl) {
    rows.push({ type: 'mapsUrl', id: 'mapsUrl', url: draft.mapsUrl })
  }
  return rows
}

function attachmentDraftEqual(a: AttachmentDraft, b: AttachmentDraft): boolean {
  return (
    JSON.stringify(a.tickets) === JSON.stringify(b.tickets) &&
    JSON.stringify(a.mapPages) === JSON.stringify(b.mapPages) &&
    (a.mapsUrl || null) === (b.mapsUrl || null)
  )
}

export function EventExpand({
  mode = 'edit',
  stop: stopProp,
  dayStops = [],
  onClose,
  adminMode = false,
  initialEditMode = false,
  onSaveStop,
  onSaveGuide,
  onCreate,
  onUnlinkGuide,
  onAddTicket,
  onRemoveTicket,
  onAddMap,
  onRemoveMap,
  onAssignOption,
  onClearOption,
  onOpenTicket,
  onOpenMap,
}: {
  mode?: 'edit' | 'create'
  stop?: ItineraryStop
  dayStops?: ItineraryStop[]
  onClose: () => void
  adminMode?: boolean
  initialEditMode?: boolean
  onSaveStop?: (patch: Record<string, unknown>) => void | Promise<void>
  onSaveGuide?: (guide: Site) => void | Promise<void>
  onCreate?: (payload: CreateEventPayload) => void | Promise<void>
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
  const isCreate = mode === 'create'
  const stop = stopProp ?? EMPTY_STOP
  const dialog = useAppDialog()
  const [editing, setEditing] = useState(
    Boolean(isCreate || (adminMode && initialEditMode)),
  )
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  /** undefined = use stop.siteId; null = detached; string = picked/linked */
  const [overrideSiteId, setOverrideSiteId] = useState<
    string | null | undefined
  >(isCreate ? null : undefined)

  const effectiveSiteId =
    overrideSiteId !== undefined ? overrideSiteId : stop.siteId
  const site = effectiveSiteId ? getSite(effectiveSiteId) : undefined
  const baselineAttach = useMemo(
    () => attachmentDraftFromSite(site),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      effectiveSiteId,
      JSON.stringify(site?.tickets ?? []),
      JSON.stringify(site?.mapPages ?? []),
      site?.mapsUrl ?? null,
    ],
  )

  const [time, setTime] = useState(stop.time || '09:00')
  const [title, setTitle] = useState(site?.name || (isCreate ? '' : stopTitle(stop)))
  const [kind, setKind] = useState<StopKind>(siteKind(site))
  const [duration, setDuration] = useState(site?.duration || '')
  const [hours, setHours] = useState(site?.hours || '')
  const [cost, setCost] = useState(site?.cost || '')
  const [booking, setBooking] = useState(site?.bookingRef || '')
  const [bags, setBags] = useState<string[]>(() => asStringList(site?.bags))
  const [transit, setTransit] = useState(site?.transit || '')
  const [summary, setSummary] = useState(site?.summary || '')
  const [vibe, setVibe] = useState<string[]>(() => asStringList(site?.vibe))
  const [mustTry, setMustTry] = useState<string[]>(() =>
    asStringList(site?.mustTry),
  )
  const [timedEntry, setTimedEntry] = useState(Boolean(stop.timedEntry))

  const [sectionsDraft, setSectionsDraft] = useState({
    notes: site?.notes ?? [],
    logistics: site?.logistics ?? [],
    proTips: site?.proTips ?? [],
    history: site?.history ?? [],
    route: site?.route ?? [],
  })
  const [attachDraft, setAttachDraft] = useState<AttachmentDraft>(baselineAttach)

  const sections = useMemo(() => visibleGuideSections(kind), [kind])
  const details = siteDetailFields(site)
  const displayName =
    site?.name || title.trim() || (isCreate ? 'New event' : stopTitle(stop))
  const photo = site?.id ? getSitePhoto(site.id) : undefined
  const hasSectionBody = guideHasVisibleContent(
    {
      ...(site ?? emptySiteDraft(displayName, kind)),
      ...sectionsDraft,
    },
    kind,
  )
  const attachmentRows = buildAttachmentRows(
    editing || isCreate ? attachDraft : baselineAttach,
  )
  const canUploadAttachments = Boolean(!isCreate && stop.id && effectiveSiteId)
  const viewTickets = baselineAttach.tickets
  const viewMaps = baselineAttach.mapPages
  const viewMapsUrl = baselineAttach.mapsUrl

  const [picker, setPicker] = useState<{
    title: string
    options: AttachmentPickOption[]
    onSelect: (id: string) => void
  } | null>(null)

  const applySiteToForm = (s: Site | undefined, keepTime = true) => {
    if (!keepTime) setTime(stop.time || '09:00')
    setTitle(s?.name || '')
    setKind(siteKind(s))
    setDuration(s?.duration || '')
    setHours(s?.hours || '')
    setCost(s?.cost || '')
    setBooking(s?.bookingRef || '')
    setBags(asStringList(s?.bags))
    setTransit(s?.transit || '')
    setSummary(s?.summary || '')
    setVibe(asStringList(s?.vibe))
    setMustTry(asStringList(s?.mustTry))
    setSectionsDraft({
      notes: s?.notes ?? [],
      logistics: s?.logistics ?? [],
      proTips: s?.proTips ?? [],
      history: s?.history ?? [],
      route: s?.route ?? [],
    })
    setAttachDraft(attachmentDraftFromSite(s))
  }

  const resetFromSite = (s: Site | undefined) => {
    setTime(stop.time || '09:00')
    setTimedEntry(Boolean(stop.timedEntry))
    applySiteToForm(s)
    if (!s && !isCreate) setTitle(stopTitle(stop))
  }

  useEffect(() => {
    if (editing || isCreate) return
    setOverrideSiteId(undefined)
    resetFromSite(getSiteForStop(stop))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, editing, stop.siteId, baselineAttach, isCreate])

  const buildSitePayload = (): CreateEventPayload => ({
    time: time.trim(),
    siteId: effectiveSiteId,
    name: title.trim() || displayName,
    kind,
    duration: showDuration(kind) ? duration.trim() : '',
    hours: showHours(kind) ? hours.trim() || null : null,
    cost: showCost(kind) ? cost.trim() || null : null,
    summary: normalizeRichText(summary) || null,
    bookingRef: showTransitExtras(kind) ? booking.trim() || null : null,
    bags: showTransitExtras(kind) ? bags : [],
    transit: showTransitExtras(kind)
      ? normalizeRichText(transit) || null
      : null,
    vibe: showMealExtras(kind) ? vibe : [],
    mustTry: showMealExtras(kind) ? mustTry : [],
    timedEntry,
    notes: sectionsDraft.notes,
    logistics: sectionsDraft.logistics,
    proTips: sectionsDraft.proTips,
    history: sectionsDraft.history,
    route: sectionsDraft.route,
    mapsUrl: attachDraft.mapsUrl,
    tickets: attachDraft.tickets,
    mapPages: attachDraft.mapPages,
  })

  const removeSite = async () => {
    const ok = await dialog.confirm({
      title: 'Remove site',
      message:
        'Unlink this site from the event? You can fill in a new site or pick an existing one. Other events that use this site are unchanged.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    const prevId = effectiveSiteId
    if (prevId && onUnlinkGuide) {
      await run(() => onUnlinkGuide(prevId))
    }
    setOverrideSiteId(null)
    applySiteToForm(undefined)
    setEditing(true)
  }

  const pickExistingSite = (picked: Site) => {
    setOverrideSiteId(picked.id)
    applySiteToForm(picked)
  }

  const openTickets = () => {
    if (!onOpenTicket || !viewTickets.length) return
    if (viewTickets.length === 1) {
      const t = viewTickets[0]
      onOpenTicket(t.id, `${displayName} · ${t.label}`)
      return
    }
    setPicker({
      title: 'Which ticket?',
      options: viewTickets.map((t) => ({ id: t.id, label: t.label })),
      onSelect: (id) => {
        const t = viewTickets.find((x) => x.id === id)
        if (!t) return
        onOpenTicket(t.id, `${displayName} · ${t.label}`)
      },
    })
  }

  const openMap = () => {
    if (!onOpenMap) return
    if (viewMaps.length <= 1) {
      onOpenMap(displayName)
      return
    }
    setPicker({
      title: 'Which map page?',
      options: [
        ...viewMaps.map((_, i) => ({ id: String(i), label: `Page ${i + 1}` })),
        { id: 'all', label: 'All pages' },
      ],
      onSelect: (id) => {
        if (id === 'all') {
          onOpenMap(displayName)
          return
        }
        const pageIndex = Number(id)
        onOpenMap(`${displayName} · page ${pageIndex + 1}`, pageIndex)
      },
    })
  }

  const updateAllSections = (next: Record<GuideSectionKey, string[]>) => {
    setSectionsDraft({
      notes: next.notes ?? [],
      logistics: next.logistics ?? [],
      proTips: next.proTips ?? [],
      history: next.history ?? [],
      route: next.route ?? [],
    })
  }

  const editItem = async (key: GuideSectionKey, index: number) => {
    const current = sectionsDraft[key][index] ?? ''
    const next = await dialog.promptRichText({
      title: 'Edit item',
      label: SECTION_LABELS[key],
      defaultValue: current,
      required: false,
      confirmLabel: 'Save',
    })
    if (next === null) return
    setSectionsDraft((d) => {
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
    setSectionsDraft((d) => ({
      ...d,
      [key]: (d[key] ?? []).filter((_, i) => i !== index),
    }))
  }

  const addItem = async (key: GuideSectionKey) => {
    const next = await dialog.promptRichText({
      title: 'Add note',
      message: `Starts in ${SECTION_LABELS[key]} — drag to another section anytime.`,
      label: 'Note',
      confirmLabel: 'Add',
    })
    if (!next) return
    setSectionsDraft((d) => ({
      ...d,
      [key]: [...(d[key] ?? []), next],
    }))
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

  const siteAttrsDirty =
    title !== (site?.name || '') ||
    kind !== siteKind(site) ||
    duration !== (site?.duration || '') ||
    hours !== (site?.hours || '') ||
    cost !== (site?.cost || '') ||
    booking !== (site?.bookingRef || '') ||
    JSON.stringify(bags) !== JSON.stringify(asStringList(site?.bags)) ||
    normalizeRichText(transit) !== normalizeRichText(site?.transit || '') ||
    normalizeRichText(summary) !== normalizeRichText(site?.summary || '') ||
    JSON.stringify(vibe) !== JSON.stringify(asStringList(site?.vibe)) ||
    JSON.stringify(mustTry) !== JSON.stringify(asStringList(site?.mustTry))

  const sectionsDirty =
    JSON.stringify(sectionsDraft.notes) !==
      JSON.stringify(site?.notes ?? []) ||
    JSON.stringify(sectionsDraft.logistics) !==
      JSON.stringify(site?.logistics ?? []) ||
    JSON.stringify(sectionsDraft.proTips) !==
      JSON.stringify(site?.proTips ?? []) ||
    JSON.stringify(sectionsDraft.history) !==
      JSON.stringify(site?.history ?? []) ||
    JSON.stringify(sectionsDraft.route) !== JSON.stringify(site?.route ?? [])

  const attachDirty = !attachmentDraftEqual(attachDraft, baselineAttach)
  const stopDirty =
    !isCreate &&
    (time !== stop.time || timedEntry !== Boolean(stop.timedEntry))
  const siteLinkDirty =
    !isCreate &&
    overrideSiteId !== undefined &&
    overrideSiteId !== stop.siteId
  const dirty =
    isCreate ||
    stopDirty ||
    siteAttrsDirty ||
    sectionsDirty ||
    attachDirty ||
    siteLinkDirty

  const nextStop = nextStopInSequence(dayStops, stop.id)
  const durationLabel = displayDuration(stop, nextStop, {
    ...(site ?? emptySiteDraft(title || displayName, kind)),
    kind,
    duration,
  })
  const computedSpanMins = nextStop
    ? spanMinutes(time.trim() || stop.time, nextStop.time)
    : null
  const computedSpan =
    computedSpanMins != null ? formatDurationMinutes(computedSpanMins) : ''

  const saveAll = async () => {
    if (isCreate) {
      if (!onCreate) return
      if (!title.trim() && !effectiveSiteId) {
        await dialog.alert('Enter a site name or choose an existing site')
        return
      }
      setBusy(true)
      try {
        await onCreate(buildSitePayload())
        onClose()
      } catch (e) {
        await dialog.alert(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setBusy(false)
      }
      return
    }

    if (!onSaveStop && !onSaveGuide) return
    setBusy(true)
    try {
      if (onSaveStop && (stopDirty || siteLinkDirty)) {
        await onSaveStop({
          time: time.trim(),
          timedEntry,
          ...(siteLinkDirty ? { siteId: effectiveSiteId } : {}),
        })
      }

      if (
        onSaveGuide &&
        (siteAttrsDirty || sectionsDirty || attachDirty || !site || siteLinkDirty)
      ) {
        const baselineTickets = baselineAttach.tickets
        const removedTicketIds = baselineTickets
          .filter((t) => !attachDraft.tickets.some((x) => x.id === t.id))
          .map((t) => t.id)
        const mapCleared =
          baselineAttach.mapPages.length > 0 && attachDraft.mapPages.length === 0

        for (const id of removedTicketIds) {
          await onRemoveTicket?.(id)
        }
        if (mapCleared) {
          await onRemoveMap?.()
        }

        const draftBase = site
          ? { ...site, attachments: site.attachments ?? [] }
          : emptySiteDraft(title.trim() || displayName, kind)

        await onSaveGuide({
          ...draftBase,
          id: site?.id || '',
          name: title.trim() || displayName,
          kind,
          duration: showDuration(kind) ? duration.trim() : '',
          hours: showHours(kind) ? hours.trim() || null : null,
          summary: normalizeRichText(summary) || null,
          cost: showCost(kind) ? cost.trim() || null : null,
          bookingRef: showTransitExtras(kind) ? booking.trim() || null : null,
          bags: showTransitExtras(kind) ? bags : [],
          transit: showTransitExtras(kind)
            ? normalizeRichText(transit) || null
            : null,
          vibe: showMealExtras(kind) ? vibe : [],
          mustTry: showMealExtras(kind) ? mustTry : [],
          notes: sectionsDraft.notes,
          logistics: sectionsDraft.logistics,
          proTips: sectionsDraft.proTips,
          history: sectionsDraft.history,
          route: sectionsDraft.route,
          mapsUrl: attachDraft.mapsUrl,
          tickets: attachDraft.tickets,
          mapPages: attachDraft.mapPages,
        })
      }

      setOverrideSiteId(undefined)
      setEditing(false)
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
    if (row.type === 'ticket' && nextType === 'map') {
      const ok = await dialog.confirm({
        title: 'Convert to map',
        message: 'Convert this ticket into the venue map?',
        confirmLabel: 'Convert',
      })
      if (!ok) return
      setAttachDraft((d) => ({
        tickets: d.tickets.filter((t) => t.id !== row.id),
        mapPages: row.pages,
        mapsUrl: d.mapsUrl,
      }))
      return
    }
    if (row.type === 'map' && nextType === 'ticket') {
      const label = await dialog.promptText({
        title: 'Ticket label',
        label: 'Label',
        defaultValue: 'Ticket',
        confirmLabel: 'Convert',
      })
      if (!label?.trim()) return
      const ticketId = `ticket-${Date.now().toString(36)}`
      setAttachDraft((d) => ({
        tickets: [
          ...d.tickets,
          { id: ticketId, label: label.trim(), pages: [row.page] },
        ],
        mapPages: d.mapPages.filter((_, i) => i !== row.pageIndex),
        mapsUrl: d.mapsUrl,
      }))
      return
    }
    if (row.type === 'mapsUrl' && nextType !== 'mapsUrl') {
      await dialog.alert('Clear the Map URL and add a Ticket or Map instead.')
      return
    }
    if (nextType === 'mapsUrl') {
      await dialog.alert(
        'Use “Map URL” to set a link. Remove this attachment first if needed.',
      )
    }
  }

  const existingOptions = useMemo(
    () => flatOptionChoices(dayStops),
    [dayStops],
  )
  const showBranch = useMemo(
    () =>
      !isCreate &&
      shouldShowBranchPicker({ ...stop, time }, dayStops),
    [isCreate, stop, time, dayStops],
  )

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

  const syncAttachAfterUpload = () => {
    const s = effectiveSiteId ? getSite(effectiveSiteId) : undefined
    setAttachDraft(attachmentDraftFromSite(s))
  }

  const fieldLabelClass =
    'text-xs font-semibold uppercase tracking-wide text-ink-soft'

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
                      className={cn(inputClass, 'w-24 font-semibold')}
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
                    <label className="flex items-center gap-1.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={timedEntry}
                        onChange={(e) => setTimedEntry(e.target.checked)}
                        className="h-4 w-4 rounded border-line"
                      />
                      <AlarmClock className="h-3.5 w-3.5 text-accent" />
                      Timed
                    </label>
                  </div>
                  {showDuration(kind) ? (
                    <p className="text-[11px] text-ink-soft">
                      Override — blank uses span to next event
                      {computedSpan ? ` (${computedSpan})` : ''}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-accent">
                    {stop.time}
                  </span>
                  {durationLabel ? (
                    <span className="text-xs text-ink-soft">{durationLabel}</span>
                  ) : null}
                  {stop.timedEntry ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      <AlarmClock className="h-3.5 w-3.5" />
                      Timed
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {adminMode && !editing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetFromSite(site)
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
          <div className="space-y-4 border-b border-line/70 p-4">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Site name"
                  className={cn(inputClass, 'text-lg font-bold')}
                />
                <div className="space-y-1.5">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] font-medium text-sea underline-offset-2 hover:underline"
                      onClick={() => setPickerOpen(true)}
                    >
                      Use existing site…
                    </button>
                    {effectiveSiteId ? (
                      <button
                        type="button"
                        className="text-[11px] font-medium text-ink-soft underline-offset-2 hover:underline"
                        onClick={() => void removeSite()}
                      >
                        Remove site
                      </button>
                    ) : null}
                  </div>
                </div>

                {showHours(kind) ? (
                  <label className="block space-y-1">
                    <span className={fieldLabelClass}>Hours</span>
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                          Bags
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void addStringListItem(bags, setBags, 'Bags')
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {bags.length ? (
                        <SortableStringList
                          items={bags}
                          editing
                          onReorder={setBags}
                          onEdit={(i) =>
                            void editStringList(bags, setBags, i, 'Bags')
                          }
                          onRemove={(i) =>
                            setBags(bags.filter((_, j) => j !== i))
                          }
                        />
                      ) : (
                        <p className="text-sm text-ink-soft">No bag rules yet.</p>
                      )}
                    </div>
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
                    Summary
                  </span>
                  <RichTextEditor
                    value={summary}
                    onChange={setSummary}
                    placeholder="Short description…"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-ink">{displayName}</h2>
                {kindLabel ? (
                  <p className="text-xs tracking-wide text-ink-soft">
                    {kindLabel}
                  </p>
                ) : null}
                <dl className="mt-3 space-y-2">
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
                  {details.summary && !isEmptyRichText(details.summary) ? (
                    <div className="grid grid-cols-[88px_1fr] gap-2 text-sm">
                      <dt className="font-semibold text-ink">Summary</dt>
                      <dd className="text-ink-soft">
                        <RichText value={details.summary} />
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </>
            )}

          </div>

          {/* Site sections */}
          {(editing || hasSectionBody || photo) && (
            <div className="space-y-5 border-b border-line/70 p-4">
              {photo && !editing ? (
                <div className="relative -mx-4 -mt-4 h-36 overflow-hidden">
                  <img
                    src={photo}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                </div>
              ) : null}

              <GuideSectionsEditor
                sections={sections
                  .filter((key) => showGuideSection(kind, key))
                  .filter(
                    (key) =>
                      editing || (sectionsDraft[key]?.length ?? 0) > 0,
                  )
                  .map((key) => ({
                    key,
                    label: SECTION_LABELS[key],
                  }))}
                values={sectionsDraft}
                editing={editing}
                onChange={updateAllSections}
                onEdit={(key, i) => void editItem(key, i)}
                onRemove={removeItem}
                onAdd={(key) => void addItem(key)}
              />
            </div>
          )}

          {/* Attachments at bottom of site body */}
          <div className="space-y-4 border-b border-line/70 p-4">
            {editing ? (
              <section className="space-y-2">
                <h3 className={fieldLabelClass}>Attachments</h3>
                {!canUploadAttachments ? (
                  <p className="text-xs text-ink-soft">
                    Map URL can be set now. Tickets and venue maps upload after
                    the event is saved with a linked site.
                  </p>
                ) : null}
                <div className="space-y-2">
                  {attachmentRows.map((row) => (
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
                          {attachDraft.mapPages.length > 1
                            ? `Venue map · ${row.pageIndex + 1}`
                            : 'Venue map'}
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
                              setAttachDraft((d) => ({
                                ...d,
                                tickets: d.tickets.filter(
                                  (t) => t.id !== row.id,
                                ),
                              }))
                            } else if (row.type === 'map') {
                              const ok = await dialog.confirm({
                                title: 'Remove map',
                                message:
                                  attachDraft.mapPages.length > 1
                                    ? `Remove map page ${row.pageIndex + 1}?`
                                    : 'Remove venue map?',
                                confirmLabel: 'Remove',
                                destructive: true,
                              })
                              if (!ok) return
                              setAttachDraft((d) => ({
                                ...d,
                                mapPages: d.mapPages.filter(
                                  (_, i) => i !== row.pageIndex,
                                ),
                              }))
                            } else {
                              const ok = await dialog.confirm({
                                title: 'Clear Map URL',
                                message: 'Clear Map URL?',
                                confirmLabel: 'Clear',
                                destructive: true,
                              })
                              if (!ok) return
                              setAttachDraft((d) => ({ ...d, mapsUrl: null }))
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
                    disabled={busy || !canUploadAttachments}
                    onClick={() => {
                      void (async () => {
                        const label = await dialog.promptText({
                          title: 'Add ticket',
                          label: 'Label',
                          defaultValue: 'Ticket',
                          confirmLabel: 'Add',
                        })
                        if (!label?.trim()) return
                        await run(async () => {
                          await onAddTicket?.(label.trim())
                          syncAttachAfterUpload()
                        })
                      })()
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ticket
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !canUploadAttachments}
                    onClick={() =>
                      void run(async () => {
                        await onAddMap?.()
                        syncAttachAfterUpload()
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />{' '}
                    {attachDraft.mapPages.length ? 'Replace map' : 'Map'}
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
                          defaultValue: attachDraft.mapsUrl ?? '',
                          placeholder: 'https://maps.app.goo.gl/...',
                          required: false,
                          confirmLabel: 'Save',
                        })
                        if (url === null) return
                        setAttachDraft((d) => ({
                          ...d,
                          mapsUrl: url.trim() || null,
                        }))
                      })()
                    }}
                  >
                    <MapPinned className="h-3.5 w-3.5" /> Map URL
                  </Button>
                </div>
              </section>
            ) : viewMapsUrl || viewTickets.length || viewMaps.length ? (
              <div className="flex flex-wrap gap-2">
                {viewMapsUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={viewMapsUrl} target="_blank" rel="noreferrer">
                      <MapPinned className="h-3.5 w-3.5" /> Maps
                    </a>
                  </Button>
                ) : null}
                {viewTickets.length === 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTickets()}
                  >
                    <Ticket className="h-3.5 w-3.5" /> {viewTickets[0].label}
                  </Button>
                ) : viewTickets.length > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTickets()}
                  >
                    <Ticket className="h-3.5 w-3.5" /> Ticket
                    <span className="text-[10px] opacity-70">
                      · {viewTickets.length}
                    </span>
                  </Button>
                ) : null}
                {viewMaps.length && onOpenMap ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMap()}
                  >
                    <MapIcon className="h-3.5 w-3.5" /> Map
                    {viewMaps.length > 1 ? (
                      <span className="text-[10px] opacity-70">
                        · {viewMaps.length}
                      </span>
                    ) : null}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {editing && showBranch ? (
            <section className="border-t border-line p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setBranchOpen((o) => !o)}
                aria-expanded={branchOpen}
              >
                <span className={fieldLabelClass}>
                  Branch
                  {stop.optionLabel ? (
                    <span className="ml-2 font-medium normal-case tracking-normal text-ink">
                      · {stop.optionLabel}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-ink-soft transition-transform',
                    branchOpen && 'rotate-180',
                  )}
                />
              </button>
              {branchOpen ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className={cn(
                        'rounded-lg px-2 py-1.5 text-xs font-medium ring-1',
                        !stop.optionLabel
                          ? 'bg-ink text-paper ring-ink'
                          : 'bg-paper-deep text-ink ring-line',
                      )}
                      disabled={busy}
                      onClick={() => void run(() => onClearOption?.())}
                    >
                      Shared
                    </button>
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
                        disabled={busy}
                        onClick={() =>
                          void run(() => onAssignOption?.(o.label, o.group))
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-ink-soft">
                    {stop.optionLabel
                      ? `Current: ${stop.optionLabel}`
                      : 'Shared path (no option).'}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        {editing || isCreate ? (
          <div className="flex shrink-0 gap-2 border-t border-line p-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                if (isCreate) {
                  onClose()
                  return
                }
                setOverrideSiteId(undefined)
                resetFromSite(getSiteForStop(stop))
                setEditing(false)
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
      <SitePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        defaultKind={kind}
        onSelect={pickExistingSite}
      />
    </div>
  )
}
