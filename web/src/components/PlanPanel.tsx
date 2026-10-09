import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  listPlanItems,
  savePlanItem,
  type PlanItemRow,
} from '@/lib/contentSync'
import type { Site } from '@/data/types'

export function PlanPanel({
  tripId,
  sites,
}: {
  tripId: string
  sites: Site[]
}) {
  const [items, setItems] = useState<PlanItemRow[]>([])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('todo')

  const reload = async () => {
    setItems(await listPlanItems(tripId))
  }

  useEffect(() => {
    void reload()
  }, [tripId])

  const add = async () => {
    const t = title.trim()
    if (!t) return
    const now = new Date().toISOString()
    await savePlanItem({
      id: crypto.randomUUID(),
      trip_id: tripId,
      kind,
      title: t,
      body: '',
      done: false,
      sort_order: items.length,
      record_status: 'active',
      last_modified_on: now,
    })
    setTitle('')
    await reload()
  }

  const toggle = async (item: PlanItemRow) => {
    await savePlanItem({ ...item, done: !item.done })
    await reload()
  }

  return (
    <div className="space-y-5 pb-8">
      <p className="text-sm text-ink-soft">
        Planning checklist — packing, bookings, and site prep (OneNote replacement).
      </p>

      <div className="flex flex-wrap gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2 py-2 text-sm"
        >
          <option value="todo">Todo</option>
          <option value="packing">Packing</option>
          <option value="booking">Booking</option>
          <option value="site_edit">Site edit</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add item…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
        <Button onClick={() => void add()} disabled={!title.trim()}>
          Add
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/70 px-3 py-3">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => void toggle(item)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span
                  className={`block text-sm font-medium ${item.done ? 'text-ink-soft line-through' : 'text-ink'}`}
                >
                  {item.title}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-ink-soft">
                  {item.kind}
                </span>
              </span>
            </label>
          </li>
        ))}
        {!items.length ? (
          <li className="text-sm text-ink-soft">No plan items yet.</li>
        ) : null}
      </ul>

      <section>
        <h3 className="font-display text-lg font-bold text-ink">Sites matrix</h3>
        <p className="mt-1 text-xs text-ink-soft">
          Logistics · Pro-Tips · History · Route — same columns as your Sites OneNote.
        </p>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {sites.slice(0, 40).map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-line/60 px-3 py-2 text-sm"
            >
              <div className="font-semibold text-ink">{s.name}</div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-ink-soft">
                <span>Logistics {s.logistics.length}</span>
                <span>Pro-Tips {s.proTips.length}</span>
                <span>History {s.history.length}</span>
                <span>Route {s.route.length}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
