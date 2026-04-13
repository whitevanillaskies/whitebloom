import { useEffect, useMemo, useRef, useState } from 'react'
import type { InkPagedUvSample } from '../../../../shared/ink'
import { DEFAULT_INK_STROKE_DYNAMICS, DEFAULT_INK_STROKE_STYLE } from '../../../../shared/ink'
import type { InkTool } from '../../canvas/InkToolbar'
import {
  buildOutlineFromScreenSamples,
  clampPressure,
  collectVisiblePageRects,
  drawStrokePolygon,
  pdfStrokeHitsEraserPoint,
  screenSampleToPagedUv,
  type PdfInkStroke,
  type ScreenSample
} from './pdfInkShared'

const ERASER_SCREEN_RADIUS = 20

type PdfInkOverlayProps = {
  viewportRef: { current: HTMLDivElement | null }
  active: boolean
  activeTool: InkTool
  strokes: PdfInkStroke[]
  onTransfer: (stroke: PdfInkStroke) => void
  onEraseComplete: (erasedStrokes: PdfInkStroke[]) => void
}

export function PdfInkOverlay({
  viewportRef,
  active,
  activeTool,
  strokes,
  onTransfer,
  onEraseComplete
}: PdfInkOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const currentSamplesRef = useRef<ScreenSample[]>([])
  const erasedIdsRef = useRef<Set<string>>(new Set())
  const strokesRef = useRef<PdfInkStroke[]>(strokes)
  const activeToolRef = useRef<InkTool>(activeTool)
  const onEraseCompleteRef = useRef(onEraseComplete)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, pixelRatio: 1 })
  const [currentSamples, setCurrentSamples] = useState<ScreenSample[]>([])
  const [scrollbarInsets, setScrollbarInsets] = useState({ right: 0, bottom: 0 })

  const currentOutline = useMemo(
    () => (currentSamples.length > 1 ? buildOutlineFromScreenSamples(currentSamples) : []),
    [currentSamples]
  )

  useEffect(() => { strokesRef.current = strokes }, [strokes])
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { onEraseCompleteRef.current = onEraseComplete }, [onEraseComplete])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      const pixelRatio = window.devicePixelRatio || 1
      setCanvasSize({ width, height, pixelRatio })
    })

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateScrollbarInsets = () => {
      setScrollbarInsets({
        right: Math.max(0, viewport.offsetWidth - viewport.clientWidth),
        bottom: Math.max(0, viewport.offsetHeight - viewport.clientHeight)
      })
    }

    updateScrollbarInsets()

    const observer = new ResizeObserver(() => updateScrollbarInsets())
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [viewportRef])

  useEffect(() => {
    const canvas = glassCanvasRef.current
    if (!canvas) return
    canvas.width = Math.max(1, Math.floor(canvasSize.width * canvasSize.pixelRatio))
    canvas.height = Math.max(1, Math.floor(canvasSize.height * canvasSize.pixelRatio))
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(canvasSize.pixelRatio, 0, 0, canvasSize.pixelRatio, 0, 0)
  }, [canvasSize])

  useEffect(() => {
    const canvas = glassCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvasSize.width, canvasSize.height)
    if (currentOutline.length < 2) return

    drawStrokePolygon(
      context,
      currentOutline,
      DEFAULT_INK_STROKE_STYLE.color,
      DEFAULT_INK_STROKE_STYLE.opacity
    )
  }, [canvasSize.height, canvasSize.width, currentOutline])

  useEffect(() => {
    if (active) return
    activePointerIdRef.current = null
    currentSamplesRef.current = []
    setCurrentSamples([])
    erasedIdsRef.current = new Set()
  }, [active])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const isValidPointerSample = (event: PointerEvent): boolean =>
      Number.isFinite(event.clientX) && Number.isFinite(event.clientY)

    const makeScreenSample = (event: PointerEvent, bounds: DOMRect): ScreenSample => ({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      pressure: clampPressure(event.pressure),
      t: event.timeStamp
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (!active) return
      if (event.button !== 0) return
      if (!isValidPointerSample(event)) return

      const tool = activeToolRef.current
      activePointerIdRef.current = event.pointerId
      root.setPointerCapture(event.pointerId)

      if (tool === 'pen') {
        const bounds = root.getBoundingClientRect()
        const sample = makeScreenSample(event, bounds)
        currentSamplesRef.current = [sample]
        setCurrentSamples([sample])
      } else if (tool === 'eraser') {
        erasedIdsRef.current = new Set()
      }

      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!active) return
      if (activePointerIdRef.current !== event.pointerId) return
      if (!isValidPointerSample(event)) return

      const tool = activeToolRef.current

      if (tool === 'pen') {
        const bounds = root.getBoundingClientRect()
        const nextSample = makeScreenSample(event, bounds)
        const previous = currentSamplesRef.current
        const last = previous[previous.length - 1]

        if (!last) {
          currentSamplesRef.current = [nextSample]
          setCurrentSamples([nextSample])
          event.preventDefault()
          return
        }

        const distance = Math.hypot(nextSample.x - last.x, nextSample.y - last.y)
        if (distance < DEFAULT_INK_STROKE_DYNAMICS.sampleSpacing) {
          event.preventDefault()
          return
        }

        const next = [...previous, nextSample]
        currentSamplesRef.current = next
        setCurrentSamples(next)
      } else if (tool === 'eraser') {
        const bounds = root.getBoundingClientRect()
        const eraserX = event.clientX - bounds.left
        const eraserY = event.clientY - bounds.top
        const pageRects = collectVisiblePageRects(viewportRef.current)

        for (const stroke of strokesRef.current) {
          if (erasedIdsRef.current.has(stroke.id)) continue
          if (pdfStrokeHitsEraserPoint(stroke, eraserX, eraserY, ERASER_SCREEN_RADIUS, bounds, pageRects)) {
            erasedIdsRef.current.add(stroke.id)
          }
        }
      }

      event.preventDefault()
    }

    const finalizeStroke = (event: PointerEvent, includeFinalSample: boolean) => {
      if (activePointerIdRef.current !== event.pointerId) return

      const tool = activeToolRef.current

      if (tool === 'pen') {
        const bounds = includeFinalSample ? root.getBoundingClientRect() : null
        const finalSample =
          includeFinalSample && bounds !== null && isValidPointerSample(event)
            ? makeScreenSample(event, bounds)
            : null
        const pageRects = bounds !== null ? collectVisiblePageRects(viewportRef.current) : null

        const previous = currentSamplesRef.current
        const completeSamples =
          finalSample !== null &&
          previous.length > 0 &&
          Math.hypot(
            finalSample.x - previous[previous.length - 1].x,
            finalSample.y - previous[previous.length - 1].y
          ) > 0
            ? [...previous, finalSample]
            : previous

        const pagedSamples = completeSamples
          .map((sample) =>
            bounds !== null && pageRects !== null ? screenSampleToPagedUv(sample, bounds, pageRects) : null
          )
          .filter((sample): sample is InkPagedUvSample => sample !== null)

        currentSamplesRef.current = []
        setCurrentSamples([])
        activePointerIdRef.current = null

        if (pagedSamples.length > 1) {
          onTransfer({
            id: crypto.randomUUID(),
            tool: 'pen',
            style: { ...DEFAULT_INK_STROKE_STYLE },
            dynamics: { ...DEFAULT_INK_STROKE_DYNAMICS },
            samples: pagedSamples,
            createdAt: new Date().toISOString()
          })
        }
      } else if (tool === 'eraser') {
        activePointerIdRef.current = null
        const hitIds = erasedIdsRef.current
        if (hitIds.size > 0) {
          const erasedStrokes = strokesRef.current.filter((s) => hitIds.has(s.id))
          if (erasedStrokes.length > 0) {
            onEraseCompleteRef.current(erasedStrokes)
          }
        }
        // Leave erasedIdsRef populated to avoid a flash before parent updates strokes prop.
        // It will be cleared at the start of the next gesture.
      }

      try {
        root.releasePointerCapture(event.pointerId)
      } catch {
        // ignore pointer capture release races
      }
      event.preventDefault()
    }

    const handlePointerUp = (event: PointerEvent) => {
      finalizeStroke(event, true)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      finalizeStroke(event, false)
    }

    root.addEventListener('pointerdown', handlePointerDown)
    root.addEventListener('pointermove', handlePointerMove)
    root.addEventListener('pointerup', handlePointerUp)
    root.addEventListener('pointercancel', handlePointerCancel)

    return () => {
      root.removeEventListener('pointerdown', handlePointerDown)
      root.removeEventListener('pointermove', handlePointerMove)
      root.removeEventListener('pointerup', handlePointerUp)
      root.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [active, onTransfer, viewportRef])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handleWheel = (event: WheelEvent) => {
      if (!active) return
      event.preventDefault()
      viewportRef.current?.scrollBy({ left: event.deltaX, top: event.deltaY, behavior: 'instant' as ScrollBehavior })
    }

    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => root.removeEventListener('wheel', handleWheel)
  }, [active, viewportRef])

  return (
    <div
      ref={rootRef}
      className={`pdf-ink-overlay${active ? ' pdf-ink-overlay--active' : ''}`}
      style={{
        right: `${scrollbarInsets.right}px`,
        bottom: `${scrollbarInsets.bottom}px`
      }}
      aria-hidden="true"
    >
      <canvas ref={glassCanvasRef} className="pdf-ink-overlay__canvas pdf-ink-overlay__canvas--glass" />
    </div>
  )
}
