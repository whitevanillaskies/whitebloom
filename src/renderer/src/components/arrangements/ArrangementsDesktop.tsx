import { useCallback, useEffect, useRef, useState } from 'react'
import { useArrangementsStore } from '../../stores/arrangements'
import type { GardenCameraState } from '../../../../shared/arrangements'
import './ArrangementsDesktop.css'

const MIN_ZOOM = 0.9
const MAX_ZOOM = 0.9
const ZOOM_STEP = 0.0012
const MATERIAL_MIME = 'application/x-wb-material-key'

type ArrangementsDesktopProps = {
  children?: React.ReactNode
  /** Content rendered outside the world transform (anchored to container) */
  overlay?: React.ReactNode
}

export default function ArrangementsDesktop({
  children,
  overlay
}: ArrangementsDesktopProps): React.JSX.Element {
  const storedCamera = useArrangementsStore((s) => s.cameraState)
  const setCamera = useArrangementsStore((s) => s.setCamera)
  const removeFromBin = useArrangementsStore((s) => s.removeFromBin)
  const moveMaterialOnDesktop = useArrangementsStore((s) => s.moveMaterialOnDesktop)

  // Local camera state for low-latency pan/zoom, synced to store on pointer up.
  const [camera, setLocalCamera] = useState<GardenCameraState>(storedCamera)
  const cameraRef = useRef(camera)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  // Sync store to local when store changes externally.
  const lastStoredRef = useRef(storedCamera)
  useEffect(() => {
    if (storedCamera !== lastStoredRef.current) {
      lastStoredRef.current = storedCamera
      cameraRef.current = storedCamera
      setLocalCamera(storedCamera)
    }
  }, [storedCamera])

  const isPanning = useRef(false)
  const panOrigin = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
      const next: GardenCameraState = {
        ...cameraRef.current,
        x: panOrigin.current.cx + dx,
        y: panOrigin.current.cy + dy
      }
      cameraRef.current = next
      setLocalCamera(next)
    },
    []
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current) return
      isPanning.current = false
      panOrigin.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
      setCamera(cameraRef.current)
    },
    [setCamera]
  )

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const prev = cameraRef.current
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const rawDelta = e.deltaY * ZOOM_STEP
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom - rawDelta))
      const scale = nextZoom / prev.zoom
      const nextX = px - (px - prev.x) * scale
      const nextY = py - (py - prev.y) * scale

      const next: GardenCameraState = { x: nextX, y: nextY, zoom: nextZoom }
      cameraRef.current = next
      setLocalCamera(next)
      setCamera(next)
    },
    [setCamera]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const [spaceHeld, setSpaceHeld] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(MATERIAL_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when the drag leaves the container itself (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setIsDragOver(false)
      const materialKey = e.dataTransfer.getData(MATERIAL_MIME)
      if (!materialKey) return
      e.preventDefault()

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const cam = cameraRef.current
      const worldX = (e.clientX - rect.left - cam.x) / cam.zoom
      const worldY = (e.clientY - rect.top - cam.y) / cam.zoom

      removeFromBin(materialKey) // no-op if not in a bin
      moveMaterialOnDesktop(materialKey, { x: worldX, y: worldY })
    },
    [removeFromBin, moveMaterialOnDesktop]
  )

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
        spaceHeld ? 'arrangements-desktop--pan-cursor' : '',
        isDragOver ? 'arrangements-desktop--drag-over' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-space-pan={spaceHeld ? 'true' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="arrangements-desktop__world"
        style={{ transform, transformOrigin: '0 0' }}
      >
        {children}
      </div>

      {overlay}
    </div>
  )
}
