import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDialog } from '@/components/AppDialogs'
import {
  AttachmentPicker,
  type AttachmentPickOption,
} from '@/components/AttachmentPicker'
import { Button } from '@/components/ui/button'
import {
  deleteVideo,
  listVideoOffline,
  listVideos,
  saveVideo,
  upsertVideoOfflineMark,
  type VideoOfflineRow,
  type VideoRow,
} from '@/lib/contentSync'
import { getDeviceUser } from '@/lib/deviceIdentity'
import type { TripLocation } from '@/lib/tripMeta'
import {
  fetchYoutubeOEmbed,
  offlineMarkStatus,
  parseYoutubeId,
  youtubeThumbUrl,
  youtubeWatchUrl,
  YOUTUBE_OFFLINE_DAYS,
  type OfflineMarkStatus,
} from '@/lib/youtube'

const VACATION_WIDE_ID = '__vacation__'
const LOCATION_PREFIX = 'loc:'

type VideoScope = {
  location_id: string | null
}

const VACATION_SCOPE: VideoScope = { location_id: null }

function isVacationWide(v: Pick<VideoRow, 'location_id'>) {
  return !v.location_id
}

function videoMatchesDayView(v: VideoRow, dayLocationIds: string[]): boolean {
  if (v.location_id) return dayLocationIds.includes(v.location_id)
  return isVacationWide(v)
}

function pickIdToScope(id: string): VideoScope {
  if (id === VACATION_WIDE_ID) return VACATION_SCOPE
  if (id.startsWith(LOCATION_PREFIX)) {
    return { location_id: id.slice(LOCATION_PREFIX.length) }
  }
  return VACATION_SCOPE
}

function statusLabel(status: OfflineMarkStatus): string {
  if (status === 'downloaded') return 'Downloaded'
  if (status === 'expired') return 'Expired — re-download'
  return 'Not downloaded'
}

function statusClass(status: OfflineMarkStatus): string {
  if (status === 'downloaded') return 'text-emerald-800'
  if (status === 'expired') return 'text-amber-800'
  return 'text-ink-soft'
}

