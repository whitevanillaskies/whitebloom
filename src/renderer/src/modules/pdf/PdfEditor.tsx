import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  AlignLeft,
  AlignRight,
  Columns2,
  GalleryVertical,
  Layers3,
  PanelLeft,
  Pen,
  Rows3,
  SeparatorVertical
} from 'lucide-react'
import {
  PetalShelf,
  PetalShelfGroup,
  PetalShelfItem,
  PetalShelfZoomItem
} from '../../components/petal/shelf'
import type { BudEditorProps } from '../types'
import { resourceToMediaSrc } from '@renderer/shared/resource-url'
import { createInkTargetId, type InkPdfSurfaceBinding } from '../../../../shared/ink'
import { createLogger } from '../../../../shared/logger'
import { createPdfCommandContext, executeCommandById, WHITEBLOOM_COMMAND_IDS } from '../../commands'
import { useHistoryStore } from '../../history/store'
import { InkToolbar } from '../../canvas/InkToolbar'
import type { InkTool } from '../../canvas/InkToolbar'
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

type PdfViewState = {
  activePage: number
  scale: number
  sidebarOpen: boolean
  viewMode: ViewMode
  spreadLead: SpreadLead
  spreadGapMode: SpreadGapMode
}

const PDF_VIEW_MODES: ViewMode[] = ['single', 'single-continuous', 'facing', 'facing-continuous']
const PDF_SPREAD_LEADS: SpreadLead[] = ['odd', 'even']
const PDF_SPREAD_GAP_MODES: SpreadGapMode[] = ['open', 'flush']
const RENDER_SCALE_DEBOUNCE_MS = 160
const PDF_RENDER_CONCURRENCY = 2

