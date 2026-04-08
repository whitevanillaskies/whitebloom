import { useEffect, useRef, useState } from 'react'
import './MicaHost.css'
import type { MicaAnyWindowRoute, MicaHostBounds } from './model'
import type { UseMicaHostResult } from './useMicaHost'

export type MicaWindowRenderArgs<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  bounds: MicaHostBounds | null
  host: UseMicaHostResult<TRoute, TUiState>
  window: UseMicaHostResult<TRoute, TUiState>['windows'][number]
}

type MicaHostProps<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  host: UseMicaHostResult<TRoute, TUiState>
  children?: React.ReactNode
  className?: string
  contentClassName?: string
  overlayClassName?: string
  renderWindow?: (args: MicaWindowRenderArgs<TRoute, TUiState>) => React.ReactNode
  renderOverlay?: (args: {
    bounds: MicaHostBounds | null
    host: UseMicaHostResult<TRoute, TUiState>
  }) => React.ReactNode
}

function measureHostBounds(element: HTMLDivElement): MicaHostBounds {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  }
}

export default function MicaHost<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
>({
  host,
  children,
  className,
  contentClassName,
  overlayClassName,
  renderWindow,
  renderOverlay
}: MicaHostProps<TRoute, TUiState>): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState<MicaHostBounds | null>(null)
  const visibleWindows = host.windows.filter((window) => window.visibility === 'open')

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const updateBounds = () => {
      setBounds(measureHostBounds(element))
    }

    updateBounds()

    const observer = new ResizeObserver(() => {
      updateBounds()
    })
    observer.observe(element)

    window.addEventListener('resize', updateBounds)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateBounds)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={['mica-host', className].filter(Boolean).join(' ')}
      data-mica-host-id={host.policy.hostId}
      data-mica-window-limit={host.policy.windowLimit}
      data-mica-placement-mode={host.policy.placementMode}
    >
      <div className={['mica-host__content-plane', contentClassName].filter(Boolean).join(' ')}>
        {children}
      </div>

      <div className={['mica-host__overlay-plane', overlayClassName].filter(Boolean).join(' ')}>
        {renderWindow
          ? visibleWindows.map((window) => (
              <div key={window.id} className="mica-host__window-instance" data-mica-window-id={window.id}>
                {renderWindow({ bounds, host, window })}
              </div>
            ))
          : null}
        {renderOverlay ? renderOverlay({ bounds, host }) : null}
      </div>
    </div>
  )
}
