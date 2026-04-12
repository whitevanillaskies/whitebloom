import { useEffect, useMemo, useRef, useState } from 'react'
import type { InkPagedUvSample } from '../../../../shared/ink'
import { DEFAULT_INK_STROKE_DYNAMICS, DEFAULT_INK_STROKE_STYLE } from '../../../../shared/ink'
import {
  buildOutlineFromScreenSamples,
  clampPressure,
  collectVisiblePageRects,
  drawStrokePolygon,
  screenSampleToPagedUv,
  type PdfInkStroke,
  type ScreenSample
} from './pdfInkShared'

type PdfInkOverlayProps = {
  viewportRef: { current: HTMLDivElement | null }
  active: boolean
  onTransfer: (stroke: PdfInkStroke) => void
}

export function PdfInkOverlay({ viewportRef, active, onTransfer }: PdfInkOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, pixelRatio: 1 })
  const [currentSamples, setCurrentSamples] = useState<ScreenSample[]>([])

  const currentOutline = useMemo(
    () => (currentSamples.length > 1 ? buildOutlineFromScreenSamples(currentSamples) : []),
    [currentSamples]
  )

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
    setCurrentSamples([])
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

      const bounds = root.getBoundingClientRect()
      const sample = makeScreenSample(event, bounds)
      activePointerIdRef.current = event.pointerId
      root.setPointerCapture(event.pointerId)
      setCurrentSamples([sample])
      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!active) return
      if (activePointerIdRef.current !== event.pointerId) return
      if (!isValidPointerSample(event)) return

      const bounds = root.getBoundingClientRect()
      const nextSample = makeScreenSample(event, bounds)

      setCurrentSamples((previous) => {
        const last = previous[previous.length - 1]
        if (!last) return [nextSample]

        const distance = Math.hypot(nextSample.x - last.x, nextSample.y - last.y)
        if (distance < DEFAULT_INK_STROKE_DYNAMICS.sampleSpacing) {
          return previous
        }

        return [...previous, nextSample]
      })

      event.preventDefault()
    }

    const finalizeStroke = (event: PointerEvent, includeFinalSample: boolean) => {
      if (activePointerIdRef.current !== event.pointerId) return
      const bounds = includeFinalSample ? root.getBoundingClientRect() : null
      const finalSample =
        includeFinalSample && bounds !== null && isValidPointerSample(event)
          ? makeScreenSample(event, bounds)
          : null
      const pageRects = bounds !== null ? collectVisiblePageRects(viewportRef.current) : null

      setCurrentSamples((previous) => {
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

        return []
      })

      try {
        root.releasePointerCapture(event.pointerId)
      } catch {
        // ignore pointer capture release races
      }
      activePointerIdRef.current = null
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

  return (
    <div
      ref={rootRef}
      className={`pdf-ink-overlay${active ? ' pdf-ink-overlay--active' : ''}`}
      aria-hidden="true"
    >
      <canvas ref={glassCanvasRef} className="pdf-ink-overlay__canvas pdf-ink-overlay__canvas--glass" />
    </div>
  )
}
