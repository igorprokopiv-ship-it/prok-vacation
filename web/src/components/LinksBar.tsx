import { useEffect, useState } from 'react'
import {
  listTripLinks,
  type TripLinkRow,
} from '@/lib/contentSync'
import {
  loadProkConfig,
  moneyRangeUrl,
  resolveLinkUrl,
  timelogDayUrl,
  type ProkConfig,
} from '@/lib/prokLinks'

export function LinksBar({
  tripId,
  dayDate,
  tripStart,
  tripEnd,
}: {
  tripId: string
  dayDate?: string | null
  tripStart?: string | null
  tripEnd?: string | null
}) {
  const [cfg, setCfg] = useState<ProkConfig | null>(null)
  const [links, setLinks] = useState<TripLinkRow[]>([])

  useEffect(() => {
    void loadProkConfig().then(setCfg)
    void listTripLinks(tripId).then(setLinks)
  }, [tripId])

  if (!cfg) return null

  const defaults: { label: string; href: string | null }[] = [
    {
      label: 'Log',
      href: dayDate ? timelogDayUrl(cfg.timelogBase, dayDate) : null,
    },
    {
      label: 'Spend',
      href:
        tripStart && tripEnd
          ? moneyRangeUrl(cfg.moneyBase, tripStart, tripEnd)
          : null,
    },
  ]

  const fromDb = links
    .map((l) => ({
      label: l.label || l.kind,
      href: resolveLinkUrl(cfg, l.kind, l.payload),
    }))
    .filter((l) => l.href)

  const items = [...defaults, ...fromDb].filter((i) => i.href)

  if (!items.length) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {items.map((item) => (
        <a
          key={`${item.label}-${item.href}`}
          href={item.href!}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-line bg-paper px-3 py-1 text-[11px] font-semibold text-sea"
        >
          {item.label}
        </a>
      ))}
    </div>
  )
}
