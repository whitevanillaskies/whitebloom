import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  PanelLeft,
  Plus,
  X
} from 'lucide-react'
import type { BudEditorProps } from '../types'
import { resourceToMediaSrc } from '@renderer/shared/resource-url'
import { createLogger } from '../../../../shared/logger'
import './PdfEditor.css'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).toString()
const logger = createLogger('pdf-editor')

const THUMBNAIL_SCALE = 0.18
const DEFAULT_SCALE = 1.1
const MIN_SCALE = 0.5
const MAX_SCALE = 2.4
const SCALE_STEP = 0.1

type ThumbnailState = {
  pageNumber: number
  dataUrl: string | null
}

type PageLayout = {
  width: number
  height: number
}

type PageCanvasProps = {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  layout: PageLayout | null
}

function PdfPageCanvas({ doc, pageNumber, scale, layout }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | null = null

    async function renderPage(): Promise<void> {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return

      const viewport = page.getViewport({ scale })
      const devicePixelRatio = window.devicePixelRatio || 1
      const canvas = canvasRef.current
      if (!canvas) return

      const context = canvas.getContext('2d')
      if (!context) return

      setRenderError(null)
      const reservedWidth = layout?.width ?? viewport.width
      const reservedHeight = layout?.height ?? viewport.height

      canvas.width = Math.floor(viewport.width * devicePixelRatio)
      canvas.height = Math.floor(viewport.height * devicePixelRatio)
      canvas.style.width = `${reservedWidth}px`
      canvas.style.height = `${reservedHeight}px`

      const transform =
        devicePixelRatio === 1 ? undefined : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
      renderTask = page.render({
        canvas,
        canvasContext: context,
        transform,
        viewport
      })

      await renderTask.promise
    }

    void renderPage().catch((error: unknown) => {
      if (!cancelled) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('page render failed', {
          pageNumber,
          scale,
          workerSrc: GlobalWorkerOptions.workerSrc,
          message
        })
        setRenderError(`Page ${pageNumber} failed to render: ${message}`)
      }
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [doc, layout, pageNumber, scale])

  const shellStyle =
    layout !== null
      ? {
          width: layout.width + 24,
          minHeight: layout.height + 24
        }
      : undefined

  return (
    <div className="pdf-editor__page-shell" style={shellStyle}>
      {renderError ? <div className="pdf-editor__page-error">{renderError}</div> : null}
      <canvas ref={canvasRef} className="pdf-editor__page-canvas" />
    </div>
  )
}

