import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import {
  guideHasVisibleContent,
  showGuideSection,
  type GuideSectionKey,
  visibleGuideSections,
} from '@/data/stopFields'
import type { Site, StopKind } from '@/data/types'
import { getSitePhoto } from '@/lib/data'
import { cn } from '@/lib/utils'

const SECTION_LABELS: Record<GuideSectionKey, string> = {
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

  useEffect(() => {
    if (!guides.some((g) => g.id === activeId)) {
      setActiveId(guides[0]?.id ?? '')
    }
  }, [guides, activeId])

  useEffect(() => {
    const next = guides.find((g) => g.id === activeId) ?? guides[0] ?? null
    setDraft(next ? { ...next, attachments: next.attachments ?? [] } : null)
  }, [activeId, guides])

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

  const updateSection = (key: SectionKey, items: string[]) => {
    setDraft({ ...draft, [key]: items })
  }

  const editItem = (key: SectionKey, index: number) => {
    const current = draft[key][index] ?? ''
    const next = window.prompt('Edit item', current)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed) {
      updateSection(
        key,
        draft[key].filter((_, i) => i !== index),
      )
      return
    }
    updateSection(
      key,
      draft[key].map((item, i) => (i === index ? trimmed : item)),
    )
  }

  const removeItem = (key: SectionKey, index: number) => {
    updateSection(
      key,
      draft[key].filter((_, i) => i !== index),
    )
  }

  const addItem = (key: SectionKey) => {
    const next = window.prompt('New item')
    if (!next?.trim()) return
    updateSection(key, [...draft[key], next.trim()])
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
                detail="No logistics, tips, history, or route yet."
              />
            ) : (
              sections.map(({ key, label }) => {
                if (!showGuideSection(stopKind, key)) return null
                const items = draft[key]
                if (!items.length && !adminMode) return null
                return (
                  <section key={key}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-ink">
                        {label}
                      </h3>
                      {adminMode ? (
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
                              {adminMode ? (
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
                    ) : adminMode ? (
                      <p className="text-sm text-ink-soft">No items yet.</p>
                    ) : null}
                  </section>
                )
              })
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
