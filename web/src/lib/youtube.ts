const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/

/** Extract an 11-char YouTube video id from common URL shapes or a bare id. */
export function parseYoutubeId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (YOUTUBE_ID_RE.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id && YOUTUBE_ID_RE.test(id) ? id : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v')
    if (v && YOUTUBE_ID_RE.test(v)) return v

    const parts = url.pathname.split('/').filter(Boolean)
    if (
      parts[0] &&
      ['embed', 'shorts', 'live', 'v'].includes(parts[0]) &&
      parts[1] &&
      YOUTUBE_ID_RE.test(parts[1])
    ) {
      return parts[1]
    }
  }

  return null
}

export function youtubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`
}

export function youtubeThumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

export type YoutubeOEmbed = {
  title: string
  thumbnail_url?: string
  author_name?: string
}

/** Fetch public oEmbed metadata when online. Returns null on failure. */
export async function fetchYoutubeOEmbed(
  youtubeId: string,
): Promise<YoutubeOEmbed | null> {
  if (!navigator.onLine) return null
  const url = youtubeWatchUrl(youtubeId)
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      title?: string
      thumbnail_url?: string
      author_name?: string
    }
    if (!data.title?.trim()) return null
    return {
      title: data.title.trim(),
      thumbnail_url: data.thumbnail_url,
      author_name: data.author_name,
    }
  } catch {
    return null
  }
}

export const YOUTUBE_OFFLINE_DAYS = 29

export type OfflineMarkStatus = 'missing' | 'downloaded' | 'expired'

export function offlineMarkStatus(
  downloadedAt: string | null | undefined,
  now = Date.now(),
): OfflineMarkStatus {
  if (!downloadedAt) return 'missing'
  const ts = Date.parse(downloadedAt)
  if (Number.isNaN(ts)) return 'missing'
  const ageMs = now - ts
  if (ageMs > YOUTUBE_OFFLINE_DAYS * 24 * 60 * 60 * 1000) return 'expired'
  return 'downloaded'
}
