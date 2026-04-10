export function normalizeWebPageUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalizedInput = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(normalizedInput)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}
