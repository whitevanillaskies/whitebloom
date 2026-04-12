import { useEffect, useRef } from 'react'
import { buildPagedOutlineOnPage, drawStrokePolygon, type PdfInkStroke } from './pdfInkShared'

type PdfAcetateCanvasProps = {
  pageWidth: number
  pageHeight: number
  visible: boolean
  strokes: PdfInkStroke[]
}

export function PdfAcetateCanvas({
  pageWidth,
  pageHeight,
  visible,
  strokes
}: PdfAcetateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(pageWidth * devicePixelRatio))
    canvas.height = Math.max(1, Math.floor(pageHeight * devicePixelRatio))
    canvas.style.width = `${pageWidth}px`
    canvas.style.height = `${pageHeight}px`

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    context.clearRect(0, 0, pageWidth, pageHeight)

    if (!visible) return

    for (const stroke of strokes) {
      const outline = buildPagedOutlineOnPage(
        stroke.samples,
        pageWidth,
        pageHeight,
        stroke.style.width
      )
      drawStrokePolygon(context, outline, stroke.style.color, stroke.style.opacity)
    }
  }, [pageHeight, pageWidth, strokes, visible])

  return <canvas ref={canvasRef} className="pdf-editor__page-acetate" aria-hidden="true" />
}
