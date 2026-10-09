import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ItineraryDay } from '@/data/types'
import { cn } from '@/lib/utils'

export function DayDrawer({
  open,
  onOpenChange,
  days,
  currentId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  days: ItineraryDay[]
  currentId: string
  onSelect: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pb-8">
        <DialogHeader>
          <DialogTitle>Pick a day</DialogTitle>
          <DialogDescription>One day at a time — jump anywhere in the tour.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
          {days.map((day) => (
            <li key={day.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(day.id)
                  onOpenChange(false)
                }}
                className={cn(
                  'w-full rounded-xl px-3 py-3 text-left transition-colors',
                  day.id === currentId
                    ? 'bg-ink text-paper'
                    : 'bg-paper-deep/60 text-ink hover:bg-paper-deep',
                )}
              >
                <div className="text-sm font-semibold">{day.navLabel}</div>
                <div
                  className={cn(
                    'mt-0.5 text-xs',
                    day.id === currentId ? 'text-paper/75' : 'text-ink-soft',
                  )}
                >
                  {day.headline}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
