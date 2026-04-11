import { useEffect, useMemo, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import type { InkPagedUvSample, InkStroke } from '../../../../shared/ink'
import {
  DEFAULT_INK_STROKE_DYNAMICS,
  DEFAULT_INK_STROKE_STYLE
} from '../../../../shared/ink'

type PdfInkOverlayProps = {
  viewportRef: { current: HTMLDivElement | null }
  active: boolean
  acetateVisible: boolean
}

type ScreenSample = {
  x: number
  y: number
  pressure: number
  t: number
}

type PdfDrawStroke = InkStroke & {
  samples: InkPagedUvSample[]
}

type PageRectMap = Map<number, DOMRect>
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

function collectVisiblePageRects(viewport: HTMLDivElement | null): PageRectMap {
  const rects: PageRectMap = new Map()
  if (!viewport) return rects

  const elements = viewport.querySelectorAll<HTMLElement>('[data-pdf-page-shell]')
  for (const element of elements) {
    const rawPageNumber = Number(element.dataset.pdfPageShell)
    if (Number.isNaN(rawPageNumber)) continue
    rects.set(rawPageNumber, element.getBoundingClientRect())
  }

  return rects
}

function screenSampleToPagedUv(
  sample: ScreenSample,
  overlayBounds: DOMRect,
  pageRects: PageRectMap
): InkPagedUvSample | null {
  const clientX = overlayBounds.left + sample.x
  const clientY = overlayBounds.top + sample.y

  for (const [pageIndex, rect] of pageRects.entries()) {
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      return {
        pageIndex,
        u: (clientX - rect.left) / width,
        v: (clientY - rect.top) / height,
        pressure: sample.pressure,
        t: sample.t
      }
    }
  }

  return null
}

function pagedUvSampleToScreen(
  sample: InkPagedUvSample,
  overlayBounds: DOMRect,
  pageRects: PageRectMap
): [number, number] | null {
  const rect = pageRects.get(sample.pageIndex)
  if (!rect) return null

  return [
    rect.left - overlayBounds.left + sample.u * rect.width,
    rect.top - overlayBounds.top + sample.v * rect.height
  ]
}

function buildOutlineFromScreenSamples(samples: ScreenSample[]): Array<[number, number]> {
  const points: StrokePoint[] = samples.map((sample) => [sample.x, sample.y, sample.pressure])

  return getStroke(points, {
    size: DEFAULT_INK_STROKE_STYLE.width,
    thinning: 0.62,
    smoothing: 0.58,
    streamline: 0.44,
    simulatePressure: true,
    last: true
  })
}

function buildPagedOutline(
  samples: InkPagedUvSample[],
  overlayBounds: DOMRect,
  pageRects: PageRectMap
): Array<[number, number]> {
  const points: StrokePoint[] = []

  for (const sample of samples) {
    const screenPoint = pagedUvSampleToScreen(sample, overlayBounds, pageRects)
    if (!screenPoint) continue
    points.push([screenPoint[0], screenPoint[1], sample.pressure])
  }

  return getStroke(points, {
    size: DEFAULT_INK_STROKE_STYLE.width,
    thinning: 0.62,
    smoothing: 0.58,
    streamline: 0.44,
    simulatePressure: true,
    last: true
  })
}

function splitSamplesByPageRuns(samples: InkPagedUvSample[]): InkPagedUvSample[][] {
  if (samples.length === 0) return []

  const groups: InkPagedUvSample[][] = []
  let currentGroup: InkPagedUvSample[] = [samples[0]]

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    const previous = samples[index - 1]

    if (sample.pageIndex !== previous.pageIndex) {
      groups.push(currentGroup)
      currentGroup = [sample]
      continue
    }

    currentGroup.push(sample)
  }

  groups.push(currentGroup)
  return groups
}

export function PdfInkOverlay({ viewportRef, active, acetateVisible }: PdfInkOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const glassCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const acetateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, pixelRatio: 1 })
  const [currentSamples, setCurrentSamples] = useState<ScreenSample[]>([])
  const [acetateStrokes, setAcetateStrokes] = useState<PdfDrawStroke[]>([])
  const [renderTick, setRenderTick] = useState(0)

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
    const viewport = viewportRef.current
    if (!viewport) return

    let frame = 0
    const scheduleRedraw = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setRenderTick((value) => value + 1)
      })
    }

    viewport.addEventListener('scroll', scheduleRedraw, { passive: true })
    window.addEventListener('resize', scheduleRedraw)

    return () => {
      viewport.removeEventListener('scroll', scheduleRedraw)
      window.removeEventListener('resize', scheduleRedraw)
      cancelAnimationFrame(frame)
    }
  }, [viewportRef])

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
    const root = rootRef.current
    if (!canvas || !root) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvasSize.width, canvasSize.height)
    if (!acetateVisible) return

    const overlayBounds = root.getBoundingClientRect()
    const pageRects = collectVisiblePageRects(viewportRef.current)

    for (const stroke of acetateStrokes) {
      for (const run of splitSamplesByPageRuns(stroke.samples)) {
        const outline = buildPagedOutline(run, overlayBounds, pageRects)
        drawStrokePolygon(context, outline, stroke.style.color, stroke.style.opacity)
      }
    }
  }, [acetateStrokes, acetateVisible, canvasSize.height, canvasSize.width, renderTick, viewportRef])

  useEffect(() => {
    if (active) return
    activePointerIdRef.current = null
    setCurrentSamples([])
  }, [active])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const makeScreenSample = (event: PointerEvent, bounds: DOMRect): ScreenSample => ({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      pressure: clampPressure(event.pressure),
      t: event.timeStamp
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (!active) return
      if (event.button !== 0) return

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

    const finishStroke = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId) return

      const bounds = root.getBoundingClientRect()
      const finalSample = makeScreenSample(event, bounds)
      const pageRects = collectVisiblePageRects(viewportRef.current)

      setCurrentSamples((previous) => {
        const completeSamples =
          previous.length > 0 &&
          Math.hypot(
            finalSample.x - previous[previous.length - 1].x,
            finalSample.y - previous[previous.length - 1].y
          ) > 0
            ? [...previous, finalSample]
            : previous

        const pagedSamples = completeSamples
          .map((sample) => screenSampleToPagedUv(sample, bounds, pageRects))
          .filter((sample): sample is InkPagedUvSample => sample !== null)

        if (pagedSamples.length > 1) {
          setAcetateStrokes((existing) => [
            ...existing,
            {
              id: crypto.randomUUID(),
              tool: 'pen',
              style: { ...DEFAULT_INK_STROKE_STYLE },
              dynamics: { ...DEFAULT_INK_STROKE_DYNAMICS },
              samples: pagedSamples,
              createdAt: new Date().toISOString()
            }
          ])
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
  }, [active, viewportRef])

  return (
    <div
      ref={rootRef}
      className={`pdf-ink-overlay${active ? ' pdf-ink-overlay--active' : ''}`}
      aria-hidden="true"
    >
      <canvas
        ref={acetateCanvasRef}
        className={`pdf-ink-overlay__canvas pdf-ink-overlay__canvas--acetate${acetateVisible ? ' pdf-ink-overlay__canvas--visible' : ''}`}
      />
      <canvas
        ref={glassCanvasRef}
        className={`pdf-ink-overlay__canvas pdf-ink-overlay__canvas--glass${active ? ' pdf-ink-overlay__canvas--visible' : ''}`}
      />
    </div>
  )
}
