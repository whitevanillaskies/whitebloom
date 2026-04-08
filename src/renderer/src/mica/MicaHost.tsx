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

type MicaWindowSurfaceProps<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  bounds: MicaHostBounds | null
  host: UseMicaHostResult<TRoute, TUiState>
  window: UseMicaHostResult<TRoute, TUiState>['windows'][number]
  children: React.ReactNode
}

const TITLEBAR_VISIBLE_HEIGHT = 38

function measureHostBounds(element: HTMLDivElement): MicaHostBounds {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  }
}

function clampWindowPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: MicaHostBounds | null
): { x: number; y: number } {
  if (!bounds) return { x, y }

  const visibleTitlebarHeight = Math.min(TITLEBAR_VISIBLE_HEIGHT, Math.max(height, 0))
  const minX = Math.min(0, bounds.width - width)
  const maxX = Math.max(bounds.width - visibleTitlebarHeight, 0)
  const minY = 0
  const maxY = Math.max(bounds.height - visibleTitlebarHeight, 0)

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY)
  }
}

function MicaWindowSurface<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
>({
  bounds,
  host,
  window,
  children
}: MicaWindowSurfaceProps<TRoute, TUiState>): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    startX: number
    startY: number
  } | null>(null)
  const previewPositionRef = useRef({
    x: window.geometry.x,
    y: window.geometry.y
  })
  const [previewPosition, setPreviewPosition] = useState(() => ({
    x: window.geometry.x,
    y: window.geometry.y
  }))

  useEffect(() => {
    if (dragStateRef.current) return
    const nextPosition = { x: window.geometry.x, y: window.geometry.y }
    previewPositionRef.current = nextPosition
    setPreviewPosition(nextPosition)
  }, [window.geometry.x, window.geometry.y])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const target = event.target
    if (!(target instanceof HTMLElement)) return
    host.focus(window.id)
    if (target.closest('[data-mica-no-drag="true"]')) return
    if (!target.closest('[data-mica-drag-handle="true"]')) return

    const element = wrapperRef.current
    if (!element) return

    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startX: window.geometry.x,
      startY: window.geometry.y
    }
    element.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()

    const unclampedX = dragState.startX + (event.clientX - dragState.originX)
    const unclampedY = dragState.startY + (event.clientY - dragState.originY)
    const nextPosition = clampWindowPosition(
      unclampedX,
      unclampedY,
      window.geometry.width,
      window.geometry.height,
      bounds
    )

    previewPositionRef.current = nextPosition
    setPreviewPosition(nextPosition)
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = null

    const element = wrapperRef.current
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId)
    }

    host.move(window.id, previewPositionRef.current)
  }

  const { x, y } = previewPosition

  return (
    <div
      ref={wrapperRef}
      className="mica-host__window-instance"
      data-mica-window-id={window.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onWheelCapture={(event) => {
        event.stopPropagation()
      }}
    >
      <div
        className="mica-host__window-surface"
        style={{
          left: x,
          top: y,
          width: window.geometry.width,
          height: window.geometry.height,
          minWidth: window.geometry.minWidth,
          minHeight: window.geometry.minHeight
        }}
      >
        {children}
      </div>
    </div>
  )
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
              <MicaWindowSurface key={window.id} bounds={bounds} host={host} window={window}>
                {renderWindow({ bounds, host, window })}
              </MicaWindowSurface>
            ))
          : null}
        {renderOverlay ? renderOverlay({ bounds, host }) : null}
      </div>
    </div>
  )
}
