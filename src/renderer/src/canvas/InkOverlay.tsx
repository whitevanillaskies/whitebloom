import { useEffect, useMemo, useRef, useState } from 'react'
import { useViewport, useReactFlow } from '@xyflow/react'
import { getStroke } from 'perfect-freehand'
import type { InkBoardWorldSample, InkStroke } from '../../../shared/ink'
import {
  DEFAULT_INK_STROKE_DYNAMICS,
  DEFAULT_INK_STROKE_STYLE
} from '../../../shared/ink'
import type { InkTool } from './InkToolbar'
import './InkOverlay.css'

const ERASER_SCREEN_RADIUS = 20

type InkOverlayProps = {
  active: boolean
  activeTool: InkTool
  acetateVisible: boolean
  acetateStrokes: BoardInkStroke[]
  onTransfer: (stroke: BoardInkStroke) => void
  onEraseComplete: (erasedStrokes: BoardInkStroke[]) => void
}

export type BoardInkStroke = InkStroke & {
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

function isValidPointerSample(event: PointerEvent): boolean {
  return Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4

export function InkOverlay({
  active,
  activeTool,
  acetateVisible,
  acetateStrokes,
  onTransfer,
  onEraseComplete
}: InkOverlayProps) {
  const viewport = useViewport()
  const { setViewport, getViewport } = useReactFlow()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const acetateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const panPointerIdRef = useRef<number | null>(null)
  const panLastXRef = useRef<number>(0)
  const panLastYRef = useRef<number>(0)
  const currentSamplesRef = useRef<InkBoardWorldSample[]>([])
  const erasedIdsRef = useRef<Set<string>>(new Set())
  const acetateStrokesRef = useRef<BoardInkStroke[]>(acetateStrokes)
  const activeToolRef = useRef<InkTool>(activeTool)
  const onEraseCompleteRef = useRef(onEraseComplete)
  const setViewportRef = useRef(setViewport)
  const getViewportRef = useRef(getViewport)
  useEffect(() => { setViewportRef.current = setViewport }, [setViewport])
  useEffect(() => { getViewportRef.current = getViewport }, [getViewport])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, pixelRatio: 1 })
  const [currentSamples, setCurrentSamples] = useState<InkBoardWorldSample[]>([])
  const [erasedIds, setErasedIds] = useState<ReadonlySet<string>>(new Set())
  const currentOutline = useMemo(
    () => (currentSamples.length > 1 ? buildStrokeOutline(currentSamples, viewport) : []),
    [currentSamples, viewport]
  )

  useEffect(() => { acetateStrokesRef.current = acetateStrokes }, [acetateStrokes])
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
      if (erasedIds.has(stroke.id)) continue
      const outline = buildStrokeOutline(stroke.samples, viewport)
      drawStrokePolygon(context, outline, stroke.style.color, stroke.style.opacity)
    }
  }, [acetateStrokes, acetateVisible, canvasSize.height, canvasSize.width, viewport, erasedIds])

  useEffect(() => {
    if (active) return
    activePointerIdRef.current = null
    panPointerIdRef.current = null
    currentSamplesRef.current = []
    setCurrentSamples([])
    erasedIdsRef.current = new Set()
    setErasedIds(new Set())
  }, [active])

  useEffect(() => {
    if (activePointerIdRef.current === null && erasedIds.size > 0) {
      erasedIdsRef.current = new Set()
      setErasedIds(new Set())
    }
  }, [acetateStrokes, erasedIds.size])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!active) return

      // Middle mouse button — pan the canvas
      if (event.button === 1) {
        panPointerIdRef.current = event.pointerId
        panLastXRef.current = event.clientX
        panLastYRef.current = event.clientY
        root.setPointerCapture(event.pointerId)
        event.preventDefault()
        return
      }

      if (event.button !== 0) return
      if (!isValidPointerSample(event)) return

      const tool = activeToolRef.current
      activePointerIdRef.current = event.pointerId
      root.setPointerCapture(event.pointerId)

      if (tool === 'pen') {
        const bounds = root.getBoundingClientRect()
        const sample = makeSample(event, viewport, bounds)
        currentSamplesRef.current = [sample]
        setCurrentSamples([sample])
        erasedIdsRef.current = new Set()
        setErasedIds(new Set())
      } else if (tool === 'eraser') {
        erasedIdsRef.current = new Set()
        setErasedIds(new Set())
      }

      event.preventDefault()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!active) return

      // Middle mouse button pan
      if (panPointerIdRef.current === event.pointerId) {
        const dx = event.clientX - panLastXRef.current
        const dy = event.clientY - panLastYRef.current
        panLastXRef.current = event.clientX
        panLastYRef.current = event.clientY
        const vp = getViewportRef.current()
        setViewportRef.current({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom })
        event.preventDefault()
        return
      }

      if (activePointerIdRef.current !== event.pointerId) return
      if (!isValidPointerSample(event)) return

      const tool = activeToolRef.current

      if (tool === 'pen') {
        const bounds = root.getBoundingClientRect()
        const nextSample = makeSample(event, viewport, bounds)
        const previous = currentSamplesRef.current
        const last = previous[previous.length - 1]

        if (!last) {
          currentSamplesRef.current = [nextSample]
          setCurrentSamples([nextSample])
          event.preventDefault()
          return
        }

        const distance = Math.hypot(nextSample.x - last.x, nextSample.y - last.y)
        if (distance < DEFAULT_INK_STROKE_DYNAMICS.sampleSpacing / Math.max(1, viewport.zoom)) {
          event.preventDefault()
          return
        }

        const next = [...previous, nextSample]
        currentSamplesRef.current = next
        setCurrentSamples(next)
      } else if (tool === 'eraser') {
        const bounds = root.getBoundingClientRect()
        const worldX = (event.clientX - bounds.left - viewport.x) / viewport.zoom
        const worldY = (event.clientY - bounds.top - viewport.y) / viewport.zoom
        const eraserWorldRadius = ERASER_SCREEN_RADIUS / viewport.zoom

        const strokes = acetateStrokesRef.current
        let changed = false
        for (const stroke of strokes) {
          if (erasedIdsRef.current.has(stroke.id)) continue
          for (const sample of stroke.samples) {
            if (Math.hypot(sample.x - worldX, sample.y - worldY) <= eraserWorldRadius) {
              erasedIdsRef.current.add(stroke.id)
              changed = true
              break
            }
          }
        }
        if (changed) setErasedIds(new Set(erasedIdsRef.current))
      }

      event.preventDefault()
    }

    const finalizeStroke = (event: PointerEvent, includeFinalSample: boolean) => {
      // Release MMB pan
      if (panPointerIdRef.current === event.pointerId) {
        panPointerIdRef.current = null
        try { root.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
        event.preventDefault()
        return
      }

      if (activePointerIdRef.current !== event.pointerId) return

      const tool = activeToolRef.current

      if (tool === 'pen') {
        const bounds = includeFinalSample ? root.getBoundingClientRect() : null
        const finalSample =
          includeFinalSample && bounds !== null && isValidPointerSample(event)
            ? makeSample(event, viewport, bounds)
            : null

        const previous = currentSamplesRef.current
        const samples =
          finalSample !== null &&
          previous.length > 0 &&
          Math.hypot(finalSample.x - previous[previous.length - 1].x, finalSample.y - previous[previous.length - 1].y) > 0
            ? [...previous, finalSample]
            : previous

        currentSamplesRef.current = []
        setCurrentSamples([])
        activePointerIdRef.current = null

        if (samples.length > 1) {
          onTransfer({
            id: crypto.randomUUID(),
            tool: 'pen',
            style: { ...DEFAULT_INK_STROKE_STYLE },
            dynamics: { ...DEFAULT_INK_STROKE_DYNAMICS },
            samples,
            createdAt: new Date().toISOString()
          })
        }
      } else if (tool === 'eraser') {
        activePointerIdRef.current = null
        const hitIds = erasedIdsRef.current
        if (hitIds.size > 0) {
          const strokes = acetateStrokesRef.current
          const erasedStrokes = strokes.filter((s) => hitIds.has(s.id))
          if (erasedStrokes.length > 0) {
            onEraseCompleteRef.current(erasedStrokes)
          }
        }
        // erasedIdsRef is intentionally left populated so the acetate doesn't flash
        // the strokes back before the parent removes them from acetateStrokes.
        // It will be cleared at the start of the next gesture.
      }

      try {
        root.releasePointerCapture(event.pointerId)
      } catch {
        // ignore release failures if the pointer capture lifecycle already completed
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
  }, [active, onTransfer, viewport])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handleWheel = (event: WheelEvent) => {
      if (!active) return
      event.preventDefault()

      const vp = getViewportRef.current()
      const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * zoomFactor))

      // Keep the point under the cursor fixed while zooming
      const bounds = root.getBoundingClientRect()
      const mouseX = event.clientX - bounds.left
      const mouseY = event.clientY - bounds.top
      const worldX = (mouseX - vp.x) / vp.zoom
      const worldY = (mouseY - vp.y) / vp.zoom

      setViewportRef.current({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom,
        zoom: newZoom
      })
    }

    root.addEventListener('wheel', handleWheel, { passive: false })
    return () => root.removeEventListener('wheel', handleWheel)
  }, [active])

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
