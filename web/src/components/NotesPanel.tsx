import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  listNotes,
  saveNote,
  type NoteRow,
} from '@/lib/contentSync'

export function NotesPanel({
  tripId,
  dayId,
}: {
  tripId: string
  dayId: string
}) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [draft, setDraft] = useState('')

  const reload = async () => {
    const all = await listNotes(tripId)
    setNotes(all.filter((n) => !n.day_id || n.day_id === dayId))
  }

  useEffect(() => {
    void reload()
  }, [tripId, dayId])

  const add = async () => {
    const body = draft.trim()
    if (!body) return
    const now = new Date().toISOString()
    await saveNote({
      id: crypto.randomUUID(),
      trip_id: tripId,
      day_id: dayId,
      body,
      record_status: 'active',
      last_modified_on: now,
      created_on: now,
      created_on_device: 'web',
      last_modified_on_device: 'web',
    })
    setDraft('')
    await reload()
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-ink-soft">
        Capture live notes while traveling. They sync when you have a connection.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        spellCheck
        placeholder="What just happened / don’t forget…"
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-sea"
      />
      <Button onClick={() => void add()} disabled={!draft.trim()}>
        Save note
      </Button>
      <ul className="space-y-3">
        {notes.map((n) => (
          <li
            key={n.id}
            className="rounded-xl border border-line/70 bg-paper px-3 py-3 text-sm text-ink"
          >
            <div className="whitespace-pre-wrap">{n.body}</div>
            <div className="mt-2 text-[11px] text-ink-soft">
              {new Date(n.last_modified_on).toLocaleString()}
            </div>
          </li>
        ))}
        {!notes.length ? (
          <li className="text-sm text-ink-soft">No notes for this day yet.</li>
        ) : null}
      </ul>
    </div>
  )
}
