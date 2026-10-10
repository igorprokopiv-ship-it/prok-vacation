import {
  Map as MapIcon,
  MapPinned,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import type { ItineraryStop, Site, StopKind } from '@/data/types'
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
  const [editing, setEditing] = useState(Boolean(adminMode && initialEditMode))
  const [busy, setBusy] = useState(false)

  const guides = getGuidesForStop(stop)
  const [activeId, setActiveId] = useState(guides[0]?.id ?? '')
  const active = guides.find((g) => g.id === activeId) ?? guides[0]
  const [guideDraft, setGuideDraft] = useState<Site | null>(
    active ? { ...active, attachments: active.attachments ?? [] } : null,
  )

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

  useEffect(() => {
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
  }, [stop])

  useEffect(() => {
    if (!guides.some((g) => g.id === activeId)) {
      setActiveId(guides[0]?.id ?? '')
    }
  }, [guides, activeId])

  useEffect(() => {
    const next = guides.find((g) => g.id === activeId) ?? guides[0] ?? null
    if (next) {
      setGuideDraft({ ...next, attachments: next.attachments ?? [] })
    } else if (editing) {
      setGuideDraft(emptyGuideDraft(stop.title))
    } else {
      setGuideDraft(null)
    }
  }, [activeId, guides, editing, stop.title])

  const photo = guideDraft?.id ? getSitePhoto(guideDraft.id) : undefined
  const hasGuideBody = guideDraft
    ? guideHasVisibleContent(guideDraft, kind)
    : false

  const ensureGuideDraft = () => {
    if (!guideDraft) {
      setGuideDraft(emptyGuideDraft(title.trim() || stop.title))
    }
  }

  const updateSection = (key: GuideSectionKey, items: string[]) => {
    ensureGuideDraft()
    setGuideDraft((d) =>
      d
        ? { ...d, [key]: items }
        : { ...emptyGuideDraft(title.trim() || stop.title), [key]: items },
    )
  }

  const editItem = (key: GuideSectionKey, index: number) => {
    const current = guideDraft?.[key][index] ?? ''
    const next = window.prompt('Edit item', current)
    if (next === null) return
    const trimmed = next.trim()
    const list = guideDraft?.[key] ?? []
    if (!trimmed) {
      updateSection(
        key,
        list.filter((_, i) => i !== index),
      )
      return
    }
    updateSection(
      key,
      list.map((item, i) => (i === index ? trimmed : item)),
    )
  }

  const removeItem = (key: GuideSectionKey, index: number) => {
    const list = guideDraft?.[key] ?? []
    updateSection(
      key,
      list.filter((_, i) => i !== index),
    )
  }

  const addItem = (key: GuideSectionKey) => {
    const next = window.prompt('New item')
    if (!next?.trim()) return
    const list = guideDraft?.[key] ?? []
    updateSection(key, [...list, next.trim()])
  }

  const editStringList = (
    list: string[],
    setList: (next: string[]) => void,
    index: number,
  ) => {
    const current = list[index] ?? ''
    const next = window.prompt('Edit item', current)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed) {
      setList(list.filter((_, i) => i !== index))
      return
    }
    setList(list.map((item, i) => (i === index ? trimmed : item)))
  }

  const addStringListItem = (
    list: string[],
    setList: (next: string[]) => void,
  ) => {
    const next = window.prompt('New item')
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
    transit !== (stop.transit || '') ||
    notes !== (stop.notes || '') ||
    JSON.stringify(vibe) !== JSON.stringify(asStringList(stop.vibe)) ||
    JSON.stringify(mustTry) !== JSON.stringify(asStringList(stop.mustTry))

  const guideDirty =
    Boolean(guideDraft) &&
    (guides.length === 0
      ? sections.some((key) => (guideDraft?.[key]?.length ?? 0) > 0) ||
        (guideDraft?.name ?? '') !== stop.title
      : active &&
        guideDraft &&
        (guideDraft.name !== active.name ||
          sections.some(
            (key) =>
              JSON.stringify(guideDraft[key]) !==
              JSON.stringify(active[key] ?? []),
          )))

  const dirty = stopDirty || Boolean(guideDirty)

  const saveAll = async () => {
    if (!onSaveStop && !onSaveGuide) return
    setBusy(true)
    try {
      if (onSaveStop && stopDirty) {
        await onSaveStop({
          time: time.trim(),
          title: title.trim(),
          kind,
          duration: showDuration(kind) ? duration.trim() : '',
          hours: showHours(kind) ? hours.trim() || null : null,
          notes: notes.trim() || null,
          cost: showCost(kind) ? cost.trim() || null : null,
          bookingRef: showTransitExtras(kind) ? booking.trim() || null : null,
          bags: showTransitExtras(kind) ? bags.trim() || null : null,
          transit: showTransitExtras(kind) ? transit.trim() || null : null,
          vibe: showMealExtras(kind) ? vibe : [],
          mustTry: showMealExtras(kind) ? mustTry : [],
        })
      }
      if (onSaveGuide && guideDraft && guideDirty) {
        const hasContent = sections.some(
          (key) => (guideDraft[key]?.length ?? 0) > 0,
        )
        if (hasContent || guideDraft.id) {
          await onSaveGuide({
            ...guideDraft,
            name: guideDraft.name.trim() || title.trim() || stop.title,
          })
        }
      }
      setEditing(false)
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
          alert('Cannot convert ticket to map')
          return
        }
        if (!confirm('Convert this ticket into the venue map?')) return
        await onConvertTicketToMap(row.id)
        return
      }
      if (row.type === 'map' && nextType === 'ticket') {
        if (!onConvertMapToTicket) {
          alert('Cannot convert map to ticket')
          return
        }
        const label = window.prompt('Ticket label', 'Ticket')
        if (!label?.trim()) return
        await onConvertMapToTicket(label.trim())
        return
      }
      if (row.type === 'mapsUrl' && nextType !== 'mapsUrl') {
        alert('Clear the Map URL and add a Ticket or Map instead.')
        return
      }
      if (nextType === 'mapsUrl') {
        alert('Use “Map URL” to set a link. Remove this attachment first if needed.')
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
                  <div className="flex gap-2">
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
                        placeholder="5h 55m"
                        className={cn(inputClass, 'w-28')}
                      />
                    ) : null}
                  </div>
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
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-bold text-accent">
                      {stop.time}
                    </span>
                    {showDuration(stop.kind) && stop.duration ? (
                      <span className="text-xs text-ink-soft">
                        {stop.duration}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-ink">
                    {stop.title}
                  </h2>
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
                    ensureGuideDraft()
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
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        Transit
                      </span>
                      <input
                        value={transit}
                        onChange={(e) => setTransit(e.target.value)}
                        className={inputClass}
                        placeholder="How you get there"
                      />
                    </label>
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
                          onClick={() => addStringListItem(vibe, setVibe)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {vibe.length ? (
                        <ul className="space-y-2">
                          {vibe.map((item, i) => (
                            <li
                              key={`vibe-edit-${i}`}
                              className="flex items-start justify-between gap-2 rounded-lg bg-paper-deep/70 px-3 py-2 text-sm text-ink-soft"
                            >
                              <span className="min-w-0 flex-1">{item}</span>
                              <span className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                                  aria-label="Edit vibe"
                                  onClick={() =>
                                    editStringList(vibe, setVibe, i)
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-ink-soft hover:bg-paper hover:text-accent"
                                  aria-label="Delete vibe"
                                  onClick={() =>
                                    setVibe(vibe.filter((_, j) => j !== i))
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
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
                            addStringListItem(mustTry, setMustTry)
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {mustTry.length ? (
                        <ul className="space-y-2">
                          {mustTry.map((item, i) => (
                            <li
                              key={`must-edit-${i}`}
                              className="flex items-start justify-between gap-2 rounded-lg bg-paper-deep/70 px-3 py-2 text-sm text-ink-soft"
                            >
                              <span className="min-w-0 flex-1">{item}</span>
                              <span className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                                  aria-label="Edit must try"
                                  onClick={() =>
                                    editStringList(mustTry, setMustTry, i)
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-ink-soft hover:bg-paper hover:text-accent"
                                  aria-label="Delete must try"
                                  onClick={() =>
                                    setMustTry(
                                      mustTry.filter((_, j) => j !== i),
                                    )
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-soft">No items yet.</p>
                      )}
                    </div>
                  </>
                ) : null}
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className={inputClass}
                  />
                </label>
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
                {details.transit ? (
                  <DetailRow label="Transit" value={details.transit} />
                ) : null}
                {details.vibe ? (
                  <DetailRow label="Vibe" value={details.vibe} />
                ) : null}
                {details.mustTry ? (
                  <DetailRow label="Must try" value={details.mustTry} />
                ) : null}
                {details.notes ? (
                  <DetailRow label="Notes" value={details.notes} />
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
                          if (row.type === 'ticket') {
                            if (!confirm('Remove this ticket?')) return
                            void run(() => onRemoveTicket?.(row.id))
                          } else if (row.type === 'map') {
                            if (!confirm('Remove venue map?')) return
                            void run(() => onRemoveMap?.())
                          } else {
                            if (!confirm('Clear Map URL?')) return
                            void run(() => onSetMapsUrl?.(null))
                          }
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
                      const label = window.prompt('Ticket label', 'Ticket')
                      if (!label?.trim()) return
                      void run(() => onAddTicket?.(label.trim()))
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
                      const url = window.prompt(
                        'Google Maps URL',
                        stop.mapsUrl ?? '',
                      )
                      if (url === null) return
                      void run(() => onSetMapsUrl?.(url.trim() || null))
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
          {(editing || hasGuideBody || guides.length > 0) && (
            <>
              {(editing || guides.length > 0) && (
                <div className="border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sea">
                      Guide
                    </p>
                    {editing && guideDraft ? (
                      <input
                        value={guideDraft.name}
                        onChange={(e) =>
                          setGuideDraft({ ...guideDraft, name: e.target.value })
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
                  {guides.length > 1 ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {guides.map((g) => (
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
              )}

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
                  guides.length > 0 ? (
                    <EmptyState
                      title="Guide coming"
                      detail="No logistics, tips, history, or route yet."
                    />
                  ) : null
                ) : (
                  sections.map((key) => {
                    if (!showGuideSection(kind, key)) return null
                    const items = guideDraft?.[key] ?? []
                    if (!items.length && !editing) return null
                    return (
                      <section key={key}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="font-display text-lg font-bold text-ink">
                            {SECTION_LABELS[key]}
                          </h3>
                          {editing ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addItem(key)}
                            >
                              <Plus className="h-3.5 w-3.5" /> Add
                            </Button>
                          ) : null}
                        </div>
                        {items.length ? (
                          <ul className="space-y-2">
                            {items.map((item, i) => (
                              <li
                                key={`${key}-${i}`}
                                className="relative rounded-lg bg-paper-deep/70 px-3 py-2 pl-4 text-sm leading-relaxed text-ink-soft before:absolute before:left-1.5 before:top-3 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="min-w-0 flex-1">{item}</span>
                                  {editing ? (
                                    <span className="flex shrink-0 gap-0.5">
                                      <button
                                        type="button"
                                        className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                                        aria-label="Edit item"
                                        onClick={() => editItem(key, i)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded p-1 text-ink-soft hover:bg-paper hover:text-accent"
                                        aria-label="Delete item"
                                        onClick={() => removeItem(key, i)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : editing ? (
                          <p className="text-sm text-ink-soft">No items yet.</p>
                        ) : null}
                      </section>
                    )
                  })
                )}
              </div>
            </>
          )}

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
                if (active) {
                  setGuideDraft({
                    ...active,
                    attachments: active.attachments ?? [],
                  })
                } else {
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
