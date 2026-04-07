import { useCallback, useEffect, useRef, useState } from 'react'
import { useArrangementsStore } from '../../stores/arrangements'
import type { GardenCameraState } from '../../../../shared/arrangements'
import './ArrangementsDesktop.css'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.0012

type ArrangementsDesktopProps = {
  children?: React.ReactNode
}

export default function ArrangementsDesktop({
  children
}: ArrangementsDesktopProps): React.JSX.Element {
  const storedCamera = useArrangementsStore((s) => s.cameraState)
  const setCamera = useArrangementsStore((s) => s.setCamera)

  // Local camera state for low-latency pan/zoom — synced to store on pointer up
  const [camera, setLocalCamera] = useState<GardenCameraState>(storedCamera)

  // Sync store → local when store changes externally (initial load)
  const lastStoredRef = useRef(storedCamera)
  useEffect(() => {
    if (storedCamera !== lastStoredRef.current) {
      lastStoredRef.current = storedCamera
      setLocalCamera(storedCamera)
    }
  }, [storedCamera])

  const isPanning = useRef(false)
  const panOrigin = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const flushCamera = useCallback(
    (next: GardenCameraState) => {
      setCamera(next)
    },
    [setCamera]
  )

  // ── Pan (middle-mouse or space+drag) ──────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const isMiddle = e.button === 1
    const isSpacePan = e.button === 0 && (e.currentTarget as HTMLDivElement).dataset.spacePan === 'true'
    if (!isMiddle && !isSpacePan) return

    e.preventDefault()
    isPanning.current = true
    panOrigin.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [camera.x, camera.y])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current || !panOrigin.current) return
      const dx = e.clientX - panOrigin.current.x
      const dy = e.clientY - panOrigin.current.y
      setLocalCamera((prev) => ({
        ...prev,
        x: panOrigin.current!.cx + dx,
        y: panOrigin.current!.cy + dy
      }))
    },
    []
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current) return
      isPanning.current = false
      panOrigin.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
      setLocalCamera((prev) => {
        flushCamera(prev)
        return prev
      })
    },
    [flushCamera]
  )

  // ── Zoom (wheel) ───────────────────────────────────────────
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      setLocalCamera((prev) => {
        // Pointer position relative to container
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top

        const rawDelta = e.deltaY * ZOOM_STEP
        const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom - rawDelta))
        const scale = nextZoom / prev.zoom

        // Zoom toward pointer
        const nextX = px - (px - prev.x) * scale
        const nextY = py - (py - prev.y) * scale

        const next: GardenCameraState = { x: nextX, y: nextY, zoom: nextZoom }
        flushCamera(next)
        return next
      })
    },
    [flushCamera]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Space-to-pan cursor ────────────────────────────────────
  const [spaceHeld, setSpaceHeld] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`

  return (
    <div
      ref={containerRef}
      className={[
        'arrangements-desktop',
        spaceHeld ? 'arrangements-desktop--pan-cursor' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-space-pan={spaceHeld ? 'true' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* dot-grid background */}
      <div className="arrangements-desktop__grid" aria-hidden="true" />

      {/* transformed world */}
      <div
        className="arrangements-desktop__world"
        style={{ transform, transformOrigin: '0 0' }}
      >
        {children}
      </div>
    </div>
  )
}
