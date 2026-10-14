import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
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
import type { TripLocation } from '@/lib/tripMeta'

const VACATION_WIDE_ID = '__vacation__'
const LOCATION_PREFIX = 'loc:'

type NoteScope = {
  location_id: string | null
}

const VACATION_SCOPE: NoteScope = { location_id: null }

function isVacationWide(n: Pick<NoteRow, 'day_id' | 'stop_id' | 'location_id'>) {
  return !n.day_id && !n.stop_id && !n.location_id
}

function isLocationNote(n: Pick<NoteRow, 'location_id'>) {
  return Boolean(n.location_id)
}

/** Vacation-wide on every day; location notes on every day that includes that location. */
function noteMatchesDayView(
  n: NoteRow,
  dayLocationIds: string[],
): boolean {
  if (isLocationNote(n)) {
    return dayLocationIds.includes(n.location_id as string)
  }
  return isVacationWide(n)
}

function pickIdToScope(id: string): NoteScope {
  if (id === VACATION_WIDE_ID) return VACATION_SCOPE
  if (id.startsWith(LOCATION_PREFIX)) {
    return { location_id: id.slice(LOCATION_PREFIX.length) }
  }
  return VACATION_SCOPE
}

export function NotesPanel({
  tripId,
  dayId,
  locations = [],
  dayLocationIds = [],
  deviceUser,
  adminMode = false,
}: {
  tripId: string
  dayId: string
  /** @deprecated day/event scopes removed; kept for call-site compat */
  dayStops?: unknown
  locations?: TripLocation[]
  dayLocationIds?: string[]
  deviceUser: string
  adminMode?: boolean
}) {
  const dialog = useAppDialog()
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [draft, setDraft] = useState('')
  const [draftScope, setDraftScope] = useState<NoteScope>(VACATION_SCOPE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editScope, setEditScope] = useState<NoteScope>(VACATION_SCOPE)
  const [busy, setBusy] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<'create' | 'edit' | null>(
    null,
  )
  const cleanedTrips = useRef(new Set<string>())

  const author = () => getDeviceUser() || deviceUser

  const locationById = useMemo(() => {
    const map = new Map<string, TripLocation>()
    for (const loc of locations) map.set(loc.id, loc)
    return map
  }, [locations])

  const scopeOptions: AttachmentPickOption[] = useMemo(
    () => [
      { id: VACATION_WIDE_ID, label: 'Vacation-wide' },
      ...locations.map((loc) => ({
        id: `${LOCATION_PREFIX}${loc.id}`,
        label: `Location · ${loc.name}`,
      })),
    ],
    [locations],
  )

  const scopeLabel = (scope: NoteScope) => {
    if (scope.location_id) {
      const loc = locationById.get(scope.location_id)
      return loc ? `Location · ${loc.name}` : 'Location · unknown'
    }
    return 'Vacation-wide'
  }

  const noteScopeLine = (n: NoteRow) => {
    if (n.location_id) {
      const loc = locationById.get(n.location_id)
      return loc ? `Location · ${loc.name}` : 'Location · unknown'
    }
    return 'Vacation-wide'
  }

  /** Soft-delete day/event-scoped notes; normalize location notes to trip-wide location scope. */
  const cleanupOtherScopes = async () => {
    if (cleanedTrips.current.has(tripId)) return
    cleanedTrips.current.add(tripId)
    const all = await listNotes(tripId)
    const who = author()
    for (const n of all) {
      if (isVacationWide(n)) continue
      if (isLocationNote(n)) {
        if (n.day_id || n.stop_id) {
          await saveNote({
            ...n,
            day_id: null,
            stop_id: null,
            last_modified_by: who,
            last_modified_on_device: 'web',
          })
        }
        continue
      }
      // Day / event / other scopes → remove
      await deleteNote(n, who)
    }
  }

  const reload = async () => {
    await cleanupOtherScopes()
    const all = await listNotes(tripId)
    const visible = all.filter((n) =>
      noteMatchesDayView(n, dayLocationIds),
    )
    // Stable order: vacation-wide first, then by location name, then modified
    visible.sort((a, b) => {
      const aLoc = a.location_id ? 1 : 0
      const bLoc = b.location_id ? 1 : 0
      if (aLoc !== bLoc) return aLoc - bLoc
      if (a.location_id && b.location_id && a.location_id !== b.location_id) {
        const an = locationById.get(a.location_id)?.name ?? a.location_id
        const bn = locationById.get(b.location_id)?.name ?? b.location_id
        return an.localeCompare(bn)
      }
      return (b.last_modified_on || '').localeCompare(a.last_modified_on || '')
    })
    setNotes(visible)
  }

  useEffect(() => {
    setDraftScope(VACATION_SCOPE)
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, dayId, dayLocationIds.join('|')])

  const isOwner = (n: NoteRow) => {
    const me = author()
    return Boolean(me && n.created_by && n.created_by === me)
  }

  const canDelete = (n: NoteRow) => isOwner(n) || adminMode

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
        day_id: null,
        stop_id: null,
        location_id: draftScope.location_id,
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
      setDraftScope(VACATION_SCOPE)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (n: NoteRow) => {
    if (!isOwner(n)) return
    setEditingId(n.id)
    setEditDraft(n.body)
    setEditScope({ location_id: n.location_id ?? null })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
    setEditScope(VACATION_SCOPE)
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
        day_id: null,
        stop_id: null,
        location_id: editScope.location_id,
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

  const onPickScope = (id: string) => {
    const scope = pickIdToScope(id)
    if (pickerTarget === 'create') setDraftScope(scope)
    else if (pickerTarget === 'edit') setEditScope(scope)
    setPickerTarget(null)
  }

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-ink-soft">
        Notes as <span className="font-semibold text-ink">{deviceUser}</span>.
        Vacation-wide notes appear on every day; location notes on days with that
        location.
        {adminMode ? ' Admins can delete any note.' : ''}
      </p>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Scope
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setPickerTarget('create')}
          >
            {scopeLabel(draftScope)}
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
          const scopeLine = noteScopeLine(n)
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
                      disabled={busy}
                      onClick={() => setPickerTarget('edit')}
                    >
                      {scopeLabel(editScope)}
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
                  <p className="mt-1.5 text-[11px] font-medium text-ink-soft">
                    {scopeLine}
                  </p>
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
          <li className="text-sm text-ink-soft">
            No vacation or location notes yet.
          </li>
        ) : null}
      </ul>

      {pickerTarget ? (
        <AttachmentPicker
          open
          onOpenChange={(open) => {
            if (!open) setPickerTarget(null)
          }}
          title="Note scope"
          options={scopeOptions}
          onSelect={onPickScope}
        />
      ) : null}
    </div>
  )
}
