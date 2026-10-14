import { Download, MapPin, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import { PrintableItinerary } from '@/components/PrintableItinerary'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { listNotes, listVideos, type TripSummary } from '@/lib/contentSync'
import {
  adminCreateTrip,
  adminDownloadTripBackup,
  adminFetchTripBackup,
  adminGetTripMeta,
  adminPatchTrip,
  adminSoftDeleteTrip,
  type VacationBackup,
} from '@/lib/adminApi'
import { cn } from '@/lib/utils'
import { formatLocationLine, type TripLocation } from '@/lib/tripMeta'

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
  const appDialog = useAppDialog()
  const [menuTrip, setMenuTrip] = useState<TripSummary | null>(null)
  const [dialog, setDialog] = useState<
    null | 'create' | 'rename' | 'dates' | 'details' | 'delete' | 'export'
  >(null)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [confirmTitle, setConfirmTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [printBackup, setPrintBackup] = useState<VacationBackup | null>(null)
  /** Survives Radix onOpenChange clearing `dialog` before Save runs. */
  const dialogActionRef = useRef<
    null | 'create' | 'rename' | 'dates' | 'details' | 'delete'
  >(null)
  const [locations, setLocations] = useState<TripLocation[]>([])
  const [usedLocationIds, setUsedLocationIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [contentLocationIds, setContentLocationIds] = useState<Set<string>>(
    () => new Set(),
  )

  const closeFormDialog = () => {
    dialogActionRef.current = null
    setDialog(null)
    setMenuTrip(null)
  }

  const openCreate = () => {
    if (!adminMode) {
      onRequestAdmin?.()
      return
    }
    dialogActionRef.current = 'create'
    setMenuTrip(null)
    setTitle('')
    setStartDate(new Date().toISOString().slice(0, 10))
    setEndDate('')
    setDialog('create')
  }

  const openRename = (t: TripSummary) => {
    dialogActionRef.current = 'rename'
    setMenuTrip(t)
    setTitle(t.title)
    setDialog('rename')
  }

  const openDates = (t: TripSummary) => {
    dialogActionRef.current = 'dates'
    setMenuTrip(t)
    setStartDate(t.start_date?.slice(0, 10) || '')
    setEndDate(t.end_date?.slice(0, 10) || '')
    setDialog('dates')
  }

  const openDetails = async (t: TripSummary) => {
    dialogActionRef.current = 'details'
    setMenuTrip(t)
    setDialog('details')
    setBusy(true)
    try {
      const meta = await adminGetTripMeta(t.slug)
      setLocations(meta.locations?.length ? [...meta.locations] : [])
      setUsedLocationIds(new Set(meta.used_location_ids ?? []))
      const [notes, videos] = await Promise.all([
        listNotes(t.id),
        listVideos(t.id),
      ])
      setContentLocationIds(
        new Set(
          [...notes, ...videos]
            .map((row) => row.location_id)
            .filter((id): id is string => Boolean(id)),
        ),
      )
    } catch (e) {
      await appDialog.alert(e instanceof Error ? e.message : 'Could not load trip')
      closeFormDialog()
    } finally {
      setBusy(false)
    }
  }

  const addLocation = () => {
    setLocations((prev) => [
      ...prev,
      { id: `loc-${crypto.randomUUID().slice(0, 8)}`, name: '' },
    ])
  }

  const updateLocation = (id: string, patch: Partial<TripLocation>) => {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, ...patch } : loc)),
    )
  }

  const removeLocation = async (id: string) => {
    if (usedLocationIds.has(id)) {
      await appDialog.alert(
        'This location is used by one or more days. Remove it from those days first.',
      )
      return
    }
    if (contentLocationIds.has(id)) {
      await appDialog.alert(
        'This location is referenced by notes or videos. Delete or re-scope them first.',
      )
      return
    }
    setLocations((prev) => prev.filter((loc) => loc.id !== id))
  }

  const openDelete = (t: TripSummary) => {
    dialogActionRef.current = 'delete'
    setMenuTrip(t)
    setConfirmTitle('')
    setDialog('delete')
  }

  const openExport = (t: TripSummary) => {
    setMenuTrip(t)
    setDialog('export')
  }

  const downloadBackup = async () => {
    if (!menuTrip) return
    setBusy(true)
    try {
      await adminDownloadTripBackup(menuTrip.slug)
      setDialog(null)
      setMenuTrip(null)
    } catch (e) {
      await appDialog.alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const openPrintable = async () => {
    if (!menuTrip) return
    setBusy(true)
    try {
      const backup = await adminFetchTripBackup(menuTrip.slug)
      setPrintBackup(backup)
      setDialog(null)
      setMenuTrip(null)
    } catch (e) {
      await appDialog.alert(e instanceof Error ? e.message : 'Could not load trip')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    const mode = dialogActionRef.current ?? dialog
    if (!mode || mode === 'export') return

    setBusy(true)
    try {
      if (mode === 'create') {
        if (!title.trim() || !startDate) {
          await appDialog.alert('Title and start date required')
          return
        }
        await adminCreateTrip({
          title: title.trim(),
          start_date: startDate,
          ...(endDate.trim() ? { end_date: endDate.trim() } : {}),
        })
        await onTripsChanged?.()
      } else if (mode === 'rename' && menuTrip) {
        if (!title.trim()) {
          await appDialog.alert('Title required')
          return
        }
        await adminPatchTrip(menuTrip.slug, { title: title.trim() })
        await onTripsChanged?.()
      } else if (mode === 'dates' && menuTrip) {
        if (!startDate) {
          await appDialog.alert('Start date required')
          return
        }
        await adminPatchTrip(menuTrip.slug, {
          start_date: startDate,
          end_date: endDate.trim() || null,
        })
        await onTripsChanged?.()
      } else if (mode === 'details' && menuTrip) {
        const cleaned = locations
          .map((loc) => ({
            id: loc.id,
            name: loc.name.trim(),
            start_date: loc.start_date?.trim() || null,
            end_date: loc.end_date?.trim() || null,
          }))
          .filter((loc) => loc.name)
        await adminPatchTrip(menuTrip.slug, {
          locations: cleaned,
        })
        await onTripsChanged?.()
      } else if (mode === 'delete' && menuTrip) {
        if (confirmTitle.trim() !== menuTrip.title) {
          await appDialog.alert(
            'Type the vacation title exactly to confirm delete',
          )
          return
        }
        await adminSoftDeleteTrip(menuTrip.slug)
        await onTripsChanged?.()
      }
      closeFormDialog()
    } catch (e) {
      await appDialog.alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (printBackup) {
    return (
      <PrintableItinerary
        title={printBackup.trip.title || printBackup.itinerary.title}
        startDate={printBackup.trip.start_date}
        endDate={printBackup.trip.end_date}
        itinerary={printBackup.itinerary}
        sites={printBackup.sites}
        locations={printBackup.trip.locations}
        onClose={() => setPrintBackup(null)}
      />
    )
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
                {t.locations?.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {t.locations.map((loc) => (
                      <li key={loc.id} className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-sea" aria-hidden />
                        {formatLocationLine(loc)}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
                <Button variant="outline" size="sm" onClick={() => openExport(t)}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => openRename(t)}>
                  Rename
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDates(t)}>
                  Dates
                </Button>
                <Button variant="outline" size="sm" onClick={() => void openDetails(t)}>
                  Locations
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
            No trips yet. Sync online, create one (admin), or import a vacation.
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
          Import vacation
        </button>
      ) : null}

      <Dialog
        open={dialog === 'export'}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null)
            setMenuTrip(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export {menuTrip?.title ?? 'vacation'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-soft">
            Choose a printable itinerary or a JSON backup for restore.
          </p>
          <div className="flex flex-col gap-2">
            <Button disabled={busy} onClick={() => void openPrintable()}>
              Printable PDF
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void downloadBackup()}
            >
              Backup JSON
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        key={dialog === 'export' ? 'export-other' : (dialog ?? 'closed')}
        open={Boolean(dialog) && dialog !== 'export'}
        onOpenChange={(o) => {
          if (!o) closeFormDialog()
        }}
      >
        <DialogContent
          className={dialog === 'details' ? 'max-w-md' : 'max-w-sm'}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === 'create'
                ? 'New vacation'
                : dialog === 'rename'
                  ? 'Rename vacation'
                  : dialog === 'dates'
                    ? 'Vacation dates'
                    : dialog === 'details'
                      ? 'Locations'
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
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-soft">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
          ) : null}
          {dialog === 'create' || dialog === 'dates' ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-soft">
                End date (optional)
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
          ) : null}
          {dialog === 'details' ? (
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-soft">
                    Locations
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLocation}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <p className="text-xs text-ink-soft">
                  Use the Notes tab for vacation-wide or location-specific notes.
                </p>
                {!locations.length ? (
                  <p className="text-sm text-ink-soft">
                    Add cities or regions and optional date ranges.
                  </p>
                ) : null}
                {locations.map((loc) => {
                  const unused = !usedLocationIds.has(loc.id)
                  const blocked =
                    usedLocationIds.has(loc.id) ||
                    contentLocationIds.has(loc.id)
                  return (
                    <div
                      key={loc.id}
                      className={cn(
                        'space-y-2 rounded-xl border bg-paper-deep/30 p-3',
                        unused
                          ? 'border-amber-500/70 ring-1 ring-amber-400/40'
                          : 'border-line/80',
                      )}
                    >
                      <div className="flex gap-2">
                        <input
                          value={loc.name}
                          onChange={(e) =>
                            updateLocation(loc.id, { name: e.target.value })
                          }
                          placeholder="Location name"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          className={cn(
                            'shrink-0 rounded-lg p-2 hover:bg-paper-deep',
                            blocked
                              ? 'text-ink-soft/40'
                              : 'text-ink-soft',
                          )}
                          aria-label="Remove location"
                          title={
                            blocked
                              ? 'Remove references from days/notes first'
                              : 'Remove location'
                          }
                          onClick={() => void removeLocation(loc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {unused ? (
                        <p className="text-[11px] font-medium text-amber-800">
                          Not used in days
                        </p>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                            From
                          </span>
                          <input
                            type="date"
                            value={loc.start_date?.slice(0, 10) ?? ''}
                            onChange={(e) =>
                              updateLocation(loc.id, {
                                start_date: e.target.value || null,
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                            To
                          </span>
                          <input
                            type="date"
                            value={loc.end_date?.slice(0, 10) ?? ''}
                            onChange={(e) =>
                              updateLocation(loc.id, {
                                end_date: e.target.value || null,
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
