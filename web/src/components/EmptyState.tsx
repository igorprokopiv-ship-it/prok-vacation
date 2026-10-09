import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  detail,
  className,
}: {
  title: string
  detail?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-line bg-paper-deep/50 px-4 py-8 text-center',
        className,
      )}
    >
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-2 text-sm text-ink-soft">{detail}</p> : null}
    </div>
  )
}