export function PdfEditor({ resource, workspaceRoot, onClose }: BudEditorProps) {
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<ThumbnailState[]>([])
  const [activePage, setActivePage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [pageLayouts, setPageLayouts] = useState<Record<number, PageLayout>>({})
  const pageRefs = useRef<Record<number, HTMLElement | null>>({})
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const src = resourceToMediaSrc(resource, workspaceRoot)
    const task = getDocument(src)
    logger.info('opening pdf resource', {
      resource,
      workspaceRoot,
      src,
      workerSrc: GlobalWorkerOptions.workerSrc
    })

    setDocumentProxy(null)
    setPageCount(0)
    setErrorMessage(null)
    setThumbnails([])
    setActivePage(1)
    setPageLayouts({})

    void task.promise
      .then((doc) => {
        if (cancelled) return
        logger.info('pdf opened', {
          src,
          pageCount: doc.numPages
        })
        setDocumentProxy(doc)
        setPageCount(doc.numPages)
        setThumbnails(
          Array.from({ length: doc.numPages }, (_, index) => ({
            pageNumber: index + 1,
            dataUrl: null
          }))
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        logger.error('pdf open failed', {
          resource,
          workspaceRoot,
          src,
          workerSrc: GlobalWorkerOptions.workerSrc,
          message
        })
        setErrorMessage(message)
      })

    return () => {
      cancelled = true
      task.destroy()
    }
  }, [resource, workspaceRoot])

  useEffect(() => {
    if (!documentProxy || pageCount === 0) return
    const doc = documentProxy
    let cancelled = false

    async function loadPageLayouts(): Promise<void> {
      const layouts: Record<number, PageLayout> = {}

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        layouts[pageNumber] = {
          width: viewport.width,
          height: viewport.height
        }

        if (pageNumber % 12 === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
      }

      if (!cancelled) {
        setPageLayouts(layouts)
      }
    }

    void loadPageLayouts().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('page layout preload failed', { pageCount, scale, message })
    })

    return () => {
      cancelled = true
    }
  }, [documentProxy, pageCount, scale])

  useEffect(() => {
    if (!documentProxy || pageCount === 0) return
    const doc = documentProxy

    let cancelled = false

    async function renderThumbnails(): Promise<void> {
      const nextThumbnails: ThumbnailState[] = []

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return

        const viewport = page.getViewport({ scale: THUMBNAIL_SCALE })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          nextThumbnails.push({ pageNumber, dataUrl: null })
          continue
        }

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport
        })

        await renderTask.promise
        if (cancelled) return

        nextThumbnails.push({
          pageNumber,
          dataUrl: canvas.toDataURL('image/png')
        })

        if (pageNumber % 6 === 0) {
          setThumbnails([...nextThumbnails])
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          if (cancelled) return
        }
      }

      if (!cancelled) {
        setThumbnails(nextThumbnails)
      }
    }

    void renderThumbnails().catch((error: unknown) => {
      if (!cancelled) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('thumbnail render failed', {
          pageCount,
          message
        })
        setThumbnails(
          Array.from({ length: pageCount }, (_, index) => ({
            pageNumber: index + 1,
            dataUrl: null
          }))
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [documentProxy, pageCount])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport || pageCount === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visibleEntries.length === 0) return
        const pageNumber = Number(visibleEntries[0].target.getAttribute('data-page-number'))
        if (!Number.isNaN(pageNumber)) {
          setActivePage(pageNumber)
        }
      },
      {
        root: viewport,
        threshold: [0.35, 0.6, 0.85]
      }
    )

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const element = pageRefs.current[pageNumber]
      if (element) observer.observe(element)
    }

    return () => observer.disconnect()
  }, [pageCount, documentProxy, scale])

  function scrollToPage(pageNumber: number): void {
    pageRefs.current[pageNumber]?.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'smooth'
    })
    setActivePage(pageNumber)
  }

  function handleZoomIn(): void {
    setScale((current) => Math.min(MAX_SCALE, Math.round((current + SCALE_STEP) * 10) / 10))
  }

  function handleZoomOut(): void {
    setScale((current) => Math.max(MIN_SCALE, Math.round((current - SCALE_STEP) * 10) / 10))
  }

  function handlePreviousPage(): void {
    const nextPage = Math.max(1, activePage - 1)
    scrollToPage(nextPage)
  }

  function handleNextPage(): void {
    const nextPage = Math.min(pageCount, activePage + 1)
    scrollToPage(nextPage)
  }

  return (
    <div className="pdf-editor">
      <div className="pdf-editor__chrome">
        <div className="pdf-editor__toolbar">
          <div className="pdf-editor__toolbar-group">
            <button
              type="button"
              className="pdf-editor__icon-button"
              onClick={() => setSidebarOpen((current) => !current)}
              aria-label={sidebarOpen ? 'Hide page sidebar' : 'Show page sidebar'}
            >
              <PanelLeft size={15} strokeWidth={1.7} />
            </button>
          </div>

          <div className="pdf-editor__toolbar-group pdf-editor__toolbar-group--center">
            <button
              type="button"
              className="pdf-editor__icon-button"
              onClick={handlePreviousPage}
              disabled={activePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} strokeWidth={1.7} />
            </button>
            <div className="pdf-editor__status-pill">
              <span className="pdf-editor__status-value">{activePage}</span>
              <span className="pdf-editor__status-separator">/</span>
              <span>{pageCount || '—'}</span>
            </div>
            <button
              type="button"
              className="pdf-editor__icon-button"
              onClick={handleNextPage}
              disabled={pageCount === 0 || activePage >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight size={15} strokeWidth={1.7} />
            </button>
          </div>

          <div className="pdf-editor__toolbar-group">
            <button
              type="button"
              className="pdf-editor__icon-button"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
              aria-label="Zoom out"
            >
              <Minus size={15} strokeWidth={1.7} />
            </button>
            <div className="pdf-editor__zoom-readout">{Math.round(scale * 100)}%</div>
            <button
              type="button"
              className="pdf-editor__icon-button"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
              aria-label="Zoom in"
            >
              <Plus size={15} strokeWidth={1.7} />
            </button>
            <div className="pdf-editor__toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="pdf-editor__icon-button"
              onClick={onClose}
              aria-label="Close PDF viewer"
            >
              <X size={15} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </div>

      <div className="pdf-editor__body">
        {sidebarOpen && (
          <aside className="pdf-editor__sidebar" aria-label="Page thumbnails">
            <div className="pdf-editor__sidebar-header">Pages</div>
            <div className="pdf-editor__thumbnail-list">
              {thumbnails.map((thumbnail) => (
                <button
                  key={thumbnail.pageNumber}
                  type="button"
                  className={`pdf-editor__thumbnail${thumbnail.pageNumber === activePage ? ' pdf-editor__thumbnail--active' : ''}`}
                  onClick={() => scrollToPage(thumbnail.pageNumber)}
                >
                  <div className="pdf-editor__thumbnail-frame">
                    {thumbnail.dataUrl ? (
                      <img
                        src={thumbnail.dataUrl}
                        alt=""
                        className="pdf-editor__thumbnail-image"
                        draggable={false}
                      />
                    ) : (
                      <div className="pdf-editor__thumbnail-placeholder" />
                    )}
                  </div>
                  <span className="pdf-editor__thumbnail-label">{thumbnail.pageNumber}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <div ref={scrollViewportRef} className="pdf-editor__viewport">
          {errorMessage ? (
            <div className="pdf-editor__empty-state">
              <p className="pdf-editor__empty-title">Unable to open PDF</p>
              <p className="pdf-editor__empty-body">{errorMessage}</p>
            </div>
          ) : null}

          {!errorMessage && !documentProxy ? (
            <div className="pdf-editor__empty-state">
              <p className="pdf-editor__empty-title">Opening PDF</p>
              <p className="pdf-editor__empty-body">Preparing pages for a focused reading view.</p>
            </div>
          ) : null}

          {!errorMessage && documentProxy ? (
            <div className="pdf-editor__page-stack">
              {Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1
                return (
                  <section
                    key={pageNumber}
                    ref={(element) => {
                      pageRefs.current[pageNumber] = element
                    }}
                    className="pdf-editor__page"
                    data-page-number={pageNumber}
                  >
                    <div className="pdf-editor__page-meta">{pageNumber}</div>
                    <PdfPageCanvas
                      doc={documentProxy}
                      pageNumber={pageNumber}
                      scale={scale}
                      layout={pageLayouts[pageNumber] ?? null}
                    />
                  </section>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
