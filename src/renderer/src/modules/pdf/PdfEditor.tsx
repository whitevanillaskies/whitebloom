import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  GalleryVertical,
  Layers3,
  Minus,
  PanelLeft,
  Pen,
  RectangleHorizontal,
  Plus,
  Rows3,
  X
} from 'lucide-react'
import type { BudEditorProps } from '../types'
import { resourceToMediaSrc } from '@renderer/shared/resource-url'
import { createInkTargetId, type InkPdfSurfaceBinding } from '../../../../shared/ink'
import { createLogger } from '../../../../shared/logger'
import { PdfAcetateCanvas } from './PdfAcetateCanvas'
import { PdfInkOverlay } from './PdfInkOverlay'
import type { PdfInkStroke } from './pdfInkShared'
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

type ViewMode = 'single' | 'single-continuous' | 'facing' | 'facing-continuous'
type SpreadLead = 'odd' | 'even'
type SpreadGapMode = 'open' | 'flush'

type Spread = {
  key: string
  pages: [number | null, number | null]
}

type PageCanvasProps = {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  layout: PageLayout | null
  acetateVisible: boolean
  acetateStrokes: PdfInkStroke[]
}

function PdfPageCanvas({
  doc,
  pageNumber,
  scale,
  layout,
  acetateVisible,
  acetateStrokes
}: PageCanvasProps) {
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
    <div className="pdf-editor__page-shell" style={shellStyle} data-pdf-page-shell={pageNumber}>
      <div
        className="pdf-editor__page-frame"
        style={{
          width: layout?.width ?? undefined,
          height: layout?.height ?? undefined
        }}
        data-pdf-page-frame={pageNumber}
      >
        {renderError ? <div className="pdf-editor__page-error">{renderError}</div> : null}
        <canvas ref={canvasRef} className="pdf-editor__page-canvas" />
        {layout ? (
          <PdfAcetateCanvas
            pageWidth={layout.width}
            pageHeight={layout.height}
            visible={acetateVisible}
            strokes={acetateStrokes}
          />
        ) : null}
      </div>
    </div>
  )
}

const MemoizedPdfPageCanvas = memo(PdfPageCanvas)

type VirtualizedPdfPageProps = {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  layout: PageLayout | null
  acetateVisible: boolean
  acetateStrokes: PdfInkStroke[]
  viewportRef: { current: HTMLDivElement | null }
}

function VirtualizedPdfPage({
  doc,
  pageNumber,
  scale,
  layout,
  acetateVisible,
  acetateStrokes,
  viewportRef
}: VirtualizedPdfPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    const root = viewportRef.current
    if (!element || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const nextVisible = entry?.isIntersecting === true
        setIsNearViewport(nextVisible)
        if (nextVisible) {
          setHasRendered(true)
        }
      },
      {
        root,
        rootMargin: '1400px 0px 1400px 0px',
        threshold: 0
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [viewportRef])

  const shouldRender = isNearViewport || hasRendered
  const shellStyle =
    layout !== null
      ? {
          width: layout.width + 24,
          minHeight: layout.height + 24
        }
      : undefined

  return (
    <div ref={containerRef} className="pdf-editor__virtual-page" style={shellStyle}>
      {shouldRender ? (
        <MemoizedPdfPageCanvas
          doc={doc}
          pageNumber={pageNumber}
          scale={scale}
          layout={layout}
          acetateVisible={acetateVisible}
          acetateStrokes={acetateStrokes}
        />
      ) : (
        <div className="pdf-editor__page-shell pdf-editor__page-shell--placeholder" style={shellStyle}>
          <div className="pdf-editor__page-ghost" />
        </div>
      )}
    </div>
  )
}

function buildFacingSpreads(pageCount: number, lead: SpreadLead): Spread[] {
  const spreads: Spread[] = []
  let current: [number | null, number | null] = [null, null]

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const goesLeft = (lead === 'odd' && pageNumber % 2 === 1) || (lead === 'even' && pageNumber % 2 === 0)
    if (goesLeft) {
      if (current[0] !== null || current[1] !== null) {
        spreads.push({
          key: `${current[0] ?? 'blank'}-${current[1] ?? 'blank'}-${spreads.length}`,
          pages: current
        })
      }
      current = [pageNumber, null]
    } else {
      current[1] = pageNumber
      spreads.push({
        key: `${current[0] ?? 'blank'}-${current[1] ?? 'blank'}-${spreads.length}`,
        pages: current
      })
      current = [null, null]
    }
  }

  if (current[0] !== null || current[1] !== null) {
    spreads.push({
      key: `${current[0] ?? 'blank'}-${current[1] ?? 'blank'}-${spreads.length}`,
      pages: current
    })
  }

  return spreads
}

