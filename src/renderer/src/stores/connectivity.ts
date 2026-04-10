import { create } from 'zustand'

export type ConnectivityStatus = 'unknown' | 'checking' | 'online' | 'offline'

type ConnectivityState = {
  status: ConnectivityStatus
  lastCheckedAt: number | null
  lastSuccessAt: number | null
  probeNow: () => Promise<void>
  startHeartbeat: (intervalMs?: number) => void
  stopHeartbeat: () => void
}

const DEFAULT_HEARTBEAT_MS = 30_000

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  status: 'unknown',
  lastCheckedAt: null,
  lastSuccessAt: null,

  probeNow: async () => {
    set({ status: 'checking' })
    try {
      const result = await window.api.probeNetwork()
      const now = Date.now()
      set({
        status: result.reachable ? 'online' : 'offline',
        lastCheckedAt: now,
        lastSuccessAt: result.reachable ? now : get().lastSuccessAt
      })
    } catch {
      set({ status: 'offline', lastCheckedAt: Date.now() })
    }
  },

  startHeartbeat: (intervalMs = DEFAULT_HEARTBEAT_MS) => {
    if (heartbeatTimer !== null) return
    get().probeNow()
    heartbeatTimer = setInterval(() => get().probeNow(), intervalMs)
  },

  stopHeartbeat: () => {
    if (heartbeatTimer === null) return
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}))
