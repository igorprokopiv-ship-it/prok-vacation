import { Button } from '@/components/ui/button'

export type AttachmentPickOption = {
  id: string
  label: string
}

export function AttachmentPicker({
  open,
  onOpenChange,
  title,
  options,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: AttachmentPickOption[]
  onSelect: (id: string) => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <div className="mt-3 flex flex-col gap-2">
          {options.map((opt) => (
            <Button
              key={opt.id}
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              onClick={() => {
                onSelect(opt.id)
                onOpenChange(false)
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
