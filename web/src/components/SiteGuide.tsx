import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { GuideSectionsEditor } from '@/components/GuideSectionsEditor'
import {
  guideHasVisibleContent,
  type GuideSectionKey,
  visibleGuideSections,
} from '@/data/stopFields'
import type { Site, StopKind } from '@/data/types'
import { getSitePhoto } from '@/lib/data'
import { cn } from '@/lib/utils'

const SECTION_LABELS: Record<GuideSectionKey, string> = {
  notes: 'Notes',
  logistics: 'Logistics',
  proTips: 'Pro-Tips',
  history: 'History',
  route: 'The Route',
}

type SectionKey = GuideSectionKey

export function SiteGuide({
  guides,
  onClose,
  adminMode = false,
  onSaveGuide,
  stopKind = 'attraction',
}: {
  guides: Site[]
  onClose: () => void
  adminMode?: boolean
  onSaveGuide?: (guide: Site) => void | Promise<void>
  /** Filters which guide sections are shown / editable. */
  stopKind?: StopKind
}) {
  const dialog = useAppDialog()
  const sections = useMemo(
    () =>
      visibleGuideSections(stopKind).map((key) => ({
        key,
        label: SECTION_LABELS[key],
      })),
    [stopKind],
  )
  const [activeId, setActiveId] = useState(guides[0]?.id ?? '')
  const active = guides.find((g) => g.id === activeId) ?? guides[0]
  const [draft, setDraft] = useState<Site | null>(active ?? null)
  const [busy, setBusy] = useState(false)

  const guideIdsKey = guides.map((g) => g.id).join('|')

  useEffect(() => {
    if (!guides.some((g) => g.id === activeId)) {
      setActiveId(guides[0]?.id ?? '')
    }
  }, [guideIdsKey, activeId, guides])

  useEffect(() => {
    const next = guides.find((g) => g.id === activeId) ?? guides[0] ?? null
    setDraft((d) => {
      if (d && next && d.id === next.id) return d
      return next ? { ...next, attachments: next.attachments ?? [] } : null
    })
  }, [activeId, guideIdsKey, guides])

  if (!guides.length || !draft) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-3 sm:items-center">
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-xl font-bold">Guide</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </header>
          <div className="p-4">
            <EmptyState
              title="No guide yet"
              detail="Link a guide from Schedule → Manage to add logistics, tips, history, and route."
            />
          </div>
        </div>
      </div>
    )
  }

  const photo = getSitePhoto(draft.id)
  const hasContent = guideHasVisibleContent(draft, stopKind)

  const editItem = async (key: SectionKey, index: number) => {
    const current = draft[key][index] ?? ''
    const next = await dialog.promptRichText({
      title: 'Edit item',
      label: SECTION_LABELS[key],
      defaultValue: current,
      required: false,
      confirmLabel: 'Save',
    })
    if (next === null) return
    setDraft((d) => {
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

  const removeItem = (key: SectionKey, index: number) => {
    setDraft((d) => {
      if (!d) return d
      return { ...d, [key]: (d[key] ?? []).filter((_, i) => i !== index) }
    })
  }

  const addItem = async (key: SectionKey) => {
    const next = await dialog.promptRichText({
      title: 'Add note',
      message: `Starts in ${SECTION_LABELS[key]} — drag to another section anytime.`,
      label: 'Note',
      confirmLabel: 'Add',
    })
    if (!next) return
    setDraft((d) => {
      if (!d) return d
      return { ...d, [key]: [...(d[key] ?? []), next] }
    })
  }

  const save = async () => {
    if (!onSaveGuide) return
    setBusy(true)
    try {
      await onSaveGuide(draft)
    } finally {
      setBusy(false)
    }
  }

  const dirty =
    adminMode &&
    active &&
    (draft.name !== active.name ||
      sections.some(
        ({ key }) =>
          JSON.stringify(draft[key]) !== JSON.stringify(active[key] ?? []),
      ))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-line bg-paper/95 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sea">
                Guide
              </p>
              {adminMode ? (
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="mt-0.5 w-full truncate border-0 bg-transparent font-display text-xl font-bold text-ink outline-none ring-0"
                />
              ) : (
                <h2 className="truncate font-display text-xl font-bold text-ink">
                  {draft.name}
                </h2>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
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
                    g.id === draft.id
                      ? 'bg-sea text-white'
                      : 'bg-paper-deep text-ink-soft ring-1 ring-line',
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {photo ? (
            <div className="relative h-36 w-full overflow-hidden">
              <img
                src={photo}
                alt={draft.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
            </div>
          ) : null}

          <div className="space-y-5 p-4 pb-6">
            {!hasContent && !adminMode ? (
              <EmptyState
                title="Guide coming"
                detail="No notes, logistics, tips, history, or route yet."
              />
            ) : (
              <>
                {adminMode ? (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-deep/50 px-3 py-2">
                    <p className="text-xs text-ink-soft">
                      Drag notes between sections to categorize.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void addItem('notes')}
                    >
                      <Plus className="h-3.5 w-3.5" /> Note
                    </Button>
                  </div>
                ) : null}
                <GuideSectionsEditor
                  sections={sections.filter(
                    ({ key }) =>
                      adminMode || (draft[key]?.length ?? 0) > 0,
                  )}
                  values={{
                    notes: draft.notes ?? [],
                    logistics: draft.logistics,
                    proTips: draft.proTips,
                    history: draft.history,
                    route: draft.route,
                  }}
                  editing={adminMode}
                  onChange={(next) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            notes: next.notes,
                            logistics: next.logistics,
                            proTips: next.proTips,
                            history: next.history,
                            route: next.route,
                          }
                        : d,
                    )
                  }
                  onEdit={(key, i) => void editItem(key, i)}
                  onRemove={removeItem}
                  onAdd={(key) => void addItem(key)}
                />
              </>
            )}
          </div>
        </div>

        {adminMode && dirty ? (
          <div className="shrink-0 border-t border-line p-3">
            <Button className="w-full" disabled={busy} onClick={() => void save()}>
              Save guide
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