export function PdfEditor({ resource, workspaceRoot, onClose }: BudEditorProps) {
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<ThumbnailState[]>([])
  const [activePage, setActivePage] = useState(1)
  const [activeTool, setActiveTool] = useState<'navigate' | 'ink'>('navigate')
  const [acetateVisible, setAcetateVisible] = useState(true)
  const [acetateStrokes, setAcetateStrokes] = useState<PdfInkStroke[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('single-continuous')
  const [spreadLead, setSpreadLead] = useState<SpreadLead>('odd')
  const [spreadGapMode, setSpreadGapMode] = useState<SpreadGapMode>('open')
  const [basePageLayouts, setBasePageLayouts] = useState<Record<number, PageLayout>>({})
  const pageRefs = useRef<Record<number, HTMLElement | null>>({})
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const inkBinding = useMemo<InkPdfSurfaceBinding>(
    () => ({
      surfaceType: 'pdf',
      coordinateSpace: 'paged-uv',
      resource,
      targetId: createInkTargetId('pdf', resource)
    }),
    [resource]
  )

  const pageLayouts = useMemo<Record<number, PageLayout>>(() => {
    const nextLayouts: Record<number, PageLayout> = {}

    for (const [key, baseLayout] of Object.entries(basePageLayouts)) {
      const pageNumber = Number(key)
      nextLayouts[pageNumber] = {
        width: baseLayout.width * scale,
        height: baseLayout.height * scale
      }
    }

    return nextLayouts
  }, [basePageLayouts, scale])

  const facingSpreads = useMemo(() => buildFacingSpreads(pageCount, spreadLead), [pageCount, spreadLead])
  const acetateStrokesByPage = useMemo<Record<number, PdfInkStroke[]>>(() => {
    const grouped: Record<number, PdfInkStroke[]> = {}

    for (const stroke of acetateStrokes) {
      let currentRun: typeof stroke.samples = []

      const pushRun = () => {
        if (currentRun.length === 0) return
        const pageNumber = currentRun[0].pageIndex
        grouped[pageNumber] ??= []
        grouped[pageNumber].push({
          ...stroke,
          samples: currentRun
        })
      }

      for (const sample of stroke.samples) {
        const previousPage = currentRun[0]?.pageIndex ?? null
        if (previousPage !== null && previousPage !== sample.pageIndex) {
          pushRun()
          currentRun = [sample]
          continue
        }

        currentRun = [...currentRun, sample]
      }

      pushRun()
    }

    return grouped
  }, [acetateStrokes])
  const activeSpreadIndex = Math.max(
    0,
    facingSpreads.findIndex((spread) => spread.pages.includes(activePage))
  )
  const activeSpread = facingSpreads[activeSpreadIndex] ?? null
  const isContinuousMode = viewMode === 'single-continuous' || viewMode === 'facing-continuous'

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
    setAcetateStrokes([])
    setBasePageLayouts({})

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
    let cancelled = false

    void window.api.readInkAcetate(workspaceRoot, inkBinding).then((result) => {
      if (cancelled) return
      setAcetateStrokes(
        result.ok && result.acetate ? (result.acetate.strokes as PdfInkStroke[]) : []
      )
    })

    return () => {
      cancelled = true
    }
  }, [inkBinding, workspaceRoot])

  useEffect(() => {
    if (!documentProxy || pageCount === 0) return
    const doc = documentProxy
    let cancelled = false

    async function loadBasePageLayouts(): Promise<void> {
      const layouts: Record<number, PageLayout> = {}

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return

        const viewport = page.getViewport({ scale: 1 })
        layouts[pageNumber] = {
          width: viewport.width,
          height: viewport.height
        }

        if (pageNumber % 12 === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
      }

      if (!cancelled) {
        setBasePageLayouts(layouts)
      }
    }

    void loadBasePageLayouts().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('page layout preload failed', { pageCount, message })
    })

    return () => {
      cancelled = true
    }
  }, [documentProxy, pageCount])

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
    if (isContinuousMode) return
    const viewport = scrollViewportRef.current
    if (!viewport) return
    viewport.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [activePage, activeSpreadIndex, isContinuousMode, viewMode])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport || pageCount === 0 || !isContinuousMode) return

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
  }, [isContinuousMode, pageCount, documentProxy, scale, viewMode])

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
    if (viewMode === 'facing') {
      const nextSpread = Math.max(0, activeSpreadIndex - 1)
      const candidate = facingSpreads[nextSpread]?.pages.find((page) => page !== null) ?? 1
      scrollToPage(candidate)
      return
    }

    const nextPage = Math.max(1, activePage - 1)
    scrollToPage(nextPage)
  }

  function handleNextPage(): void {
    if (viewMode === 'facing') {
      const nextSpread = Math.min(facingSpreads.length - 1, activeSpreadIndex + 1)
      const candidate = facingSpreads[nextSpread]?.pages.find((page) => page !== null) ?? pageCount
      scrollToPage(candidate)
      return
    }

    const nextPage = Math.min(pageCount, activePage + 1)
    scrollToPage(nextPage)
  }

  const discretePages =
    viewMode === 'single'
      ? [activePage]
      : activeSpread?.pages.filter((page): page is number => page !== null) ?? []

  return (
    <div
      className={`pdf-editor pdf-editor--${viewMode} pdf-editor--spread-gap-${spreadGapMode}${activeTool === 'ink' ? ' pdf-editor--tool-ink' : ''}`}
    >
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
            <div className="pdf-editor__toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className={`pdf-editor__icon-button${viewMode === 'single' ? ' pdf-editor__icon-button--active' : ''}`}
              onClick={() => setViewMode('single')}
              aria-label="Single page"
              title="Single page"
            >
              <RectangleHorizontal size={15} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className={`pdf-editor__icon-button${viewMode === 'single-continuous' ? ' pdf-editor__icon-button--active' : ''}`}
              onClick={() => setViewMode('single-continuous')}
              aria-label="Continuous page"
              title="Continuous page"
            >
              <Rows3 size={15} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className={`pdf-editor__icon-button${viewMode === 'facing' ? ' pdf-editor__icon-button--active' : ''}`}
              onClick={() => setViewMode('facing')}
              aria-label="Facing pages"
              title="Facing pages"
            >
              <Columns2 size={15} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className={`pdf-editor__icon-button${viewMode === 'facing-continuous' ? ' pdf-editor__icon-button--active' : ''}`}
              onClick={() => setViewMode('facing-continuous')}
              aria-label="Continuous facing pages"
              title="Continuous facing pages"
            >
              <GalleryVertical size={15} strokeWidth={1.7} />
            </button>
            <div className="pdf-editor__toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className={`pdf-editor__toggle-chip${spreadLead === 'odd' ? ' pdf-editor__toggle-chip--active' : ''}`}
              onClick={() => setSpreadLead('odd')}
              aria-label="Odd pages first"
              title="Odd pages first"
            >
              Odd First
            </button>
            <button
              type="button"
              className={`pdf-editor__toggle-chip${spreadLead === 'even' ? ' pdf-editor__toggle-chip--active' : ''}`}
              onClick={() => setSpreadLead('even')}
              aria-label="Even pages first"
              title="Even pages first"
            >
              Even First
            </button>
            <div className="pdf-editor__toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className={`pdf-editor__toggle-chip${spreadGapMode === 'flush' ? ' pdf-editor__toggle-chip--active' : ''}`}
              onClick={() => setSpreadGapMode('flush')}
              aria-label="Center gap flush"
              title="Center gap flush"
            >
              Gap Flush
            </button>
            <button
              type="button"
              className={`pdf-editor__toggle-chip${spreadGapMode === 'open' ? ' pdf-editor__toggle-chip--active' : ''}`}
              onClick={() => setSpreadGapMode('open')}
              aria-label="Center gap open"
              title="Center gap open"
            >
              Gap Open
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
              className={`pdf-editor__icon-button${activeTool === 'ink' ? ' pdf-editor__icon-button--active' : ''}`}
              onClick={() => setActiveTool((current) => (current === 'ink' ? 'navigate' : 'ink'))}
              aria-label="Ink tool"
              title="Ink tool"
            >
              <Pen size={15} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className={`pdf-editor__icon-button${acetateVisible ? ' pdf-editor__icon-button--toggle-active' : ''}`}
              onClick={() => setAcetateVisible((current) => !current)}
              aria-label="Show ink layers"
              title="Show ink layers"
            >
              <Layers3 size={15} strokeWidth={1.7} />
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

        <div className="pdf-editor__viewport-frame">
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

          {!errorMessage && documentProxy && isContinuousMode ? (
            <div className="pdf-editor__page-stack">
              {viewMode === 'single-continuous'
                ? Array.from({ length: pageCount }, (_, index) => {
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
                        <VirtualizedPdfPage
                          doc={documentProxy}
                          pageNumber={pageNumber}
                          scale={scale}
                          layout={pageLayouts[pageNumber] ?? null}
                          acetateVisible={acetateVisible}
                          acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                          viewportRef={scrollViewportRef}
                        />
                      </section>
                    )
                  })
                : facingSpreads.map((spread) => (
                    <section
                      key={spread.key}
                      ref={(element) => {
                        const primaryPage = spread.pages.find((page) => page !== null)
                        if (primaryPage !== undefined) {
                          pageRefs.current[primaryPage] = element
                        }
                      }}
                      className="pdf-editor__spread"
                      data-page-number={spread.pages.find((page) => page !== null) ?? undefined}
                    >
                      <div className="pdf-editor__spread-meta">
                        {spread.pages[0] ?? '—'} · {spread.pages[1] ?? '—'}
                      </div>
                      <div className="pdf-editor__spread-pages">
                        {spread.pages.map((pageNumber, slotIndex) =>
                          pageNumber !== null ? (
                            <div key={pageNumber} className="pdf-editor__spread-page">
                              <VirtualizedPdfPage
                                doc={documentProxy}
                                pageNumber={pageNumber}
                                scale={scale}
                                layout={pageLayouts[pageNumber] ?? null}
                                acetateVisible={acetateVisible}
                                acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                                viewportRef={scrollViewportRef}
                              />
                            </div>
                          ) : (
                            <div
                              key={`blank-${spread.key}-${slotIndex}`}
                              className="pdf-editor__spread-placeholder"
                            />
                          )
                        )}
                      </div>
                    </section>
                  ))}
            </div>
          ) : null}

          {!errorMessage && documentProxy && !isContinuousMode ? (
            <div className="pdf-editor__discrete-stage">
              {viewMode === 'single'
                ? discretePages.map((pageNumber) => (
                    <section key={pageNumber} className="pdf-editor__page pdf-editor__page--discrete">
                      <div className="pdf-editor__page-meta">{pageNumber}</div>
                      <MemoizedPdfPageCanvas
                        doc={documentProxy}
                        pageNumber={pageNumber}
                        scale={scale}
                        layout={pageLayouts[pageNumber] ?? null}
                        acetateVisible={acetateVisible}
                        acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                      />
                    </section>
                  ))
                : (
                  <section className="pdf-editor__spread pdf-editor__spread--discrete">
                    <div className="pdf-editor__spread-meta">
                      {activeSpread?.pages[0] ?? '—'} · {activeSpread?.pages[1] ?? '—'}
                    </div>
                    <div className="pdf-editor__spread-pages">
                      {(activeSpread?.pages ?? [null, null]).map((pageNumber, slotIndex) =>
                        pageNumber !== null ? (
                          <div key={pageNumber} className="pdf-editor__spread-page">
                            <MemoizedPdfPageCanvas
                              doc={documentProxy}
                              pageNumber={pageNumber}
                              scale={scale}
                              layout={pageLayouts[pageNumber] ?? null}
                              acetateVisible={acetateVisible}
                              acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                            />
                          </div>
                        ) : (
                          <div
                            key={`blank-discrete-${slotIndex}`}
                            className="pdf-editor__spread-placeholder"
                          />
                        )
                      )}
                    </div>
                  </section>
                  )}
            </div>
          ) : null}
          </div>
          {documentProxy ? (
            <PdfInkOverlay
              viewportRef={scrollViewportRef}
              active={activeTool === 'ink'}
              onTransfer={(stroke) => {
                setAcetateStrokes((existing) => [...existing, stroke])
                void window.api.appendInkStroke(workspaceRoot, inkBinding, stroke)
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
