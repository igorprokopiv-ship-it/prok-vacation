import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import type { Site } from '@/data/types'
import { getSitePhoto } from '@/lib/data'

const sections: { key: keyof Pick<Site, 'logistics' | 'proTips' | 'history' | 'route'>; label: string }[] = [
  { key: 'logistics', label: 'Logistics' },
  { key: 'proTips', label: 'Pro-Tips' },
  { key: 'history', label: 'History' },
  { key: 'route', label: 'The Route' },
]

export function SiteGuide({ site, onClose }: { site: Site | undefined; onClose: () => void }) {
  if (!site) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
          <h2 className="font-display text-xl font-bold">Site guide</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </header>
        <div className="p-4">
          <EmptyState
            title="Guide coming"
            detail="No write-up is linked to this stop yet. Drop site notes into sites.json later."
          />
        </div>
      </div>
    )
  }

  const photo = getSitePhoto(site.id)
  const hasContent = sections.some((s) => site[s.key].length > 0)

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper animate-in slide-in-from-bottom-4 duration-300">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sea">Site guide</p>
          <h2 className="font-display text-xl font-bold text-ink">{site.name}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X />
        </Button>
      </header>
      {photo ? (
        <div className="relative h-44 w-full overflow-hidden">
          <img src={photo} alt={site.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
        </div>
      ) : null}
      <div className="space-y-5 p-4 pb-10">
        {!hasContent ? (
          <EmptyState title="Guide coming" detail="Sections are empty for this site." />
        ) : (
          sections.map(({ key, label }) => {
            const items = site[key]
            if (!items.length) return null
            return (
              <section key={key}>
                <h3 className="mb-2 font-display text-lg font-bold text-ink">{label}</h3>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li
                      key={i}
                      className="relative rounded-lg bg-paper-deep/70 px-3 py-2 pl-4 text-sm leading-relaxed text-ink-soft before:absolute before:left-1.5 before:top-3 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
