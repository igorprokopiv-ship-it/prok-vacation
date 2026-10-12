import { cn } from '@/lib/utils'
import {
  looksLikeHtml,
  normalizeRichText,
  plainToRichHtml,
} from '@/lib/richText'

/** Read-only rich text (or legacy plain) guide node body. */
export function RichText({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const html = looksLikeHtml(value)
    ? normalizeRichText(value)
    : plainToRichHtml(value)

  if (!html) return null

  return (
    <div
      className={cn('rich-text min-w-0 flex-1', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
