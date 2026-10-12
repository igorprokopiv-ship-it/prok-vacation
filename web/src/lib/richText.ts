const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'DIV',
])

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** True when the string looks like it already contains HTML markup. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

/** Convert legacy plain-text guide nodes into simple paragraph HTML. */
export function plainToRichHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (looksLikeHtml(trimmed)) return trimmed
  return trimmed
    .split(/\n+/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

function cleanNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as HTMLElement
  const tag = el.tagName.toUpperCase()
  if (!ALLOWED_TAGS.has(tag)) {
    // Unwrap unknown elements — keep children
    const frag = document.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const cleaned = cleanNode(child)
      if (cleaned) frag.appendChild(cleaned)
    }
    return frag
  }
  const out = document.createElement(tag === 'DIV' ? 'P' : tag)
  for (const child of Array.from(el.childNodes)) {
    const cleaned = cleanNode(child)
    if (cleaned) out.appendChild(cleaned)
  }
  return out
}

/** Allowlist sanitize for guide node HTML (browser only). */
export function sanitizeRichHtml(html: string): string {
  if (!html.trim()) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = document.createElement('div')
  for (const child of Array.from(doc.body.childNodes)) {
    const cleaned = cleanNode(child)
    if (cleaned) out.appendChild(cleaned)
  }
  return out.innerHTML
}

export function richTextPlainLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim().length
}

export function isEmptyRichText(html: string): boolean {
  return richTextPlainLength(html) === 0
}

/** Normalize for storage: sanitize, or keep empty string. */
export function normalizeRichText(value: string): string {
  const asHtml = plainToRichHtml(value)
  const clean = sanitizeRichHtml(asHtml)
  return isEmptyRichText(clean) ? '' : clean
}
