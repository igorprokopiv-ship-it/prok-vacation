import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/RichText'
import { RichTextEditor } from '@/components/RichTextEditor'
import {
  deleteNote,
  listNotes,
  saveNote,
  type NoteRow,
} from '@/lib/contentSync'
import { getDeviceUser } from '@/lib/deviceIdentity'
import { isEmptyRichText, normalizeRichText } from '@/lib/richText'

export function NotesPanel({
  tripId,
  dayId,
  deviceUser,
}: {
  tripId: string
  dayId: string
  deviceUser: string
}) {
  const dialog = useAppDialog()
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const author = () => getDeviceUser() || deviceUser

  const reload = async () => {
    const all = await listNotes(tripId)
    setNotes(all.filter((n) => !n.day_id || n.day_id === dayId))
  }

  useEffect(() => {
    void reload()
  }, [tripId, dayId])

  const isOwner = (n: NoteRow) => {
    const me = author()
    return Boolean(me && n.created_by && n.created_by === me)
  }

  const add = async () => {
    const body = normalizeRichText(draft)
    if (!body) return
    const now = new Date().toISOString()
    const who = author()
    setBusy(true)
    try {
      await saveNote({
        id: crypto.randomUUID(),
        trip_id: tripId,
        day_id: dayId,
        body,
        record_status: 'active',
        last_modified_on: now,
        created_on: now,
        created_by: who,
        last_modified_by: who,
        created_on_device: 'web',
        last_modified_on_device: 'web',
      })
      setDraft('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (n: NoteRow) => {
    if (!isOwner(n)) return
    setEditingId(n.id)
    setEditDraft(n.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const saveEdit = async (n: NoteRow) => {
    if (!isOwner(n)) return
    const body = normalizeRichText(editDraft)
    if (!body) {
      await dialog.alert('Note cannot be empty.')
      return
    }
    setBusy(true)
    try {
      await saveNote({
        ...n,
        body,
        last_modified_by: author(),
        last_modified_on_device: 'web',
      })
      cancelEdit()
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (n: NoteRow) => {
    if (!isOwner(n)) return
    const ok = await dialog.confirm({
      title: 'Delete note',
      message: 'Delete this note? It will sync as deleted for everyone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      if (editingId === n.id) cancelEdit()
      await deleteNote(n, author())
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-ink-soft">
        Notes as <span className="font-semibold text-ink">{deviceUser}</span>.
        You can edit or delete your own. They sync when online.
      </p>
      <RichTextEditor
        value={draft}
        onChange={setDraft}
        placeholder="What just happened / don’t forget…"
      />
      <Button
        onClick={() => void add()}
        disabled={busy || isEmptyRichText(draft)}
      >
        Save note
      </Button>
      <ul className="space-y-3">
        {notes.map((n) => {
          const mine = isOwner(n)
          const editing = editingId === n.id
          return (
            <li
              key={n.id}
              className="rounded-xl border border-line/70 bg-paper px-3 py-3 text-sm text-ink"
            >
              {editing ? (
                <div className="space-y-2">
                  <RichTextEditor value={editDraft} onChange={setEditDraft} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy || isEmptyRichText(editDraft)}
                      onClick={() => void saveEdit(n)}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <RichText value={n.body} />
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-ink-soft">
                  {n.created_by ? (
                    <span className="font-semibold text-ink">
                      {n.created_by} ·{' '}
                    </span>
                  ) : null}
                  {new Date(n.last_modified_on).toLocaleString()}
                </div>
                {mine && !editing ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => startEdit(n)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void remove(n)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
        {!notes.length ? (
          <li className="text-sm text-ink-soft">No notes for this day yet.</li>
        ) : null}
      </ul>
    </div>
  )
}
