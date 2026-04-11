import { useEffect, useMemo, useRef, useState } from 'react'
import { useViewport } from '@xyflow/react'
import { getStroke } from 'perfect-freehand'
import type { InkBoardWorldSample, InkStroke } from '../../../shared/ink'
import {
  DEFAULT_INK_STROKE_DYNAMICS,
  DEFAULT_INK_STROKE_STYLE
} from '../../../shared/ink'
import './InkOverlay.css'

type InkOverlayProps = {
  active: boolean
  acetateVisible: boolean
}

type DrawStroke = InkStroke & {
  samples: InkBoardWorldSample[]
}

type StrokePoint = [number, number, number]

const DEFAULT_PRESSURE = 0.5

function clampPressure(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PRESSURE
  return Math.min(1, Math.max(0, value))
}

function drawStrokePolygon(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  opacity: number
): void {
  if (points.length < 2) return

  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index][0], points[index][1])
  }
  context.closePath()
  context.fillStyle = color
  context.globalAlpha = opacity
  context.fill()
  context.globalAlpha = 1
}

function worldToScreenPoint(
  sample: Pick<InkBoardWorldSample, 'x' | 'y'>,
  viewport: { x: number; y: number; zoom: number }
): [number, number] {
  return [sample.x * viewport.zoom + viewport.x, sample.y * viewport.zoom + viewport.y]
}

function buildStrokeOutline(
  samples: InkBoardWorldSample[],
  viewport: { x: number; y: number; zoom: number }
): Array<[number, number]> {
  const points: StrokePoint[] = samples.map((sample) => {
    const [x, y] = worldToScreenPoint(sample, viewport)
    return [x, y, clampPressure(sample.pressure)]
  })

  return getStroke(points, {
    size: DEFAULT_INK_STROKE_STYLE.width * viewport.zoom,
    thinning: 0.62,
    smoothing: 0.58,
    streamline: 0.44,
    simulatePressure: true,
    last: true
  })
}

function makeSample(event: PointerEvent, viewport: { x: number; y: number; zoom: number }, bounds: DOMRect): InkBoardWorldSample {
  const localX = event.clientX - bounds.left
  const localY = event.clientY - bounds.top

  return {
    x: (localX - viewport.x) / viewport.zoom,
    y: (localY - viewport.y) / viewport.zoom,
    pressure: clampPressure(event.pressure),
    t: event.timeStamp
  }
}

export function InkOverlay({ active, acetateVisible }: InkOverlayProps) {
  const viewport = useViewport()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const acetateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, pixelRatio: 1 })
  const [currentSamples, setCurrentSamples] = useState<InkBoardWorldSample[]>([])
  const [acetateStrokes, setAcetateStrokes] = useState<DrawStroke[]>([])

  const currentOutline = useMemo(
    () => (currentSamples.length > 1 ? buildStrokeOutline(currentSamples, viewport) : []),
    [currentSamples, viewport]
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
    const configureCanvas = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      canvas.width = Math.max(1, Math.floor(canvasSize.width * canvasSize.pixelRatio))
      canvas.height = Math.max(1, Math.floor(canvasSize.height * canvasSize.pixelRatio))
      canvas.style.width = `${canvasSize.width}px`
      canvas.style.height = `${canvasSize.height}px`

      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(canvasSize.pixelRatio, 0, 0, canvasSize.pixelRatio, 0, 0)
    }

    configureCanvas(glassCanvasRef.current)
    configureCanvas(acetateCanvasRef.current)
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
    const canvas = acetateCanvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvasSize.width, canvasSize.height)
    if (!acetateVisible) return

    for (const stroke of acetateStrokes) {
      const outline = buildStrokeOutline(stroke.samples, viewport)
      drawStrokePolygon(context, outline, stroke.style.color, stroke.style.opacity)
    }
  }, [acetateStrokes, acetateVisible, canvasSize.height, canvasSize.width, viewport])

  useEffect(() => {
    if (active) return
    activePointerIdRef.current = null
    setCurrentSamples([])
  }, [active])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!active) return
      if (event.button !== 0) return

      const bounds = root.getBoundingClientRect()
      const sample = makeSample(event, viewport, bounds)
      activePointerIdRef.current = event.pointerId
      root.setPointerCapture(event.pointerId)
      setCurrentSamples([sample])
      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!active) return
      if (activePointerIdRef.current !== event.pointerId) return

      const bounds = root.getBoundingClientRect()
      const nextSample = makeSample(event, viewport, bounds)

      setCurrentSamples((previous) => {
        const last = previous[previous.length - 1]
        if (!last) return [nextSample]

        const distance = Math.hypot(nextSample.x - last.x, nextSample.y - last.y)
        if (distance < DEFAULT_INK_STROKE_DYNAMICS.sampleSpacing / Math.max(1, viewport.zoom)) {
          return previous
        }

        return [...previous, nextSample]
      })

      event.preventDefault()
    }

    const finishStroke = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return

      const bounds = root.getBoundingClientRect()
      const finalSample = makeSample(event, viewport, bounds)

      setCurrentSamples((previous) => {
        const samples =
          previous.length > 0 &&
          Math.hypot(finalSample.x - previous[previous.length - 1].x, finalSample.y - previous[previous.length - 1].y) > 0
            ? [...previous, finalSample]
            : previous

        if (samples.length > 1) {
          setAcetateStrokes((existing) => [
            ...existing,
            {
              id: crypto.randomUUID(),
              tool: 'pen',
              style: { ...DEFAULT_INK_STROKE_STYLE },
              dynamics: { ...DEFAULT_INK_STROKE_DYNAMICS },
              samples,
              createdAt: new Date().toISOString()
            }
          ])
        }

        return []
      })

      try {
        root.releasePointerCapture(event.pointerId)
      } catch {
        // ignore release failures if the pointer capture lifecycle already completed
      }
      activePointerIdRef.current = null
      event.preventDefault()
    }

    root.addEventListener('pointerdown', handlePointerDown)
    root.addEventListener('pointermove', handlePointerMove)
    root.addEventListener('pointerup', finishStroke)
    root.addEventListener('pointercancel', finishStroke)

    return () => {
      root.removeEventListener('pointerdown', handlePointerDown)
      root.removeEventListener('pointermove', handlePointerMove)
      root.removeEventListener('pointerup', finishStroke)
      root.removeEventListener('pointercancel', finishStroke)
    }
  }, [active, viewport])

  return (
    <div
      ref={rootRef}
      className={`ink-overlay${active ? ' ink-overlay--active' : ''}`}
      aria-hidden="true"
    >
      <canvas
        ref={acetateCanvasRef}
        className={`ink-overlay__canvas ink-overlay__canvas--acetate${acetateVisible ? ' ink-overlay__canvas--visible' : ''}`}
      />
      <canvas
        ref={glassCanvasRef}
        className={`ink-overlay__canvas ink-overlay__canvas--glass${active ? ' ink-overlay__canvas--visible' : ''}`}
      />
    </div>
  )
}