function getPdfStateResource(resource: string): string {
  const stem = resource
    .replace(/^[a-z]+:/, '')
    .replace(/\//g, '__')
    .replace(/[^a-zA-Z0-9._-]/g, '_')

  return `wloc:.wbstates/pdf/${stem}.json`
}

function parsePersistedPdfViewState(data: string): Partial<PdfViewState> | null {
  if (!data.trim()) return null

  try {
    const parsed = JSON.parse(data) as Partial<PdfViewState>
    const nextState: Partial<PdfViewState> = {}

    if (
      typeof parsed.activePage === 'number' &&
      Number.isInteger(parsed.activePage) &&
      parsed.activePage > 0
    ) {
      nextState.activePage = parsed.activePage
    }

    if (typeof parsed.scale === 'number' && Number.isFinite(parsed.scale)) {
      nextState.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed.scale))
    }

    if (typeof parsed.sidebarOpen === 'boolean') {
      nextState.sidebarOpen = parsed.sidebarOpen
    }

    if (
      typeof parsed.viewMode === 'string' &&
      PDF_VIEW_MODES.includes(parsed.viewMode as ViewMode)
    ) {
      nextState.viewMode = parsed.viewMode as ViewMode
    }

    if (
      typeof parsed.spreadLead === 'string' &&
      PDF_SPREAD_LEADS.includes(parsed.spreadLead as SpreadLead)
    ) {
      nextState.spreadLead = parsed.spreadLead as SpreadLead
    }

    if (
      typeof parsed.spreadGapMode === 'string' &&
      PDF_SPREAD_GAP_MODES.includes(parsed.spreadGapMode as SpreadGapMode)
    ) {
      nextState.spreadGapMode = parsed.spreadGapMode as SpreadGapMode
    }

    return nextState
  } catch (error) {
    logger.warn('failed to parse persisted pdf view state', {
      message: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

type Spread = {
  key: string
  pages: [number | null, number | null]
}

type PdfRenderScheduler = {
  schedule: (job: () => Promise<void>, priority: number) => () => void
}

function createPdfRenderScheduler(maxConcurrent: number): PdfRenderScheduler {
  type QueueItem = {
    id: number
    priority: number
    cancelled: boolean
    job: () => Promise<void>
  }

  let nextId = 1
  let activeCount = 0
  let queue: QueueItem[] = []

  function pump(): void {
    queue = queue.filter((item) => !item.cancelled)
    queue.sort((a, b) => a.priority - b.priority || a.id - b.id)

    while (activeCount < maxConcurrent && queue.length > 0) {
      const item = queue.shift()
      if (!item || item.cancelled) continue

      activeCount += 1
      void item
        .job()
        .catch(() => {
          // Page-level render jobs handle their own errors so they can include
          // page and scale context. The scheduler only controls ordering.
        })
        .finally(() => {
          activeCount -= 1
          pump()
        })
    }
  }

  return {
    schedule(job, priority) {
      const item: QueueItem = {
        id: nextId,
        priority,
        cancelled: false,
        job
      }
      nextId += 1
      queue.push(item)
      pump()

      return () => {
        item.cancelled = true
        queue = queue.filter((queuedItem) => queuedItem !== item)
      }
    }
  }
}

function isPdfRenderCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'RenderingCancelledException' || error.message.includes('cancelled')
}

type PageCanvasProps = {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  renderScale: number
  layout: PageLayout | null
  acetateVisible: boolean
  acetateStrokes: PdfInkStroke[]
  renderPriority: number
  renderScheduler: PdfRenderScheduler
}

function PdfPageCanvas({
  doc,
  pageNumber,
  scale,
  renderScale,
  layout,
  acetateVisible,
  acetateStrokes,
  renderPriority,
  renderScheduler
}: PageCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [paintedScale, setPaintedScale] = useState(renderScale)

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | null = null

    async function renderPage(): Promise<void> {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return

      const viewport = page.getViewport({ scale: renderScale })
      const devicePixelRatio = window.devicePixelRatio || 1
      const renderCanvas = document.createElement('canvas')
      const context = renderCanvas.getContext('2d')
      if (!context) return

      setRenderError(null)
      renderCanvas.width = Math.floor(viewport.width * devicePixelRatio)
      renderCanvas.height = Math.floor(viewport.height * devicePixelRatio)

      const transform =
        devicePixelRatio === 1 ? undefined : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
      renderTask = page.render({
        canvas: renderCanvas,
        canvasContext: context,
        transform,
        viewport
      })

      await renderTask.promise
      if (cancelled) return

      const canvas = canvasRef.current
      if (!canvas) return
      const visibleContext = canvas.getContext('2d')
      if (!visibleContext) return

      canvas.width = renderCanvas.width
      canvas.height = renderCanvas.height
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      visibleContext.drawImage(renderCanvas, 0, 0)
      setPaintedScale(renderScale)
    }

    const cancelScheduledRender = renderScheduler.schedule(async () => {
      try {
        await renderPage()
      } catch (error: unknown) {
        if (cancelled || isPdfRenderCancellation(error)) return
        const message = error instanceof Error ? error.message : String(error)
        logger.error('page render failed', {
          pageNumber,
          scale: renderScale,
          workerSrc: GlobalWorkerOptions.workerSrc,
          message
        })
        setRenderError(`Page ${pageNumber} failed to render: ${message}`)
      }
    }, renderPriority)

    return () => {
      cancelled = true
      cancelScheduledRender()
      renderTask?.cancel()
    }
  }, [doc, pageNumber, renderPriority, renderScale, renderScheduler])

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
        <canvas
          ref={canvasRef}
          className="pdf-editor__page-canvas"
          style={{
            transform: `scale(${scale / paintedScale})`,
            transformOrigin: 'top left'
          }}
        />
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
  renderScale: number
  layout: PageLayout | null
  acetateVisible: boolean
  acetateStrokes: PdfInkStroke[]
  viewportRef: { current: HTMLDivElement | null }
  renderScheduler: PdfRenderScheduler
}

