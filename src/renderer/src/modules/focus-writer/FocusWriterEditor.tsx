import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BudEditorProps } from '../types'
import { useTranslation } from 'react-i18next'
import './FocusWriterEditor.css'

const AUTOSAVE_DELAY_MS = 600
const MODE_TRANSLATION_KEYS = {
  typewriter: 'focusWriter.typewriterMode',
  dynamic: 'focusWriter.dynamicMode',
  preview: 'focusWriter.previewMode',
} as const

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

// ---------------------------------------------------------------------------
// Mirror — positioned behind the textarea, renders paragraph-level opacity
// ---------------------------------------------------------------------------

function MirrorContent({
  text,
  activePara,
  allBright,
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
        const cls = allBright || idx === activePara ? 'fw-editor__para--active' : 'fw-editor__para--dim'
        return (
          <span key={i} className={cls}>
            {part}
          </span>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// BookPreview — paginated Apple Books-style read view
// ---------------------------------------------------------------------------

function BookPreview({
  text,
  modeLabel,
  onClose,
  onExitPreview,
}: {
  text: string
  modeLabel: string
  onClose: () => void
  onExitPreview: () => void
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const pageAreaRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<string[][]>([])
  const [currentPage, setCurrentPage] = useState(0)

  const paginate = useCallback(() => {
    const pageArea = pageAreaRef.current
    const measure = measureRef.current
    if (!pageArea || !measure) return

    const style = window.getComputedStyle(pageArea)
    const availableHeight =
      pageArea.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom)
    const availableWidth = pageArea.clientWidth
    if (availableHeight <= 0 || availableWidth === 0) return

    measure.style.width = `${availableWidth}px`
    measure.style.height = `${availableHeight}px`

    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim())
    if (paragraphs.length === 0) {
      setPages([[]])
      setCurrentPage(0)
      return
    }

    while (measure.firstChild) measure.removeChild(measure.firstChild)

    const result: string[][] = []
    let currentPageParas: string[] = []

    for (const para of paragraphs) {
      const el = document.createElement('p')
      el.className = 'fw-preview__para'
      el.textContent = para
      measure.appendChild(el)

      if (measure.scrollHeight > availableHeight) {
        if (currentPageParas.length === 0) {
          // Paragraph alone is taller than the page — force it on its own page
          result.push([para])
          measure.removeChild(el)
          while (measure.firstChild) measure.removeChild(measure.firstChild)
        } else {
          // Doesn't fit — push current page, start fresh
          result.push(currentPageParas)
          currentPageParas = [para]
          while (measure.firstChild) measure.removeChild(measure.firstChild)
          const freshEl = document.createElement('p')
          freshEl.className = 'fw-preview__para'
          freshEl.textContent = para
          measure.appendChild(freshEl)
        }
      } else {
        currentPageParas.push(para)
      }
    }

    if (currentPageParas.length > 0) {
      result.push(currentPageParas)
    }

    setPages(result)
    // Keep position but clamp to a valid spread-start (even) index
    setCurrentPage((prev) => {
      const maxLeft =
        result.length <= 1 ? 0 : result.length % 2 === 0 ? result.length - 2 : result.length - 1
      const clamped = Math.min(prev, maxLeft)
      // Snap to nearest spread boundary (round down to even)
      return clamped % 2 === 0 ? clamped : Math.max(0, clamped - 1)
    })
  }, [text])

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

  // Spreads advance two pages at a time. currentPage is always the left page (even index).
  const maxLeftPage =
    pages.length <= 1 ? 0 : pages.length % 2 === 0 ? pages.length - 2 : pages.length - 1
  const totalSpreads = Math.ceil(pages.length / 2)
  const currentSpread = Math.floor(currentPage / 2) + 1

  const goNext = useCallback(() => {
    setCurrentPage((p) => {
      const max = pages.length <= 1 ? 0 : pages.length % 2 === 0 ? pages.length - 2 : pages.length - 1
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
        onExitPreview()
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
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
    [onClose, onExitPreview, goNext, goPrev]
  )

  const isEmpty = text.trim() === ''
  const leftParas = pages[currentPage] ?? []
  const rightParas = pages[currentPage + 1] ?? null

  return (
    <div
      ref={containerRef}
      className="fw-preview"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Off-screen measurement div — sized by JS to match one page column */}
      <div ref={measureRef} className="fw-preview__measure" aria-hidden="true" />

      <div className="fw-preview__spread">
        {/* Left page */}
        <div ref={pageAreaRef} className="fw-preview__page-col">
          {isEmpty ? (
            <p className="fw-preview__empty">{t('focusWriter.emptyPreview')}</p>
          ) : (
            leftParas.map((para, i) => (
              <p key={i} className="fw-preview__para">{para}</p>
            ))
          )}
        </div>

        {/* Right page — only rendered when there's a second page to show */}
        {!isEmpty && rightParas !== null && (
          <>
            <div className="fw-preview__spine" aria-hidden="true" />
            <div className="fw-preview__page-col">
              {rightParas.map((para, i) => (
                <p key={i} className="fw-preview__para">{para}</p>
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

      <span className="fw-editor__mode-indicator" aria-hidden="true">{modeLabel}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

export function FocusWriterEditor({ initialData, onSave, onClose }: BudEditorProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialData)
  const [mode, setMode] = useState<'typewriter' | 'dynamic' | 'preview'>('dynamic')
  const [activePara, setActivePara] = useState(0)
  // Dynamic mode: 'seek' = all bright, cursor free; 'focused' = active para bright, rest dim
  const [dynamicSubState, setDynamicSubState] = useState<'seek' | 'focused'>('seek')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTextRef = useRef(initialData)
  // Remembers the last writing mode so Ctrl+P returns to it
  const lastWritingModeRef = useRef<'typewriter' | 'dynamic'>('dynamic')
  // Refs for values needed inside rAF callbacks (avoids stale closures)
  const activeParaRef = useRef(0)
  const modeRef = useRef<'typewriter' | 'dynamic' | 'preview'>('dynamic')
  const modeLabel = t(MODE_TRANSLATION_KEYS[mode])

  // ── Textarea auto-grow ──────────────────────────────────────────────────

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [])

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

  const flushAndClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    onSave(pendingTextRef.current).catch(() => {})
    onClose()
  }, [onSave, onClose])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Cursor tracking ─────────────────────────────────────────────────────

  const updateActivePara = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const next = getActiveParagraph(ta.value, ta.selectionStart)
    activeParaRef.current = next
    setActivePara(next)
  }, [])

  // For click/select: also detect paragraph change → dynamic seek
  const handleSelectOrClick = useCallback(() => {
    const prev = activeParaRef.current
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const next = getActiveParagraph(ta.value, ta.selectionStart)
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
        setMode('preview')
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
    [flushAndClose, updateActivePara, mode, dynamicSubState]
  )

  // ── Focus management ────────────────────────────────────────────────────

  // Initial focus + resize
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    resizeTextarea()
  }, [resizeTextarea])

  // Refocus textarea when returning to a writing mode
  useEffect(() => {
    if (mode === 'preview') return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    resizeTextarea()
  }, [mode, resizeTextarea])

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
      container.scrollBy({ top: spanMid - containerMid, behavior: justEntered ? 'instant' : 'smooth' })
    })
  }, [activePara, mode])

  // ── Render ──────────────────────────────────────────────────────────────

  if (mode === 'preview') {
    return (
      <BookPreview
        text={text}
        modeLabel={modeLabel}
        onClose={flushAndClose}
        onExitPreview={() => setMode(lastWritingModeRef.current)}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fw-editor${mode === 'typewriter' ? ' fw-editor--typewriter' : ''}`}
    >
      <div className="fw-editor__column">
        {/* Mirror: renders paragraph-dimmed text behind the transparent textarea */}
        <div ref={mirrorRef} className="fw-editor__mirror" aria-hidden="true">
          <MirrorContent
            text={text}
            activePara={activePara}
            allBright={mode === 'dynamic' && dynamicSubState === 'seek'}
          />
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
        {mode === 'typewriter' && (
          <div className="fw-editor__typewriter-spacer" aria-hidden="true" />
        )}
      </div>
      <span className="fw-editor__mode-indicator" aria-hidden="true">{modeLabel}</span>
    </div>
  )
}
