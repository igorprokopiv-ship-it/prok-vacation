import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/RichText'
import type { GuideSectionKey } from '@/data/stopFields'
import { cn } from '@/lib/utils'

const DRAG_MIME = 'application/x-prok-guide-item'

type DragPayload = {
  fromKey: GuideSectionKey
  fromIndex: number
}

function parsePayload(raw: string): DragPayload | null {
  try {
    const data = JSON.parse(raw) as DragPayload
    if (!data?.fromKey || typeof data.fromIndex !== 'number') return null
    return data
  } catch {
    return null
  }
}

function moveItem(
  values: Record<GuideSectionKey, string[]>,
  fromKey: GuideSectionKey,
  fromIndex: number,
  toKey: GuideSectionKey,
  toIndex: number,
): Record<GuideSectionKey, string[]> {
  const fromList = [...(values[fromKey] ?? [])]
  if (fromIndex < 0 || fromIndex >= fromList.length) return values
  const [row] = fromList.splice(fromIndex, 1)
  if (fromKey === toKey) {
    let insertAt = Math.max(0, Math.min(toIndex, fromList.length + 1))
    if (fromIndex < insertAt) insertAt -= 1
    insertAt = Math.max(0, Math.min(insertAt, fromList.length))
    fromList.splice(insertAt, 0, row)
    return { ...values, [fromKey]: fromList }
  }
  const toList = [...(values[toKey] ?? [])]
  const insertAt = Math.max(0, Math.min(toIndex, toList.length))
  toList.splice(insertAt, 0, row)
  return { ...values, [fromKey]: fromList, [toKey]: toList }
}

export function GuideSectionsEditor({
  sections,
  values,
  editing,
  onChange,
  onEdit,
  onRemove,
  onAdd,
}: {
  sections: { key: GuideSectionKey; label: string }[]
  values: Record<GuideSectionKey, string[]>
  editing: boolean
  onChange: (next: Record<GuideSectionKey, string[]>) => void
  onEdit: (key: GuideSectionKey, index: number) => void
  onRemove: (key: GuideSectionKey, index: number) => void
  onAdd: (key: GuideSectionKey) => void
}) {
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [over, setOver] = useState<{
    key: GuideSectionKey
    index: number
  } | null>(null)

  const applyDrop = (toKey: GuideSectionKey, toIndex: number) => {
    if (!drag) return
    onChange(moveItem(values, drag.fromKey, drag.fromIndex, toKey, toIndex))
    setDrag(null)
    setOver(null)
  }

  return (
    <div className="space-y-5">
      {sections.map(({ key, label }) => {
        const items = values[key] ?? []
        return (
          <section
            key={key}
            onDragOver={(e) => {
              if (!editing || !drag) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              // Empty section (or drop on header area): append
              if (!items.length) {
                setOver({ key, index: 0 })
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              const payload =
                drag ?? parsePayload(e.dataTransfer.getData(DRAG_MIME))
              if (!payload) return
              const toIndex =
                over?.key === key ? over.index : items.length
              onChange(
                moveItem(
                  values,
                  payload.fromKey,
                  payload.fromIndex,
                  key,
                  toIndex,
                ),
              )
              setDrag(null)
              setOver(null)
            }}
          >
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {label}
            </h3>

            {items.length ? (
              <ul className="space-y-2">
                {items.map((item, i) => {
                  const isOver =
                    over?.key === key &&
                    over.index === i &&
                    drag != null &&
                    !(drag.fromKey === key && drag.fromIndex === i)
                  return (
                    <li
                      key={`${key}-${i}-${item.slice(0, 20)}`}
                      draggable={editing}
                      onDragStart={(e) => {
                        if (!editing) return
                        const payload = { fromKey: key, fromIndex: i }
                        setDrag(payload)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData(
                          DRAG_MIME,
                          JSON.stringify(payload),
                        )
                        e.dataTransfer.setData('text/plain', item.slice(0, 40))
                      }}
                      onDragOver={(e) => {
                        if (!editing || !drag) return
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = 'move'
                        // Insert before this item when pointer is in top half
                        const rect = e.currentTarget.getBoundingClientRect()
                        const before = e.clientY < rect.top + rect.height / 2
                        const index = before ? i : i + 1
                        if (over?.key !== key || over.index !== index) {
                          setOver({ key, index })
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const before = e.clientY < rect.top + rect.height / 2
                        applyDrop(key, before ? i : i + 1)
                      }}
                      onDragEnd={() => {
                        setDrag(null)
                        setOver(null)
                      }}
                      className={cn(
                        'relative rounded-lg bg-paper-deep/70 px-3 py-2 text-sm leading-relaxed text-ink-soft',
                        editing && 'pl-9',
                        drag?.fromKey === key &&
                          drag.fromIndex === i &&
                          'opacity-40',
                        isOver && 'ring-2 ring-sea/60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {editing ? (
                          <button
                            type="button"
                            className="absolute left-1.5 top-2 cursor-grab rounded p-0.5 text-ink-soft hover:bg-paper hover:text-ink active:cursor-grabbing"
                            aria-label="Drag to reorder or move section"
                            title="Drag within or between sections"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        ) : null}
                        <RichText
                          value={item}
                          className="text-sm leading-relaxed text-ink-soft"
                        />
                        {editing ? (
                          <span className="flex shrink-0 gap-0.5">
                            <button
                              type="button"
                              className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                              aria-label="Edit item"
                              onClick={() => onEdit(key, i)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-ink-soft hover:bg-paper hover:text-accent"
                              aria-label="Delete item"
                              onClick={() => onRemove(key, i)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : editing ? (
              <div
                className={cn(
                  'rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-soft',
                  over?.key === key && drag
                    ? 'border-sea bg-sea/5 text-sea'
                    : null,
                )}
              >
                {drag
                  ? `Drop here to move to ${label}`
                  : 'No items yet — add one below, or drag a note here.'}
              </div>
            ) : null}

            {editing ? (
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAdd(key)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