function VirtualizedPdfPage({
  doc,
  pageNumber,
  scale,
  renderScale,
  layout,
  acetateVisible,
  acetateStrokes,
  viewportRef,
  renderScheduler
}: VirtualizedPdfPageProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [renderPriority, setRenderPriority] = useState(pageNumber)

  useEffect(() => {
    const element = containerRef.current
    const root = viewportRef.current
    if (!element || !root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const nextVisible = entry?.isIntersecting === true
        setIsNearViewport(nextVisible)
        if (entry && nextVisible) {
          const rootCenter = root.clientHeight / 2
          const pageCenter = entry.boundingClientRect.top + entry.boundingClientRect.height / 2
          const rootTop = entry.rootBounds?.top ?? root.getBoundingClientRect().top
          setRenderPriority(Math.abs(pageCenter - rootTop - rootCenter))
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

  const shouldRender = isNearViewport
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
          renderScale={renderScale}
          layout={layout}
          acetateVisible={acetateVisible}
          acetateStrokes={acetateStrokes}
          renderPriority={renderPriority}
          renderScheduler={renderScheduler}
        />
      ) : (
        <div
          className="pdf-editor__page-shell pdf-editor__page-shell--placeholder"
          style={shellStyle}
        >
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
    const goesLeft =
      (lead === 'odd' && pageNumber % 2 === 1) || (lead === 'even' && pageNumber % 2 === 0)
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

export function PdfEditor({ resource, workspaceRoot }: BudEditorProps): React.JSX.Element {
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [renderScale, setRenderScale] = useState(DEFAULT_SCALE)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<ThumbnailState[]>([])
  const [activePage, setActivePage] = useState(1)
  const [activeTool, setActiveTool] = useState<'navigate' | 'ink'>('navigate')
  const [acetateVisible, setAcetateVisible] = useState(true)
  const [acetateStrokes, setAcetateStrokes] = useState<PdfInkStroke[]>([])
  const [activeInkTool, setActiveInkTool] = useState<InkTool>('pen')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('single-continuous')
  const [spreadLead, setSpreadLead] = useState<SpreadLead>('odd')
  const [spreadGapMode, setSpreadGapMode] = useState<SpreadGapMode>('open')
  const [basePageLayouts, setBasePageLayouts] = useState<Record<number, PageLayout>>({})
  const pageRefs = useRef<Record<number, HTMLElement | null>>({})
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const pendingZoomAnchorRef = useRef<{
    previousScale: number
    centerX: number
    centerY: number
  } | null>(null)
  const pendingInitialPageRef = useRef<number | null>(null)
  const hasLoadedViewStateRef = useRef(false)
  const activePageRef = useRef(activePage)
  const prevViewModeRef = useRef(viewMode)
  const viewStateRef = useRef<PdfViewState>({
    activePage,
    scale,
    sidebarOpen,
    viewMode,
    spreadLead,
    spreadGapMode
  })
  // Keep viewStateRef current on every render so the unmount-save cleanup always
  // reads the latest values without needing to be a dep of that effect.
  viewStateRef.current = { activePage, scale, sidebarOpen, viewMode, spreadLead, spreadGapMode }

  const inkBinding = useMemo<InkPdfSurfaceBinding>(
    () => ({
      surfaceType: 'pdf',
      coordinateSpace: 'paged-uv',
      resource,
      targetId: createInkTargetId('pdf', resource)
    }),
    [resource]
  )

  const pdfCommandContext = useMemo(
    () =>
      createPdfCommandContext({
        subjectSnapshot: {
          resource,
          pageCount,
          activePage
        },
        actions: {
          appendInkStroke: async (binding, stroke) => {
            setAcetateStrokes((existing) => [...existing, stroke as PdfInkStroke])
            await window.api.appendInkStroke(workspaceRoot, binding, stroke)
            return { strokeId: stroke.id }
          },
          removeInkStroke: async (binding, strokeId) => {
            setAcetateStrokes((existing) => existing.filter((s) => s.id !== strokeId))
            await window.api.deleteInkStroke(workspaceRoot, binding, strokeId)
          },
          clearInkLayer: async (binding) => {
            const result = await window.api.clearInkLayer(workspaceRoot, binding)
            if (result.ok) setAcetateStrokes([])
            return { clearedStrokes: result.clearedStrokes }
          },
          restoreInkStrokes: async (binding, strokes) => {
            await window.api.setInkStrokes(workspaceRoot, binding, strokes)
            setAcetateStrokes(strokes as PdfInkStroke[])
          },
          eraseInkStrokes: async (binding, strokes) => {
            const ids = new Set(strokes.map((s) => s.id))
            setAcetateStrokes((existing) => existing.filter((s) => !ids.has(s.id)))
            for (const stroke of strokes) {
              await window.api.deleteInkStroke(workspaceRoot, binding, stroke.id)
            }
          }
        }
      }),
    [activePage, pageCount, resource, workspaceRoot]
  )

  const runPdfCommand = useCallback(
    async (id: string, args: unknown) => {
      const result = await executeCommandById(id, args, pdfCommandContext)
      if (!result.ok) {
        console.warn(`[commands] ${result.commandId} failed`, result)
      }
      return result
    },
    [pdfCommandContext]
  )

  // Clear history when the PDF resource changes.
  useEffect(() => {
    useHistoryStore.getState().clear('module:com.whitebloom.pdf')
  }, [resource])

  // Load persisted view state for this resource.
  useEffect(() => {
    if (!workspaceRoot) return
    let cancelled = false
    hasLoadedViewStateRef.current = false
    pendingInitialPageRef.current = null
    window.api
      .readBlossom(workspaceRoot, getPdfStateResource(resource))
      .then((data) => {
        if (cancelled) return
        const saved = parsePersistedPdfViewState(data)
        if (!saved) return
        if (saved.scale !== undefined) {
          setScale(saved.scale)
          setRenderScale(saved.scale)
        }
        if (saved.sidebarOpen !== undefined) setSidebarOpen(saved.sidebarOpen)
        if (saved.viewMode !== undefined) setViewMode(saved.viewMode)
        if (saved.spreadLead !== undefined) setSpreadLead(saved.spreadLead)
        if (saved.spreadGapMode !== undefined) setSpreadGapMode(saved.spreadGapMode)
        if (saved.activePage !== undefined) {
          setActivePage(saved.activePage)
          pendingInitialPageRef.current = saved.activePage
        }
      })
      .catch((error) => {
        if (cancelled) return
        logger.warn('failed to load persisted pdf view state', {
          message: error instanceof Error ? error.message : String(error),
          resource
        })
      })
      .finally(() => {
        if (!cancelled) {
          hasLoadedViewStateRef.current = true
        }
        // No saved state — use defaults.
      })
    return () => {
      cancelled = true
    }
  }, [resource, workspaceRoot])

  // Ctrl+Z / Ctrl+Shift+Z for undo/redo.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) return
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        void runPdfCommand(WHITEBLOOM_COMMAND_IDS.canvas.historyUndo, undefined)
      } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault()
        void runPdfCommand(WHITEBLOOM_COMMAND_IDS.canvas.historyRedo, undefined)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [runPdfCommand])

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

  useEffect(() => {
    if (Math.abs(renderScale - scale) < 0.001) return

    const timer = setTimeout(() => {
      setRenderScale(scale)
    }, RENDER_SCALE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [renderScale, scale])

  const facingSpreads = useMemo(
    () => buildFacingSpreads(pageCount, spreadLead),
    [pageCount, spreadLead]
  )
  const acetateStrokesByPage = useMemo<Record<number, PdfInkStroke[]>>(() => {
    const grouped: Record<number, PdfInkStroke[]> = {}

    for (const stroke of acetateStrokes) {
      let currentRun: typeof stroke.samples = []

      const pushRun = (): void => {
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
  const renderScheduler = useMemo(() => createPdfRenderScheduler(PDF_RENDER_CONCURRENCY), [])

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
    if (pageCount === 0) return

    setActivePage((currentPage) => Math.min(Math.max(currentPage, 1), pageCount))

    if (pendingInitialPageRef.current !== null) {
      pendingInitialPageRef.current = Math.min(
        Math.max(pendingInitialPageRef.current, 1),
        pageCount
      )
    }
  }, [pageCount])

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
          const rendered = new Map(nextThumbnails.map((t) => [t.pageNumber, t]))
          setThumbnails((prev) => prev.map((t) => rendered.get(t.pageNumber) ?? t))
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          if (cancelled) return
        }
      }

      if (!cancelled) {
        const rendered = new Map(nextThumbnails.map((t) => [t.pageNumber, t]))
        setThumbnails((prev) => prev.map((t) => rendered.get(t.pageNumber) ?? t))
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
  }, [isContinuousMode, pageCount, documentProxy, viewMode])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    const pendingZoomAnchor = pendingZoomAnchorRef.current
    if (!viewport || !pendingZoomAnchor || pendingZoomAnchor.previousScale === scale) return

    pendingZoomAnchorRef.current = null

    const scaleRatio = scale / pendingZoomAnchor.previousScale
    const nextScrollLeft = pendingZoomAnchor.centerX * scaleRatio - viewport.clientWidth / 2
    const nextScrollTop = pendingZoomAnchor.centerY * scaleRatio - viewport.clientHeight / 2
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)

    viewport.scrollTo({
      left: Math.min(Math.max(0, nextScrollLeft), maxScrollLeft),
      top: Math.min(Math.max(0, nextScrollTop), maxScrollTop),
      behavior: 'instant' as ScrollBehavior
    })
  }, [scale])

  // Keep activePageRef current so viewMode-switch scroll can read it without
  // becoming a dep of that effect.
  useEffect(() => {
    activePageRef.current = activePage
  }, [activePage])

  // After switching between continuous view modes, restore scroll position.
  // Only fires on viewMode / isContinuousMode changes — not on every page tick.
  useEffect(() => {
    if (prevViewModeRef.current === viewMode) return
    prevViewModeRef.current = viewMode
    if (!isContinuousMode) return
    const target = activePageRef.current
    const frame = requestAnimationFrame(() => {
      pageRefs.current[target]?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [viewMode, isContinuousMode])

  // Once all page layouts are ready, scroll to the page saved from a previous
  // session (pendingInitialPageRef is set by the state-load effect).
  useEffect(() => {
    const target = pendingInitialPageRef.current
    if (target === null || !isContinuousMode || !documentProxy) return
    if (Object.keys(basePageLayouts).length < pageCount || pageCount === 0) return
    pendingInitialPageRef.current = null
    requestAnimationFrame(() => {
      pageRefs.current[target]?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }, [basePageLayouts, documentProxy, isContinuousMode, pageCount])

  // Debounced save while the document is open — avoids writing on every
  // IntersectionObserver tick during scrolling.
  useEffect(() => {
    if (!workspaceRoot || !hasLoadedViewStateRef.current) return
    const stateResource = getPdfStateResource(resource)
    const timer = setTimeout(() => {
      void window.api.writeBlossom(
        workspaceRoot,
        stateResource,
        JSON.stringify(viewStateRef.current)
      )
    }, 800)
    return () => clearTimeout(timer)
  }, [resource, workspaceRoot, activePage, scale, sidebarOpen, viewMode, spreadLead, spreadGapMode])

  // Immediate save on close or resource change. The debounced effect's cleanup
  // only cancels the timer — this one guarantees the last position is written
  // before the component unmounts.
  useEffect(() => {
    if (!workspaceRoot) return
    const stateResource = getPdfStateResource(resource)
    return () => {
      if (!hasLoadedViewStateRef.current) return
      void window.api.writeBlossom(
        workspaceRoot,
        stateResource,
        JSON.stringify(viewStateRef.current)
      )
    }
  }, [resource, workspaceRoot])

  function scrollToPage(pageNumber: number): void {
    pageRefs.current[pageNumber]?.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'smooth'
    })
    setActivePage(pageNumber)
  }

  function queueZoom(nextScale: number): void {
    if (nextScale === scale) return

    const viewport = scrollViewportRef.current
    if (viewport) {
      pendingZoomAnchorRef.current = {
        previousScale: scale,
        centerX: viewport.scrollLeft + viewport.clientWidth / 2,
        centerY: viewport.scrollTop + viewport.clientHeight / 2
      }
    }

    setScale(nextScale)
  }

  function handleSetScale(nextScale: number): void {
    queueZoom(Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)))
  }

  function handleFitPage(): void {
    const viewport = scrollViewportRef.current
    const baseLayout = basePageLayouts[activePage]
    if (!viewport || !baseLayout) return
    const available = viewport.clientHeight - 24
    if (available <= 0) return
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, available / baseLayout.height))
    queueZoom(Math.round(nextScale * 100) / 100)
  }

  const discretePages =
    viewMode === 'single'
      ? [activePage]
      : (activeSpread?.pages.filter((page): page is number => page !== null) ?? [])

  return (
    <div
      className={`pdf-editor pdf-editor--${viewMode} pdf-editor--spread-gap-${spreadGapMode}${activeTool === 'ink' ? ' pdf-editor--tool-ink' : ''}`}
    >
      <div className="pdf-editor__title-bar">
        <span className="pdf-editor__title">
          {resource
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, '') ?? resource}
        </span>
      </div>

      <PetalShelf>
        <PetalShelfGroup>
          <PetalShelfItem
            label="Sidebar"
            icon={<PanelLeft size={16} strokeWidth={1.6} />}
            active={sidebarOpen}
            accent="var(--color-accent-blue)"
            onClick={() => setSidebarOpen((c) => !c)}
          />
          <PetalShelfItem
            label="Continuous"
            icon={<Rows3 size={16} strokeWidth={1.6} />}
            active={viewMode === 'single-continuous'}
            accent="var(--color-accent-blue)"
            onClick={() => setViewMode('single-continuous')}
          />
          <PetalShelfItem
            label="Facing"
            icon={<GalleryVertical size={16} strokeWidth={1.6} />}
            active={viewMode === 'facing-continuous'}
            accent="var(--color-accent-blue)"
            onClick={() => setViewMode('facing-continuous')}
          />
          <PetalShelfItem
            label="Odd First"
            icon={<AlignLeft size={16} strokeWidth={1.6} />}
            active={spreadLead === 'odd'}
            accent="var(--color-accent-blue)"
            onClick={() => setSpreadLead('odd')}
          />
          <PetalShelfItem
            label="Even First"
            icon={<AlignRight size={16} strokeWidth={1.6} />}
            active={spreadLead === 'even'}
            accent="var(--color-accent-blue)"
            onClick={() => setSpreadLead('even')}
          />
          <PetalShelfItem
            label="Gap Flush"
            icon={<Columns2 size={16} strokeWidth={1.6} />}
            active={spreadGapMode === 'flush'}
            accent="var(--color-accent-blue)"
            onClick={() => setSpreadGapMode('flush')}
          />
          <PetalShelfItem
            label="Gap Open"
            icon={<SeparatorVertical size={16} strokeWidth={1.6} />}
            active={spreadGapMode === 'open'}
            accent="var(--color-accent-blue)"
            onClick={() => setSpreadGapMode('open')}
          />
        </PetalShelfGroup>

        <PetalShelfGroup>
          {/* <span className="petal-shelf-readout">
            {activePage} / {pageCount || '—'}
          </span> */}
          <PetalShelfZoomItem
            scale={scale}
            minScale={MIN_SCALE}
            maxScale={MAX_SCALE}
            onScaleChange={handleSetScale}
            onFitPage={handleFitPage}
          />
        </PetalShelfGroup>

        <PetalShelfGroup>
          <PetalShelfItem
            label="Ink"
            icon={<Pen size={16} strokeWidth={1.6} />}
            active={activeTool === 'ink'}
            accent="var(--color-accent-pink)"
            onClick={() => setActiveTool((c) => (c === 'ink' ? 'navigate' : 'ink'))}
          />
          <PetalShelfItem
            label="Layers"
            icon={<Layers3 size={16} strokeWidth={1.6} />}
            active={acetateVisible}
            accent="var(--color-accent-green)"
            onClick={() => setAcetateVisible((c) => !c)}
          />
        </PetalShelfGroup>
      </PetalShelf>

      <div className="pdf-editor__body">
        {sidebarOpen && (
          <aside className="pdf-editor__sidebar" aria-label="Page thumbnails">
            <div className="pdf-editor__sidebar-header">Pages</div>
            <div className="pdf-editor__thumbnail-list">
              {thumbnails.map((thumbnail) => {
                const baseLayout = basePageLayouts[thumbnail.pageNumber]
                const frameHeight = baseLayout
                  ? Math.round(76 * (baseLayout.height / baseLayout.width))
                  : undefined
                return (
                  <button
                    key={thumbnail.pageNumber}
                    type="button"
                    className={`pdf-editor__thumbnail${thumbnail.pageNumber === activePage ? ' pdf-editor__thumbnail--active' : ''}`}
                    onClick={() => scrollToPage(thumbnail.pageNumber)}
                  >
                    <div
                      className="pdf-editor__thumbnail-frame"
                      style={
                        frameHeight !== undefined
                          ? { height: frameHeight, minHeight: frameHeight }
                          : undefined
                      }
                    >
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
                )
              })}
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
                <p className="pdf-editor__empty-body">
                  Preparing pages for a focused reading view.
                </p>
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
                            renderScale={renderScale}
                            layout={pageLayouts[pageNumber] ?? null}
                            acetateVisible={acetateVisible}
                            acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                            viewportRef={scrollViewportRef}
                            renderScheduler={renderScheduler}
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
                                  renderScale={renderScale}
                                  layout={pageLayouts[pageNumber] ?? null}
                                  acetateVisible={acetateVisible}
                                  acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                                  viewportRef={scrollViewportRef}
                                  renderScheduler={renderScheduler}
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
                {viewMode === 'single' ? (
                  discretePages.map((pageNumber) => (
                    <section
                      key={pageNumber}
                      className="pdf-editor__page pdf-editor__page--discrete"
                    >
                      <div className="pdf-editor__page-meta">{pageNumber}</div>
                      <MemoizedPdfPageCanvas
                        doc={documentProxy}
                        pageNumber={pageNumber}
                        scale={scale}
                        renderScale={renderScale}
                        layout={pageLayouts[pageNumber] ?? null}
                        acetateVisible={acetateVisible}
                        acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                        renderPriority={0}
                        renderScheduler={renderScheduler}
                      />
                    </section>
                  ))
                ) : (
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
                              renderScale={renderScale}
                              layout={pageLayouts[pageNumber] ?? null}
                              acetateVisible={acetateVisible}
                              acetateStrokes={acetateStrokesByPage[pageNumber] ?? []}
                              renderPriority={slotIndex}
                              renderScheduler={renderScheduler}
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
              activeTool={activeInkTool}
              strokes={acetateStrokes}
              onTransfer={(stroke) => {
                void runPdfCommand(WHITEBLOOM_COMMAND_IDS.canvas.inkAppendStroke, {
                  binding: inkBinding,
                  stroke
                })
              }}
              onEraseComplete={(erasedStrokes) => {
                void runPdfCommand(WHITEBLOOM_COMMAND_IDS.canvas.inkEraseStrokes, {
                  binding: inkBinding,
                  erasedStrokes
                })
              }}
            />
          ) : null}
          {activeTool === 'ink' ? (
            <div className="pdf-editor__ink-toolbar">
              <InkToolbar
                activeTool={activeInkTool}
                onToolChange={setActiveInkTool}
                onClearLayer={() => {
                  void runPdfCommand(WHITEBLOOM_COMMAND_IDS.canvas.inkClearLayer, {
                    binding: inkBinding
                  })
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
