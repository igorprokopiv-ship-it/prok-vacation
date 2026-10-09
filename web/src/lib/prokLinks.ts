export interface ProkConfig {
  timelogBase: string
  moneyBase: string
  immichBase: string
}

const DEFAULTS: ProkConfig = {
  timelogBase: 'http://admin.prok:8080',
  moneyBase: 'http://admin.prok:8081',
  immichBase: 'http://admin.prok:30041',
}

let cached: ProkConfig | null = null

export async function loadProkConfig(): Promise<ProkConfig> {
  if (cached) return cached
  try {
    const res = await fetch('/api/config')
    if (res.ok) {
      const j = await res.json()
      cached = {
        timelogBase: j.timelogBase || DEFAULTS.timelogBase,
        moneyBase: j.moneyBase || DEFAULTS.moneyBase,
        immichBase: j.immichBase || DEFAULTS.immichBase,
      }
      return cached
    }
  } catch {
    /* offline */
  }
  cached = DEFAULTS
  return cached
}

export function timelogDayUrl(base: string, date: string): string {
  const u = new URL(base.endsWith('/') ? base : `${base}/`)
  u.searchParams.set('date', date)
  return u.toString()
}

export function moneyRangeUrl(base: string, from: string, to: string): string {
  const u = new URL(base.endsWith('/') ? base : `${base}/`)
  u.searchParams.set('from', from)
  u.searchParams.set('to', to)
  return u.toString()
}

export function immichAlbumUrl(base: string, albumId: string): string {
  const root = base.replace(/\/$/, '')
  return `${root}/albums/${encodeURIComponent(albumId)}`
}

export function resolveLinkUrl(
  cfg: ProkConfig,
  kind: string,
  payload: Record<string, unknown>,
): string | null {
  const override = typeof payload.url === 'string' ? payload.url : null
  if (override) return override
  if (kind === 'timelog_day' && typeof payload.date === 'string') {
    return timelogDayUrl(cfg.timelogBase, payload.date)
  }
  if (
    kind === 'money_range' &&
    typeof payload.from === 'string' &&
    typeof payload.to === 'string'
  ) {
    return moneyRangeUrl(cfg.moneyBase, payload.from, payload.to)
  }
  if (kind === 'immich_album' && typeof payload.albumId === 'string') {
    return immichAlbumUrl(cfg.immichBase, payload.albumId)
  }
  if (kind === 'custom_url' && typeof payload.url === 'string') {
    return payload.url
  }
  return null
}
