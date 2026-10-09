import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  adminMode = false,
  onAddDay,
  onRemoveDay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  days: ItineraryDay[]
  currentId: string
  onSelect: (id: string) => void
  adminMode?: boolean
  onAddDay?: () => void
  onRemoveDay?: (dayId: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pb-8">
        <DialogHeader>
          <DialogTitle>Pick a day</DialogTitle>
          <DialogDescription>One day at a time — jump anywhere in the tour.</DialogDescription>
        </DialogHeader>
        {adminMode && onAddDay ? (
          <Button variant="outline" size="sm" className="w-full" onClick={onAddDay}>
            <Plus className="h-3.5 w-3.5" /> Add day
          </Button>
        ) : null}
        <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
          {days.map((day) => (
            <li key={day.id} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => {
                  onSelect(day.id)
                  onOpenChange(false)
                }}
                className={cn(
                  'min-w-0 flex-1 rounded-xl px-3 py-3 text-left transition-colors',
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
              {adminMode && onRemoveDay ? (
                <button
                  type="button"
                  className="rounded-xl px-2 text-ink-soft hover:bg-paper-deep hover:text-accent"
                  aria-label={`Remove ${day.navLabel}`}
                  onClick={() => onRemoveDay(day.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
