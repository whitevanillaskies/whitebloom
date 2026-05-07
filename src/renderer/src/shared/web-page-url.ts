export function normalizeWebPageUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalizedInput = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(normalizedInput)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function normalizeEmbeddableWebUrl(value: string): string | null {
  const normalized = normalizeWebPageUrl(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    if (url.protocol === 'https:') return url.toString()
    if (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
    ) {
      return url.toString()
    }
    return null
  } catch {
    return null
  }
}
