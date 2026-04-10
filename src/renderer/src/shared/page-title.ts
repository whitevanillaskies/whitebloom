/**
 * Fetches the page title for the given URL via the main process.
 *
 * Returns null on failure, timeout, or if the operation was aborted.
 * Falls back silently — callers should never throw on a null result.
 */
export async function fetchPageTitle(
  url: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (signal?.aborted) return null
  try {
    const result = await window.api.fetchPageTitle(url)
    if (signal?.aborted) return null
    return result.ok ? result.title : null
  } catch {
    return null
  }
}
