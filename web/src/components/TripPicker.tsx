import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TripSummary } from '@/lib/contentSync'
import {
  adminCreateTrip,
  adminPatchTrip,
  adminSoftDeleteTrip,
} from '@/lib/adminApi'

const inputClass =
  'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea'

export function TripPicker({
  trips,
  onSelect,
  onImportClick,
  adminMode = false,
  onTripsChanged,
  onRequestAdmin,
}: {
  trips: TripSummary[]
  onSelect: (trip: TripSummary) => void
  onImportClick?: () => void
  adminMode?: boolean
  onTripsChanged?: () => void | Promise<void>
  onRequestAdmin?: () => void
}) {
  const [menuTrip, setMenuTrip] = useState<TripSummary | null>(null)
  const [dialog, setDialog] = useState<
    null | 'create' | 'rename' | 'dates' | 'delete'
  >(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [confirmTitle, setConfirmTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    if (!adminMode) {
      onRequestAdmin?.()
      return
    }
    setTitle('')
    setStartDate(new Date().toISOString().slice(0, 10))
    setDialog('create')
  }

  const openRename = (t: TripSummary) => {
    setMenuTrip(t)
    setTitle(t.title)
    setDialog('rename')
  }

  const openDates = (t: TripSummary) => {
    setMenuTrip(t)
    setStartDate(t.start_date?.slice(0, 10) || '')
    setDialog('dates')
  }

  const openDelete = (t: TripSummary) => {
    setMenuTrip(t)
    setConfirmTitle('')
    setDialog('delete')
  }

  const submit = async () => {
    setBusy(true)
    try {
      if (dialog === 'create') {
        if (!title.trim() || !startDate) {
          alert('Title and start date required')
          return
        }
        await adminCreateTrip({ title: title.trim(), start_date: startDate })
        await onTripsChanged?.()
      } else if (dialog === 'rename' && menuTrip) {
        if (!title.trim()) {
          alert('Title required')
          return
        }
        await adminPatchTrip(menuTrip.slug, { title: title.trim() })
        await onTripsChanged?.()
      } else if (dialog === 'dates' && menuTrip) {
        if (!startDate) {
          alert('Start date required')
          return
        }
        await adminPatchTrip(menuTrip.slug, { start_date: startDate })
        await onTripsChanged?.()
      } else if (dialog === 'delete' && menuTrip) {
        if (confirmTitle.trim() !== menuTrip.title) {
          alert('Type the vacation title exactly to confirm delete')
          return
        }
        await adminSoftDeleteTrip(menuTrip.slug)
        await onTripsChanged?.()
      }
      setDialog(null)
      setMenuTrip(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-svh w-full max-w-lg px-4 pb-16 pt-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
        Prok Vacation
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Your trips</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Each trip works offline after a quick sync. Pick one to open.
          </p>
        </div>
        {adminMode ? (
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New
          </Button>
        ) : null}
      </div>

      <ul className="mt-8 space-y-3">
        {trips.map((t) => (
          <li key={t.id}>
            <div className="flex items-stretch gap-1 rounded-2xl border border-line/80 bg-paper shadow-sm">
              <button
                type="button"
                onClick={() => onSelect(t)}
                className="min-w-0 flex-1 px-4 py-4 text-left transition hover:bg-paper-deep/40"
              >
                <div className="font-display text-lg font-bold text-ink">{t.title}</div>
                <div className="mt-1 text-sm text-ink-soft">
                  {[t.start_date, t.end_date].filter(Boolean).join(' → ') || t.slug}
                  {t.status ? ` · ${t.status}` : ''}
                </div>
              </button>
              {adminMode ? (
                <div className="flex flex-col justify-center gap-1 border-l border-line/60 px-2 py-2">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-ink-soft hover:bg-paper-deep"
                    aria-label={`Manage ${t.title}`}
                    onClick={() => setMenuTrip(menuTrip?.id === t.id ? null : t)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
            {adminMode && menuTrip?.id === t.id && dialog === null ? (
              <div className="mt-1 flex flex-wrap gap-2 rounded-xl bg-paper-deep/50 p-2">
                <Button variant="outline" size="sm" onClick={() => openRename(t)}>
                  Rename
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDates(t)}>
                  Start date
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDelete(t)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {!trips.length ? (
          <li className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            No trips yet. Sync online, create one (admin), or import a content pack.
          </li>
        ) : null}
      </ul>

      {!adminMode ? (
        <button
          type="button"
          onClick={() => onRequestAdmin?.()}
          className="mt-4 w-full text-center text-sm font-medium text-sea"
        >
          Unlock admin to create or manage vacations
        </button>
      ) : null}

      {onImportClick ? (
        <button
          type="button"
          onClick={onImportClick}
          className="mt-6 w-full rounded-xl border border-line py-3 text-sm font-semibold text-sea"
        >
          Import historical trip pack (.zip)
        </button>
      ) : null}

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'create'
                ? 'New vacation'
                : dialog === 'rename'
                  ? 'Rename vacation'
                  : dialog === 'dates'
                    ? 'Change start date'
                    : 'Delete vacation'}
            </DialogTitle>
          </DialogHeader>
          {dialog === 'create' || dialog === 'rename' ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vacation title"
              className={inputClass}
            />
          ) : null}
          {dialog === 'create' || dialog === 'dates' ? (
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          ) : null}
          {dialog === 'delete' && menuTrip ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                Soft-deletes this vacation (hidden from lists; files kept). Type{' '}
                <span className="font-semibold text-ink">{menuTrip.title}</span> to
                confirm.
              </p>
              <input
                value={confirmTitle}
                onChange={(e) => setConfirmTitle(e.target.value)}
                placeholder="Type title to confirm"
                className={inputClass}
              />
            </div>
          ) : null}
          <Button disabled={busy} onClick={() => void submit()}>
            {dialog === 'delete' ? 'Soft delete' : 'Save'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
