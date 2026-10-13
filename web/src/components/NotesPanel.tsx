import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
import { Button } from '@/components/ui/button'
import { RichText } from '@/components/RichText'
import { RichTextEditor } from '@/components/RichTextEditor'
import type { ItineraryStop } from '@/data/types'
import {
  deleteNote,
  listNotes,
  saveNote,
  type NoteRow,
} from '@/lib/contentSync'
import { stopTitle } from '@/lib/data'
import { getDeviceUser } from '@/lib/deviceIdentity'
import { isEmptyRichText, normalizeRichText } from '@/lib/richText'

const WHOLE_DAY_ID = '__whole_day__'

function eventLabel(stop: ItineraryStop): string {
  return `${stop.time} · ${stopTitle(stop)}`
}

export function NotesPanel({
  tripId,
  dayId,
  dayStops = [],
  deviceUser,
  adminMode = false,
}: {
  tripId: string
  dayId: string
  dayStops?: ItineraryStop[]
  deviceUser: string
  adminMode?: boolean
}) {
  const dialog = useAppDialog()
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [draft, setDraft] = useState('')
  const [draftStopId, setDraftStopId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editStopId, setEditStopId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<'create' | 'edit' | null>(
    null,
  )

  const author = () => getDeviceUser() || deviceUser

  const stopById = useMemo(() => {
    const map = new Map<string, ItineraryStop>()
    for (const s of dayStops) map.set(s.id, s)
    return map
  }, [dayStops])

  const eventOptions: AttachmentPickOption[] = useMemo(
    () => [
      { id: WHOLE_DAY_ID, label: 'Whole day (no event)' },
      ...dayStops.map((s) => ({
        id: s.id,
        label: eventLabel(s),
      })),
    ],
    [dayStops],
  )

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

  const canDelete = (n: NoteRow) => isOwner(n) || adminMode

  const scopeLabel = (stopId: string | null | undefined) => {
    if (!stopId) return 'Whole day'
    const stop = stopById.get(stopId)
    return stop ? eventLabel(stop) : 'Event · unknown'
  }

  const noteEventLine = (n: NoteRow) => {
    if (!n.stop_id) return null
    const stop = stopById.get(n.stop_id)
    if (!stop) return 'Event · unknown'
    return `Event · ${eventLabel(stop)}`
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
        stop_id: draftStopId,
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
      setDraftStopId(null)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (n: NoteRow) => {
    if (!isOwner(n)) return
    setEditingId(n.id)
    setEditDraft(n.body)
    setEditStopId(n.stop_id ?? null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
    setEditStopId(null)
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
        stop_id: editStopId,
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
    if (!canDelete(n)) return
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

  const onPickEvent = (id: string) => {
    const stopId = id === WHOLE_DAY_ID ? null : id
    if (pickerTarget === 'create') setDraftStopId(stopId)
    else if (pickerTarget === 'edit') setEditStopId(stopId)
    setPickerTarget(null)
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-ink-soft">
        Notes as <span className="font-semibold text-ink">{deviceUser}</span>.
        You can edit or delete your own
        {adminMode ? '; admins can delete any' : ''}. They sync when online.
      </p>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Scope
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !dayStops.length}
            onClick={() => setPickerTarget('create')}
          >
            {scopeLabel(draftStopId)}
          </Button>
        </div>
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
      </div>

      <ul className="space-y-3">
        {notes.map((n) => {
          const mine = isOwner(n)
          const editing = editingId === n.id
          const eventLine = noteEventLine(n)
          return (
            <li
              key={n.id}
              className="rounded-xl border border-line/70 bg-paper px-3 py-3 text-sm text-ink"
            >
              {editing ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Scope
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !dayStops.length}
                      onClick={() => setPickerTarget('edit')}
                    >
                      {scopeLabel(editStopId)}
                    </Button>
                  </div>
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
                <>
                  <RichText value={n.body} />
                  {eventLine ? (
                    <p className="mt-1.5 text-[11px] font-medium text-ink-soft">
                      {eventLine}
                    </p>
                  ) : null}
                </>
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
                {!editing && (mine || canDelete(n)) ? (
                  <div className="flex gap-1">
                    {mine ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => startEdit(n)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    ) : null}
                    {canDelete(n) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    ) : null}
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

      {pickerTarget ? (
        <AttachmentPicker
          open
          onOpenChange={(open) => {
            if (!open) setPickerTarget(null)
          }}
          title="Note scope"
          options={eventOptions}
          onSelect={onPickEvent}
        />
      ) : null}
    </div>
  )
}
