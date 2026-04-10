import { net } from 'electron'

const FETCH_TIMEOUT_MS = 8000
/**
 * Stop accumulating response bytes after this limit.
 * The <title> tag is virtually always within the first few KB of HTML;
 * 64 KB is a generous cap that avoids downloading full pages.
 */
const MAX_RESPONSE_BYTES = 65536
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function extractTitle(html: string): string | null {
  const match = TITLE_RE.exec(html)
  if (!match) return null
  const decoded = decodeHtmlEntities(match[1])
  return decoded || null
}

export type PageTitleFetchResult = {
  ok: boolean
  title: string | null
}

export async function fetchPageTitle(url: string): Promise<PageTitleFetchResult> {
  // Sanity-check: only http/https
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, title: null }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, title: null }
  }

  return new Promise((resolve) => {
    let settled = false
    let bytesRead = 0
    let htmlBuffer = ''

    const done = (result: PageTitleFetchResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => done({ ok: false, title: null }), FETCH_TIMEOUT_MS)

    let request: ReturnType<typeof net.request>
    try {
      request = net.request({ url, method: 'GET', redirect: 'follow' })
    } catch {
      done({ ok: false, title: null })
      return
    }

    request.on('response', (response) => {
      if (response.statusCode < 200 || response.statusCode >= 400) {
        done({ ok: false, title: null })
        return
      }

      response.on('data', (chunk: Buffer) => {
        if (settled) return

        const remaining = MAX_RESPONSE_BYTES - bytesRead
        const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk
        bytesRead += slice.length
        htmlBuffer += slice.toString('utf8')

        const title = extractTitle(htmlBuffer)
        if (title !== null) {
          done({ ok: true, title })
          return
        }

        if (bytesRead >= MAX_RESPONSE_BYTES) {
          done({ ok: true, title: null })
        }
      })

      response.on('end', () => {
        done({ ok: true, title: extractTitle(htmlBuffer) })
      })

      response.on('error', () => {
        done({ ok: false, title: null })
      })
    })

    request.on('error', () => {
      done({ ok: false, title: null })
    })

    request.end()
  })
}
