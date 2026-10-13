import { Bold, Italic, List } from 'lucide-react'
import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import {
  isEmptyRichText,
  normalizeRichText,
  plainToRichHtml,
} from '@/lib/richText'

function runCommand(command: string) {
  // Basic formatting — still the most reliable for a tiny toolbar.
  document.execCommand(command, false)
}

function insertPlainText(text: string) {
  // Prefer insertText so we never bring font/color from the clipboard.
  if (document.queryCommandSupported?.('insertText')) {
    document.execCommand('insertText', false, text)
    return
  }
  const sel = window.getSelection()
  if (!sel?.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  editorRef,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  editorRef?: (el: HTMLDivElement | null) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const lastEmitted = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const next = plainToRichHtml(value)
    // Avoid resetting caret while typing the same content.
    if (normalizeRichText(el.innerHTML) === normalizeRichText(next)) return
    if (document.activeElement === el) return
    el.innerHTML = next || ''
    lastEmitted.current = next
  }, [value])

  const emit = () => {
    const el = ref.current
    if (!el) return
    const html = normalizeRichText(el.innerHTML)
    if (html === lastEmitted.current) return
    lastEmitted.current = html
    onChange(html)
  }

  const empty = isEmptyRichText(value)

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line', className)}>
      <div className="flex gap-0.5 border-b border-line bg-paper-deep/60 px-1.5 py-1">
        <ToolbarButton
          label="Bold"
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('bold')
            emit()
          }}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('italic')
            emit()
          }}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          onMouseDown={(e) => {
            e.preventDefault()
            runCommand('insertUnorderedList')
            emit()
          }}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <div className="relative">
        {empty ? (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-ink-soft/70">
            {placeholder ?? 'Write a note…'}
          </p>
        ) : null}
        <div
          ref={(el) => {
            ref.current = el
            editorRef?.(el)
          }}
          role="textbox"
          aria-multiline
          contentEditable
          suppressContentEditableWarning
          className="rich-text min-h-[7rem] max-h-[40vh] overflow-y-auto px-3 py-2 font-sans text-sm leading-relaxed text-ink outline-none focus:bg-paper"
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            e.preventDefault()
            const text = e.clipboardData.getData('text/plain')
            if (!text) return
            insertPlainText(text)
            emit()
          }}
        />
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  children,
  onMouseDown,
}: {
  label: string
  children: ReactNode
  onMouseDown: (e: MouseEvent) => void
}) {
  // Use a non-labelable element so an ancestor <label> cannot steal
  // focus/keystrokes from the contentEditable onto Bold/Italic/etc.
  return (
    <div
      role="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      className="cursor-pointer rounded-md p-1.5 text-ink-soft hover:bg-paper hover:text-ink"
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  )
}