export function VideosPanel({
  tripId,
  dayId,
  locations = [],
  dayLocationIds = [],
  deviceUser,
  adminMode = false,
}: {
  tripId: string
  dayId: string
  locations?: TripLocation[]
  dayLocationIds?: string[]
  deviceUser: string
  adminMode?: boolean
}) {
  const dialog = useAppDialog()
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [offlineByVideo, setOfflineByVideo] = useState<
    Map<string, VideoOfflineRow>
  >(new Map())
  const [draftUrl, setDraftUrl] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftScope, setDraftScope] = useState<VideoScope>(VACATION_SCOPE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editScope, setEditScope] = useState<VideoScope>(VACATION_SCOPE)
  const [busy, setBusy] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<'create' | 'edit' | null>(
    null,
  )

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

  const scopeLabel = (scope: VideoScope) => {
    if (scope.location_id) {
      const loc = locationById.get(scope.location_id)
      return loc ? `Location · ${loc.name}` : 'Location · unknown'
    }
    return 'Vacation-wide'
  }

  const videoScopeLine = (v: VideoRow) => {
    if (v.location_id) {
      const loc = locationById.get(v.location_id)
      return loc ? `Location · ${loc.name}` : 'Location · unknown'
    }
    return 'Vacation-wide'
  }

  const reload = async () => {
    const who = author()
    const [all, offline] = await Promise.all([
      listVideos(tripId),
      listVideoOffline(tripId),
    ])
    const visible = all.filter((v) => videoMatchesDayView(v, dayLocationIds))
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
    setVideos(visible)

    const mine = new Map<string, VideoOfflineRow>()
    for (const row of offline) {
      if (row.user_name === who) mine.set(row.video_id, row)
    }
    setOfflineByVideo(mine)
  }

  useEffect(() => {
    setDraftScope(VACATION_SCOPE)
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, dayId, dayLocationIds.join('|')])

  const isOwner = (v: VideoRow) => {
    const me = author()
    return Boolean(me && v.created_by && v.created_by === me)
  }

  const canDelete = (v: VideoRow) => isOwner(v) || adminMode

  const resolveMeta = async (youtubeId: string, titleHint: string) => {
    const meta = await fetchYoutubeOEmbed(youtubeId)
    return {
      title: titleHint.trim() || meta?.title || youtubeId,
      thumbnail_url: meta?.thumbnail_url || youtubeThumbUrl(youtubeId),
    }
  }

  const add = async () => {
    const youtubeId = parseYoutubeId(draftUrl)
    if (!youtubeId) {
      await dialog.alert('Paste a valid YouTube URL or video id.')
      return
    }
    const now = new Date().toISOString()
    const who = author()
    setBusy(true)
    try {
      const meta = await resolveMeta(youtubeId, draftTitle)
      await saveVideo({
        id: crypto.randomUUID(),
        trip_id: tripId,
        location_id: draftScope.location_id,
        youtube_id: youtubeId,
        url: youtubeWatchUrl(youtubeId),
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        body: '',
        record_status: 'active',
        last_modified_on: now,
        created_on: now,
        created_by: who,
        last_modified_by: who,
        created_on_device: 'web',
        last_modified_on_device: 'web',
      })
      setDraftUrl('')
      setDraftTitle('')
      setDraftScope(VACATION_SCOPE)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (v: VideoRow) => {
    if (!isOwner(v)) return
    setEditingId(v.id)
    setEditUrl(v.url || youtubeWatchUrl(v.youtube_id))
    setEditTitle(v.title || '')
    setEditScope({ location_id: v.location_id ?? null })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditUrl('')
    setEditTitle('')
    setEditScope(VACATION_SCOPE)
  }

  const saveEdit = async (v: VideoRow) => {
    if (!isOwner(v)) return
    const youtubeId = parseYoutubeId(editUrl)
    if (!youtubeId) {
      await dialog.alert('Paste a valid YouTube URL or video id.')
      return
    }
    setBusy(true)
    try {
      const meta = await resolveMeta(youtubeId, editTitle)
      await saveVideo({
        ...v,
        location_id: editScope.location_id,
        youtube_id: youtubeId,
        url: youtubeWatchUrl(youtubeId),
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        last_modified_by: author(),
        last_modified_on_device: 'web',
      })
      cancelEdit()
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (v: VideoRow) => {
    if (!canDelete(v)) return
    const ok = await dialog.confirm({
      title: 'Delete video',
      message: 'Delete this video? It will sync as deleted for everyone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      if (editingId === v.id) cancelEdit()
      await deleteVideo(v, author())
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const toggleOffline = async (v: VideoRow, downloaded: boolean) => {
    const who = author()
    if (!who) return
    setBusy(true)
    try {
      await upsertVideoOfflineMark({
        tripId,
        videoId: v.id,
        userName: who,
        downloaded,
      })
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
        Research videos as{' '}
        <span className="font-semibold text-ink">{deviceUser}</span>.
        Vacation-wide on every day; location videos on days with that location.
        Mark <span className="font-semibold text-ink">Downloaded in YouTube</span>{' '}
        after saving offline in the YouTube app (expires after about{' '}
        {YOUTUBE_OFFLINE_DAYS} days).
        {adminMode ? ' Admins can delete any video.' : ''}
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
        <input
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="YouTube URL or video id"
          disabled={busy}
        />
        <input
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Title (optional — filled from YouTube when online)"
          disabled={busy}
        />
        <Button
          onClick={() => void add()}
          disabled={busy || !draftUrl.trim()}
        >
          Save video
        </Button>
      </div>

      <ul className="space-y-3">
        {videos.map((v) => {
          const mine = isOwner(v)
          const editing = editingId === v.id
          const scopeLine = videoScopeLine(v)
          const offline = offlineByVideo.get(v.id)
          const status = offlineMarkStatus(offline?.downloaded_at)
          const thumb = v.thumbnail_url || youtubeThumbUrl(v.youtube_id)
          const watchUrl = v.url || youtubeWatchUrl(v.youtube_id)
          return (
            <li
              key={v.id}
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
                  <input
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    disabled={busy}
                  />
                  <input
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    disabled={busy}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy || !editUrl.trim()}
                      onClick={() => void saveEdit(v)}
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
                <div className="flex gap-3">
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-paper-deep"
                  >
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </a>
                  <div className="min-w-0 flex-1">
                    <a
                      href={watchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-ink hover:underline"
                    >
                      {v.title || v.youtube_id}
                    </a>
                    <p className="mt-1 text-[11px] font-medium text-ink-soft">
                      {scopeLine}
                    </p>
                    <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={status !== 'missing'}
                        disabled={busy}
                        onChange={(e) =>
                          void toggleOffline(v, e.target.checked)
                        }
                      />
                      <span>
                        <span className="font-medium text-ink">
                          Downloaded in YouTube
                        </span>
                        <span className={`ml-1 ${statusClass(status)}`}>
                          ({statusLabel(status)})
                        </span>
                        {status === 'expired' ? (
                          <button
                            type="button"
                            className="ml-2 underline"
                            disabled={busy}
                            onClick={() => void toggleOffline(v, true)}
                          >
                            Mark re-downloaded
                          </button>
                        ) : null}
                      </span>
                    </label>
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-ink-soft">
                  {v.created_by ? (
                    <span className="font-semibold text-ink">
                      {v.created_by} ·{' '}
                    </span>
                  ) : null}
                  {new Date(v.last_modified_on).toLocaleString()}
                </div>
                {!editing ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={watchUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </Button>
                    {mine ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => startEdit(v)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    ) : null}
                    {canDelete(v) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(v)}
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
        {!videos.length ? (
          <li className="text-sm text-ink-soft">
            No vacation or location videos yet.
          </li>
        ) : null}
      </ul>

      {pickerTarget ? (
        <AttachmentPicker
          open
          onOpenChange={(open) => {
            if (!open) setPickerTarget(null)
          }}
          title="Video scope"
          options={scopeOptions}
          onSelect={onPickScope}
        />
      ) : null}
    </div>
  )
}
