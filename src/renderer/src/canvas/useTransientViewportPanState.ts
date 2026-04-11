import { useEffect, useRef, useState } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'

type ViewportSample = {
  x: number
  y: number
  zoom: number
}

export function useTransientViewportPanState(delayMs = 80) {
  const { viewportInitialized } = useReactFlow()
  const viewportX = useStore((s) => s.transform[0])
  const viewportY = useStore((s) => s.transform[1])
  const viewportZoom = useStore((s) => s.transform[2])
  const prevViewportRef = useRef<ViewportSample>({
    x: viewportX,
    y: viewportY,
    zoom: viewportZoom,
  })
  const panTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    if (!viewportInitialized) return

    const prevViewport = prevViewportRef.current
    prevViewportRef.current = {
      x: viewportX,
      y: viewportY,
      zoom: viewportZoom,
    }

    const zoomChanged = viewportZoom !== prevViewport.zoom
    const positionChanged = viewportX !== prevViewport.x || viewportY !== prevViewport.y
    if (zoomChanged || !positionChanged) return

    setIsPanning(true)
    if (panTimerRef.current) clearTimeout(panTimerRef.current)
    panTimerRef.current = setTimeout(() => setIsPanning(false), delayMs)
  }, [delayMs, viewportInitialized, viewportX, viewportY, viewportZoom])

  useEffect(() => {
    return () => {
      if (panTimerRef.current) clearTimeout(panTimerRef.current)
    }
  }, [])

  return { isPanning, viewportInitialized }
}
