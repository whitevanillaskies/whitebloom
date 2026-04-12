import { getStroke } from 'perfect-freehand'
import type { InkPagedUvSample, InkStroke } from '../../../../shared/ink'
import { DEFAULT_INK_STROKE_STYLE } from '../../../../shared/ink'

export type ScreenSample = {
  x: number
  y: number
  pressure: number
  t: number
}

export type PdfInkStroke = InkStroke & {
  samples: InkPagedUvSample[]
}

export type PageRectMap = Map<number, DOMRect>

type StrokePoint = [number, number, number]

const DEFAULT_PRESSURE = 0.5

export function clampPressure(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PRESSURE
  return Math.min(1, Math.max(0, value))
}

export function drawStrokePolygon(
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

export function collectVisiblePageRects(viewport: HTMLDivElement | null): PageRectMap {
  const rects: PageRectMap = new Map()
  if (!viewport) return rects

  const elements = viewport.querySelectorAll<HTMLElement>('[data-pdf-page-frame]')
  for (const element of elements) {
    const rawPageNumber = Number(element.dataset.pdfPageFrame)
    if (Number.isNaN(rawPageNumber)) continue
    rects.set(rawPageNumber, element.getBoundingClientRect())
  }

  return rects
}

export function screenSampleToPagedUv(
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

export function buildOutlineFromScreenSamples(
  samples: ScreenSample[],
  size = DEFAULT_INK_STROKE_STYLE.width
): Array<[number, number]> {
  const points: StrokePoint[] = samples.map((sample) => [sample.x, sample.y, sample.pressure])

  return getStroke(points, {
    size,
    thinning: 0.62,
    smoothing: 0.58,
    streamline: 0.44,
    simulatePressure: true,
    last: true
  })
}

export function buildPagedOutlineOnPage(
  samples: InkPagedUvSample[],
  pageWidth: number,
  pageHeight: number,
  size = DEFAULT_INK_STROKE_STYLE.width
): Array<[number, number]> {
  const points: StrokePoint[] = samples.map((sample) => [
    sample.u * pageWidth,
    sample.v * pageHeight,
    sample.pressure
  ])

  return getStroke(points, {
    size,
    thinning: 0.62,
    smoothing: 0.58,
    streamline: 0.44,
    simulatePressure: true,
    last: true
  })
}
