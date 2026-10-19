import type { SyncStatus } from '@/lib/contentSync'

export function SyncChip({
  status,
  detail,
  onClick,
}: {
  status: SyncStatus
  detail?: string
  onClick?: () => void
}) {
  const label =
    status === 'offline'
      ? 'Offline'
      : status === 'checking'
        ? detail || 'Checking…'
        : status === 'downloading'
          ? detail || 'Downloading…'
          : status === 'synced'
            ? 'Synced'
            : status === 'error'
              ? 'Tap to retry'
              : 'Downloading…'

  const tone =
    status === 'offline'
      ? 'bg-ink/10 text-ink-soft'
      : status === 'error'
        ? 'bg-accent/15 text-accent'
        : status === 'synced'
          ? 'bg-sea/15 text-sea'
          : 'bg-sea/10 text-sea'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {label}
    </button>
  )
}
