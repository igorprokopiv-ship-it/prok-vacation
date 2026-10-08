import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'

export function ImageViewer({
  title,
  pages,
  emptyTitle,
  emptyDetail,
  onClose,
}: {
  title: string
  pages: string[]
  emptyTitle: string
  emptyDetail?: string
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    setIndex(0)
    setZoom(1)
  }, [pages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(pages.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pages.length])

  if (!pages.length) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-ink/95 p-4 text-paper">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-paper hover:bg-white/10">
            <X />
          </Button>
        </header>
        <EmptyState title={emptyTitle} detail={emptyDetail} className="bg-white/5 text-paper border-white/20" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink">
      <header className="flex items-center justify-between gap-2 px-3 py-3 text-paper">
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
          <p className="text-xs text-white/70">
            Page {index + 1} of {pages.length}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-paper hover:bg-white/10"
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-paper hover:bg-white/10"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-paper hover:bg-white/10">
            <X />
          </Button>
        </div>
      </header>
      <div className="relative flex-1 overflow-auto">
        <div className="flex min-h-full min-w-full items-start justify-center p-2">
          <img
            src={pages[index]}
            alt={`${title} page ${index + 1}`}
            className="origin-top transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, maxWidth: zoom === 1 ? '100%' : 'none' }}
            draggable={false}
          />
        </div>
      </div>
      {pages.length > 1 ? (
        <div className="flex items-center justify-between gap-3 px-3 py-3 text-paper">
          <Button
            variant="outline"
            className="border-white/30 bg-transparent text-paper hover:bg-white/10"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <div className="flex gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to page ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full ${i === index ? 'bg-accent-soft' : 'bg-white/30'}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <Button
            variant="outline"
            className="border-white/30 bg-transparent text-paper hover:bg-white/10"
            disabled={index === pages.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
