import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function SortableStringList({
  items,
  editing,
  onReorder,
  onEdit,
  onRemove,
}: {
  items: string[]
  editing: boolean
  onReorder: (next: string[]) => void
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  if (!items.length) return null

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length)
      return
    const next = [...items]
    const [row] = next.splice(from, 1)
    next.splice(to, 0, row)
    onReorder(next)
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          draggable={editing}
          onDragStart={(e) => {
            if (!editing) return
            setDragIndex(i)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', String(i))
          }}
          onDragOver={(e) => {
            if (!editing || dragIndex == null) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (overIndex !== i) setOverIndex(i)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIndex == null) return
            move(dragIndex, i)
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          className={cn(
            'relative rounded-lg bg-paper-deep/70 px-3 py-2 text-sm leading-relaxed text-ink-soft',
            editing ? 'pl-9' : 'pl-4',
            !editing &&
              'before:absolute before:left-1.5 before:top-3 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent',
            dragIndex === i && 'opacity-50',
            overIndex === i && dragIndex != null && dragIndex !== i
              ? 'ring-2 ring-sea/50'
              : null,
          )}
        >
          <div className="flex items-start justify-between gap-2">
            {editing ? (
              <button
                type="button"
                className="absolute left-1.5 top-2 cursor-grab rounded p-0.5 text-ink-soft hover:bg-paper hover:text-ink active:cursor-grabbing"
                aria-label="Drag to reorder"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : null}
            <span className="min-w-0 flex-1">{item}</span>
            {editing ? (
              <span className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className="rounded p-1 text-ink-soft hover:bg-paper hover:text-ink"
                  aria-label="Edit item"
                  onClick={() => onEdit(i)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-ink-soft hover:bg-paper hover:text-accent"
                  aria-label="Delete item"
                  onClick={() => onRemove(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
