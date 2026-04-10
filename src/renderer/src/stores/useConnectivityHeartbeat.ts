import { useEffect } from 'react'
import { useConnectivityStore } from './connectivity'

/**
 * Wires up the connectivity heartbeat for the app lifetime:
 *   - immediate probe on mount (app start)
 *   - slow background heartbeat while mounted
 *   - re-probe when the window regains focus
 *   - re-probe when the browser fires an `online` event (hint-backed)
 *
 * Mount this once at the App root. Individual surfaces that need a
 * fresh reading before opening (e.g. a network-dependent command flow)
 * should call `useConnectivityStore.getState().probeNow()` themselves.
 */
export function useConnectivityHeartbeat(): void {
  const startHeartbeat = useConnectivityStore((s) => s.startHeartbeat)
  const stopHeartbeat = useConnectivityStore((s) => s.stopHeartbeat)
  const probeNow = useConnectivityStore((s) => s.probeNow)

  useEffect(() => {
    startHeartbeat()

    const onFocus = (): void => { void probeNow() }
    const onOnline = (): void => { void probeNow() }

    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      stopHeartbeat()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [startHeartbeat, stopHeartbeat, probeNow])
}
