import { net } from 'electron'

const PROBE_URL = 'https://clients3.google.com/generate_204'
const PROBE_TIMEOUT_MS = 5000

export type NetworkProbeResult = {
  reachable: boolean
}

export async function probeNetwork(): Promise<NetworkProbeResult> {
  return new Promise((resolve) => {
    let settled = false

    const done = (reachable: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ reachable })
    }

    const timer = setTimeout(() => done(false), PROBE_TIMEOUT_MS)

    let request: ReturnType<typeof net.request>
    try {
      request = net.request({ url: PROBE_URL, method: 'HEAD', redirect: 'follow' })
    } catch {
      done(false)
      return
    }

    request.on('response', (response) => {
      // Any HTTP response (including 204, 200, redirects already followed) means we reached the network
      response.on('data', () => {})
      response.on('end', () => done(response.statusCode < 600))
      response.on('error', () => done(false))
      // Treat any 2xx/3xx as reachable; even 4xx/5xx means the network is up
      if (response.statusCode < 600) done(true)
    })

    request.on('error', () => done(false))

    request.end()
  })
}
