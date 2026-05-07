import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BudEditorProps } from '../types'
import { useTranslation } from 'react-i18next'
import {
  findBookMarkupBlockAtOffset,
  parseBookMarkup,
  type BookMarkupBlock,
  type BookMarkupDocument
} from './bookMarkup'
import './FocusWriterEditor.css'

const AUTOSAVE_DELAY_MS = 600
const VIEW_STATE_STORAGE_PREFIX = 'whitebloom.focusWriter.viewState'
const MODE_TRANSLATION_KEYS = {
  typewriter: 'focusWriter.typewriterMode',
  dynamic: 'focusWriter.dynamicMode',
  preview: 'focusWriter.previewMode'
} as const

type WritingMode = 'typewriter' | 'dynamic'
type EditorMode = WritingMode | 'preview'

type FocusWriterViewState = {
  mode: EditorMode
  paragraph: number
  lastWritingMode: WritingMode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given the flat text and a cursor offset, returns the index of the paragraph
 * (double-newline-separated block) the cursor sits in.
 */
function getActiveParagraph(text: string, cursor: number): number {
  const parts = text.split(/(\n\n+)/)
  let pos = 0
  let paraIndex = 0
  for (const part of parts) {
    const end = pos + part.length
    if (/^\n\n+$/.test(part)) {
      // Inside a separator — still belongs to the preceding paragraph
      if (cursor <= end) return Math.max(0, paraIndex - 1)
    } else {
      if (cursor <= end) return paraIndex
      paraIndex++
    }
    pos = end
  }
  return Math.max(0, paraIndex - 1)
}

function getParagraphStartOffset(text: string, targetParagraph: number): number {
  const parts = text.split(/(\n\n+)/)
  let pos = 0
  let paraIndex = 0
  for (const part of parts) {
    if (/^\n\n+$/.test(part)) {
      pos += part.length
      continue
    }
    if (paraIndex >= targetParagraph) return pos
    paraIndex++
    pos += part.length
  }
  return text.length
}

function getPreviewParagraphs(text: string): Array<{ text: string; sourceIndex: number }> {
  const parts = text.split(/(\n\n+)/)
  const paragraphs: Array<{ text: string; sourceIndex: number }> = []
  let paraIndex = 0
  for (const part of parts) {
    if (/^\n\n+$/.test(part)) continue
    if (part.trim()) paragraphs.push({ text: part, sourceIndex: paraIndex })
    paraIndex++
  }
  return paragraphs
}

type PreviewPage = {
  paragraphs: string[]
  startPara: number
}

function getViewStateStorageKey(workspaceRoot: string, resource: string): string {
  return `${VIEW_STATE_STORAGE_PREFIX}:${workspaceRoot}:${resource}`
}

function loadViewState(workspaceRoot: string, resource: string): FocusWriterViewState | null {
  try {
    const raw = window.localStorage.getItem(getViewStateStorageKey(workspaceRoot, resource))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FocusWriterViewState>
    const mode = parsed.mode
    const lastWritingMode = parsed.lastWritingMode
    if (mode !== 'typewriter' && mode !== 'dynamic' && mode !== 'preview') return null
    if (lastWritingMode !== 'typewriter' && lastWritingMode !== 'dynamic') return null
    return {
      mode,
      lastWritingMode,
      paragraph: Math.max(0, Math.floor(parsed.paragraph ?? 0))
    }
  } catch {
    return null
  }
}

function saveViewState(workspaceRoot: string, resource: string, state: FocusWriterViewState): void {
  try {
    window.localStorage.setItem(
      getViewStateStorageKey(workspaceRoot, resource),
      JSON.stringify(state)
    )
  } catch {
    // View state is a nicety; storage failures should never interrupt writing.
  }
}

// ---------------------------------------------------------------------------
// Mirror — positioned behind the textarea, renders paragraph-level opacity
// ---------------------------------------------------------------------------

function MirrorContent({
  text,
  activePara,
  allBright
}: {
  text: string
  activePara: number
  allBright: boolean
}) {
  const { t } = useTranslation()
  if (!text) {
    return <span className="fw-editor__placeholder">{t('focusWriter.placeholder')}</span>
  }

  const parts = text.split(/(\n\n+)/)
  let paraIndex = 0

  return (
    <>
      {parts.map((part, i) => {
        if (/^\n\n+$/.test(part)) {
          return <span key={i}>{part}</span>
        }
        const idx = paraIndex++
        const cls =
          allBright || idx === activePara ? 'fw-editor__para--active' : 'fw-editor__para--dim'
        return (
          <span key={i} className={cls} data-fw-para-index={idx}>
            {part}
          </span>
        )
      })}
    </>
  )
}

function getBookBlockSource(text: string, block: BookMarkupBlock): string {
  return text.slice(block.range.start, block.range.end)
}

function getBookBlockClassName(base: string, isActive: boolean, allBright: boolean): string {
  return `${base} ${allBright || isActive ? 'fw-editor__para--active' : 'fw-editor__para--dim'}`
}

function BookMirrorContent({
  document,
  activeBlock,
  allBright
}: {
  document: Extract<BookMarkupDocument, { mode: 'book' }>
  activeBlock: BookMarkupBlock | null
  allBright: boolean
}) {
  const activeRange = activeBlock?.range
  const isActiveBlock = (block: BookMarkupBlock): boolean =>
    activeRange?.start === block.range.start && activeRange?.end === block.range.end

  return (
    <div className="fw-book">
      {(document.metadata.title || document.metadata.author) && (
        <header className="fw-book__masthead">
          {document.metadata.title && (
            <div className="fw-book__title">{document.metadata.title}</div>
          )}
          {document.metadata.author && (
            <div className="fw-book__author">{document.metadata.author}</div>
          )}
        </header>
      )}

      {document.blocks.map((block, index) => {
        const isActive = isActiveBlock(block)

        if (block.kind === 'metadata') {
          if (!isActive) return null
          return (
            <div key={index} className={getBookBlockClassName('fw-book__raw', true, allBright)}>
              {getBookBlockSource(document.text, block)}
            </div>
          )
        }

        if ((block.kind === 'margin' || block.kind === 'note') && isActive) {
          return (
            <div key={index} className={getBookBlockClassName('fw-book__raw', true, allBright)}>
              {getBookBlockSource(document.text, block)}
            </div>
          )
        }

        if (block.kind === 'heading') {
          const HeadingTag = `h${Math.min(block.depth + 1, 4)}` as 'h2' | 'h3' | 'h4'
          return (
            <HeadingTag
              key={index}
              className={getBookBlockClassName(
                `fw-book__heading fw-book__heading--${block.depth}`,
                isActive,
                allBright
              )}
            >
              {block.text}
            </HeadingTag>
          )
        }

        if (block.kind === 'margin') {
          return (
            <aside
              key={index}
              className={getBookBlockClassName('fw-book__margin', isActive, allBright)}
            >
              {block.value}
            </aside>
          )
        }

        if (block.kind === 'note') {
          return (
            <p key={index} className={getBookBlockClassName('fw-book__note', isActive, allBright)}>
              {block.value}
            </p>
          )
        }

        if (block.kind === 'paragraph') {
          return (
            <p
              key={index}
              className={getBookBlockClassName('fw-book__para', isActive, allBright)}
              data-fw-para-index={index}
            >
              {block.text}
            </p>
          )
        }

        return null
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BookPreview — paginated Apple Books-style read view
// ---------------------------------------------------------------------------

function BookPreview({
  text,
  modeLabel,
  initialPara,
  onClose,
  onExitPreview,
  onPageChange
}: {
  text: string
  modeLabel: string
  initialPara: number
  onClose: () => void
  onExitPreview: (targetPara: number) => void
  onPageChange: (targetPara: number) => void
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const pageAreaRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PreviewPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const didSyncInitialPageRef = useRef(false)

  const paginate = useCallback(() => {
    const pageArea = pageAreaRef.current
    const measure = measureRef.current
    if (!pageArea || !measure) return

    const style = window.getComputedStyle(pageArea)
    const availableHeight =
      pageArea.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    const availableWidth = pageArea.clientWidth
    if (availableHeight <= 0 || availableWidth === 0) return

    measure.style.width = `${availableWidth}px`
    measure.style.height = `${availableHeight}px`

    const paragraphs = getPreviewParagraphs(text)
    if (paragraphs.length === 0) {
      setPages([{ paragraphs: [], startPara: 0 }])
      setCurrentPage(0)
      return
    }

    while (measure.firstChild) measure.removeChild(measure.firstChild)

    const result: PreviewPage[] = []
    let currentPageParas: string[] = []
    let currentPageStartPara = paragraphs[0]?.sourceIndex ?? 0

    for (const para of paragraphs) {
      const el = document.createElement('p')
      el.className = 'fw-preview__para'
      el.textContent = para.text
      measure.appendChild(el)

      if (measure.scrollHeight > availableHeight) {
        if (currentPageParas.length === 0) {
          // Paragraph alone is taller than the page — force it on its own page
          result.push({ paragraphs: [para.text], startPara: para.sourceIndex })
          measure.removeChild(el)
          while (measure.firstChild) measure.removeChild(measure.firstChild)
        } else {
          // Doesn't fit — push current page, start fresh
          result.push({ paragraphs: currentPageParas, startPara: currentPageStartPara })
          currentPageParas = [para.text]
          currentPageStartPara = para.sourceIndex
          while (measure.firstChild) measure.removeChild(measure.firstChild)
          const freshEl = document.createElement('p')
          freshEl.className = 'fw-preview__para'
          freshEl.textContent = para.text
          measure.appendChild(freshEl)
        }
      } else {
        if (currentPageParas.length === 0) currentPageStartPara = para.sourceIndex
        currentPageParas.push(para.text)
      }
    }

    if (currentPageParas.length > 0) {
      result.push({ paragraphs: currentPageParas, startPara: currentPageStartPara })
    }

    setPages(result)
    const maxLeft =
      result.length <= 1 ? 0 : result.length % 2 === 0 ? result.length - 2 : result.length - 1

    if (!didSyncInitialPageRef.current) {
      didSyncInitialPageRef.current = true
      const target = result.findLastIndex((page) => page.startPara <= initialPara)
      const clampedTarget = Math.min(Math.max(target, 0), maxLeft)
      const spreadStart = clampedTarget % 2 === 0 ? clampedTarget : Math.max(0, clampedTarget - 1)
      setCurrentPage(spreadStart)
      return
    }

    // Keep position but clamp to a valid spread-start (even) index.
    setCurrentPage((prev) => {
      const clamped = Math.min(prev, maxLeft)
      // Snap to nearest spread boundary (round down to even)
      return clamped % 2 === 0 ? clamped : Math.max(0, clamped - 1)
    })
  }, [initialPara, text])

  useLayoutEffect(() => {
    paginate()
  }, [paginate])

  useEffect(() => {
    const pageArea = pageAreaRef.current
    if (!pageArea) return
    const ro = new ResizeObserver(paginate)
    ro.observe(pageArea)
    return () => ro.disconnect()
  }, [paginate])

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  useEffect(() => {
    const page = pages[currentPage]
    if (page) onPageChange(page.startPara)
  }, [onPageChange, pages, currentPage])

  // Spreads advance two pages at a time. currentPage is always the left page (even index).
  const maxLeftPage =
    pages.length <= 1 ? 0 : pages.length % 2 === 0 ? pages.length - 2 : pages.length - 1
  const totalSpreads = Math.ceil(pages.length / 2)
  const currentSpread = Math.floor(currentPage / 2) + 1

  const goNext = useCallback(() => {
    setCurrentPage((p) => {
      const max =
        pages.length <= 1 ? 0 : pages.length % 2 === 0 ? pages.length - 2 : pages.length - 1
      return Math.min(p + 2, max)
    })
  }, [pages.length])

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 2, 0))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isMod = e.ctrlKey || e.metaKey

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (isMod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        onExitPreview(pages[currentPage]?.startPara ?? 0)
        return
      }
      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        e.key === ' '
      ) {
        e.preventDefault()
        goNext()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        goPrev()
        return
      }
    },
    [onClose, onExitPreview, goNext, goPrev, pages, currentPage]
  )

  const isEmpty = text.trim() === ''
  const leftParas = pages[currentPage]?.paragraphs ?? []
  const rightParas = pages[currentPage + 1]?.paragraphs ?? null

  return (
    <div ref={containerRef} className="fw-preview" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Off-screen measurement div — sized by JS to match one page column */}
      <div ref={measureRef} className="fw-preview__measure" aria-hidden="true" />

      <div className="fw-preview__spread">
        {/* Left page */}
        <div ref={pageAreaRef} className="fw-preview__page-col">
          {isEmpty ? (
            <p className="fw-preview__empty">{t('focusWriter.emptyPreview')}</p>
          ) : (
            leftParas.map((para, i) => (
              <p key={i} className="fw-preview__para">
                {para}
              </p>
            ))
          )}
        </div>

        {/* Right page — only rendered when there's a second page to show */}
        {!isEmpty && rightParas !== null && (
          <>
            <div className="fw-preview__spine" aria-hidden="true" />
            <div className="fw-preview__page-col">
              {rightParas.map((para, i) => (
                <p key={i} className="fw-preview__para">
                  {para}
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      {!isEmpty && totalSpreads > 1 && (
        <div className="fw-preview__nav">
          <button
            className="fw-preview__nav-btn"
            onClick={goPrev}
            disabled={currentPage === 0}
            tabIndex={-1}
            aria-label="Previous spread"
          >
            ‹
          </button>
          <span className="fw-preview__page-num">
            {currentSpread} / {totalSpreads}
          </span>
          <button
            className="fw-preview__nav-btn"
            onClick={goNext}
            disabled={currentPage >= maxLeftPage}
            tabIndex={-1}
            aria-label="Next spread"
          >
            ›
          </button>
        </div>
      )}

      <span className="fw-editor__mode-indicator" aria-hidden="true">
        {modeLabel}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

export function FocusWriterEditor({
  resource,
  workspaceRoot,
  initialData,
  onSave,
  onClose
}: BudEditorProps) {
  const { t } = useTranslation()
  const initialViewStateRef = useRef(loadViewState(workspaceRoot, resource))
  const initialViewState = initialViewStateRef.current
  const [text, setText] = useState(initialData)
  const [mode, setMode] = useState<EditorMode>(initialViewState?.mode ?? 'dynamic')
  const [activePara, setActivePara] = useState(initialViewState?.paragraph ?? 0)
  const [caretOffset, setCaretOffset] = useState(0)
  const [previewStartPara, setPreviewStartPara] = useState(initialViewState?.paragraph ?? 0)
  // Dynamic mode: 'seek' = all bright, cursor free; 'focused' = active para bright, rest dim
  const [dynamicSubState, setDynamicSubState] = useState<'seek' | 'focused'>('seek')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTextRef = useRef(initialData)
  // Remembers the last writing mode so Ctrl+P returns to it
  const lastWritingModeRef = useRef<WritingMode>(
    initialViewState?.mode === 'typewriter' || initialViewState?.mode === 'dynamic'
      ? initialViewState.mode
      : (initialViewState?.lastWritingMode ?? 'dynamic')
  )
  // Refs for values needed inside rAF callbacks (avoids stale closures)
  const activeParaRef = useRef(initialViewState?.paragraph ?? 0)
  const modeRef = useRef<EditorMode>(initialViewState?.mode ?? 'dynamic')
  const pendingRestoreParaRef = useRef<number | null>(
    initialViewState && initialViewState.mode !== 'preview' ? initialViewState.paragraph : null
  )
  const modeLabel = t(MODE_TRANSLATION_KEYS[mode])
  const parsedDocument = useMemo(() => parseBookMarkup(text), [text])
  const activeBookBlock = useMemo(
    () => findBookMarkupBlockAtOffset(parsedDocument, caretOffset),
    [caretOffset, parsedDocument]
  )

  // ── Textarea auto-grow ──────────────────────────────────────────────────

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [])

  useLayoutEffect(() => {
    resizeTextarea()
  }, [text, resizeTextarea])

  // ── Autosave ────────────────────────────────────────────────────────────

  const scheduleSave = useCallback(
    (value: string) => {
      pendingTextRef.current = value
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onSave(value).catch(() => {})
        saveTimerRef.current = null
      }, AUTOSAVE_DELAY_MS)
    },
    [onSave]
  )

  const persistViewState = useCallback(
    (override?: Partial<FocusWriterViewState>) => {
      const currentMode = override?.mode ?? mode
      const paragraph =
        override?.paragraph ?? (currentMode === 'preview' ? previewStartPara : activePara)
      saveViewState(workspaceRoot, resource, {
        mode: currentMode,
        paragraph,
        lastWritingMode: override?.lastWritingMode ?? lastWritingModeRef.current
      })
    },
    [activePara, mode, previewStartPara, resource, workspaceRoot]
  )

  const flushAndClose = useCallback(() => {
    persistViewState()
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    onSave(pendingTextRef.current).catch(() => {})
    onClose()
  }, [persistViewState, onSave, onClose])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    persistViewState()
  }, [persistViewState])

  // ── Cursor tracking ─────────────────────────────────────────────────────

  const updateActivePara = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const next = getActiveParagraph(ta.value, ta.selectionStart)
    setCaretOffset(ta.selectionStart)
    activeParaRef.current = next
    setActivePara(next)
  }, [])

  const enterPreviewMode = useCallback(() => {
    const ta = textareaRef.current
    const next = ta ? getActiveParagraph(ta.value, ta.selectionStart) : activeParaRef.current
    activeParaRef.current = next
    setActivePara(next)
    setPreviewStartPara(next)
    setMode('preview')
  }, [])

  const exitPreviewAtParagraph = useCallback((targetPara: number) => {
    pendingRestoreParaRef.current = targetPara
    setPreviewStartPara(targetPara)
    setMode(lastWritingModeRef.current)
  }, [])

  const handlePreviewPageChange = useCallback((targetPara: number) => {
    setPreviewStartPara(targetPara)
  }, [])

  // For click/select: also detect paragraph change → dynamic seek
  const handleSelectOrClick = useCallback(() => {
    const prev = activeParaRef.current
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const next = getActiveParagraph(ta.value, ta.selectionStart)
      setCaretOffset(ta.selectionStart)
      activeParaRef.current = next
      setActivePara(next)
      if (modeRef.current === 'dynamic' && next !== prev) {
        setDynamicSubState('seek')
      }
    })
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setText(value)
      scheduleSave(value)
      resizeTextarea()
      updateActivePara()
    },
    [scheduleSave, resizeTextarea, updateActivePara]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.ctrlKey || e.metaKey

      if (e.key === 'Escape') {
        e.preventDefault()
        flushAndClose()
        return
      }

      if (isMod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        enterPreviewMode()
        return
      }

      if (isMod && e.key.toLowerCase() === 't') {
        e.preventDefault()
        lastWritingModeRef.current = 'typewriter'
        setMode('typewriter')
        return
      }

      if (isMod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        lastWritingModeRef.current = 'dynamic'
        setMode('dynamic')
        return
      }

      if (isMod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        if (mode === 'dynamic') setDynamicSubState('seek')
        return
      }

      // Dynamic seek → focused: any printable character starts focusing
      if (mode === 'dynamic' && dynamicSubState === 'seek' && !isMod && e.key.length === 1) {
        setDynamicSubState('focused')
        // Fall through — let the character be inserted normally
      }

      // Update active paragraph on any key
      window.requestAnimationFrame(updateActivePara)
    },
    [flushAndClose, updateActivePara, enterPreviewMode, mode, dynamicSubState]
  )

  // ── Focus management ────────────────────────────────────────────────────

  // Initial focus + resize
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    resizeTextarea()
  }, [resizeTextarea])

  // Keep the transparent textarea's hit box in sync with the visible mirror.
  // Web font loading and column width changes can alter wrapping after the first
  // auto-size pass, which otherwise leaves visible text outside the clickable
  // textarea until another mode switch happens to resize it.
  useEffect(() => {
    const column = columnRef.current
    if (!column) return

    const resizeSoon = (): void => {
      requestAnimationFrame(resizeTextarea)
    }
    const ro = new ResizeObserver(resizeSoon)
    ro.observe(column)

    document.fonts?.ready.then(resizeSoon).catch(() => {})

    return () => ro.disconnect()
  }, [resizeTextarea])

  // Refocus textarea when returning to a writing mode
  useEffect(() => {
    if (mode === 'preview') return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    resizeTextarea()

    const targetPara = pendingRestoreParaRef.current
    if (targetPara === null) return
    pendingRestoreParaRef.current = null

    const offset = getParagraphStartOffset(text, targetPara)
    ta.setSelectionRange(offset, offset)
    setCaretOffset(offset)
    activeParaRef.current = targetPara
    setActivePara(targetPara)
    if (mode === 'dynamic') setDynamicSubState('seek')

    requestAnimationFrame(() => {
      if (mode !== 'dynamic') return
      const container = containerRef.current
      const mirror = mirrorRef.current
      if (!container || !mirror) return
      const targetSpan = mirror.querySelector<HTMLSpanElement>(
        `[data-fw-para-index="${targetPara}"]`
      )
      if (!targetSpan) return
      const spanRect = targetSpan.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      container.scrollBy({
        top: spanRect.top - containerRect.top - containerRect.height * 0.22,
        behavior: 'instant'
      })
    })
  }, [mode, resizeTextarea, text])

  // Keep modeRef in sync for rAF callbacks
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // Reset dynamic sub-state to seek whenever entering dynamic mode
  useEffect(() => {
    if (mode === 'dynamic') setDynamicSubState('seek')
  }, [mode])

  // Typewriter: scroll active paragraph to vertical center.
  // On mode entry use 'instant' — padding-top just changed from 10vh→50vh,
  // Chromium resets scrollTop to 0, so a smooth scroll would animate from the
  // top of the page. On subsequent activePara changes use 'smooth'.
  const prevModeRef = useRef(mode)
  useEffect(() => {
    if (mode !== 'typewriter') {
      prevModeRef.current = mode
      return
    }
    const justEntered = prevModeRef.current !== 'typewriter'
    prevModeRef.current = mode

    const container = containerRef.current
    const mirror = mirrorRef.current
    if (!container || !mirror) return

    requestAnimationFrame(() => {
      const activeSpan = mirror.querySelector<HTMLSpanElement>('.fw-editor__para--active')
      if (!activeSpan) return
      const spanRect = activeSpan.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const spanMid = spanRect.top + spanRect.height / 2
      const containerMid = containerRect.top + containerRect.height / 2
      container.scrollBy({
        top: spanMid - containerMid,
        behavior: justEntered ? 'instant' : 'smooth'
      })
    })
  }, [activePara, mode])

  // ── Render ──────────────────────────────────────────────────────────────

  if (mode === 'preview') {
    return (
      <BookPreview
        text={text}
        modeLabel={modeLabel}
        initialPara={previewStartPara}
        onClose={flushAndClose}
        onExitPreview={exitPreviewAtParagraph}
        onPageChange={handlePreviewPageChange}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fw-editor${mode === 'typewriter' ? ' fw-editor--typewriter' : ''}${
        parsedDocument.mode === 'book' ? ' fw-editor--book' : ''
      }`}
    >
      <div
        ref={columnRef}
        className={`fw-editor__column${
          parsedDocument.mode === 'book' ? ' fw-editor__column--book' : ''
        }`}
      >
        {/* Mirror: renders paragraph-dimmed text behind the transparent textarea */}
        <div
          ref={mirrorRef}
          className={`fw-editor__mirror${
            parsedDocument.mode === 'book' ? ' fw-editor__mirror--book' : ''
          }`}
          aria-hidden="true"
        >
          {parsedDocument.mode === 'book' ? (
            <BookMirrorContent
              document={parsedDocument}
              activeBlock={activeBookBlock}
              allBright={mode === 'dynamic' && dynamicSubState === 'seek'}
            />
          ) : (
            <MirrorContent
              text={text}
              activePara={activePara}
              allBright={mode === 'dynamic' && dynamicSubState === 'seek'}
            />
          )}
        </div>
        <textarea
          ref={textareaRef}
          className="fw-editor__textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectOrClick}
          onClick={handleSelectOrClick}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <div
          className={
            mode === 'typewriter'
              ? 'fw-editor__scroll-spacer fw-editor__scroll-spacer--typewriter'
              : 'fw-editor__scroll-spacer fw-editor__scroll-spacer--dynamic'
          }
          aria-hidden="true"
        />
      </div>
      <span className="fw-editor__mode-indicator" aria-hidden="true">
        {modeLabel}
      </span>
    </div>
  )
}
