import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { BudEditorProps } from '../types'
import './FocusWriterEditor.css'

const AUTOSAVE_DELAY_MS = 600

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
}): JSX.Element {
  if (!text) {
    return <span className="fw-editor__placeholder">Start writing…</span>
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
// Preview — Source Serif 4, read-only rendered text
// ---------------------------------------------------------------------------

function PreviewContent({ text }: { text: string }): JSX.Element {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim())
  if (paragraphs.length === 0) {
    return <p className="fw-editor__preview-empty">Nothing written yet.</p>
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="fw-editor__preview-para">
          {p}
        </p>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

export function FocusWriterEditor({ initialData, onSave, onClose }: BudEditorProps): JSX.Element {
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

  const handlePreviewKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isMod = e.ctrlKey || e.metaKey

      if (e.key === 'Escape') {
        e.preventDefault()
        flushAndClose()
        return
      }

      if (isMod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setMode(lastWritingModeRef.current)
        return
      }
    },
    [flushAndClose]
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

  // Typewriter: scroll active paragraph to vertical center
  useEffect(() => {
    if (mode !== 'typewriter') return
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
      container.scrollBy({ top: spanMid - containerMid, behavior: 'smooth' })
    })
  }, [activePara, mode])

  // ── Render ──────────────────────────────────────────────────────────────

  if (mode === 'preview') {
    return (
      <div
        className="fw-editor fw-editor--preview"
        tabIndex={0}
        onKeyDown={handlePreviewKeyDown}
      >
        <div className="fw-editor__column">
          <PreviewContent text={text} />
        </div>
      </div>
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
    </div>
  )
}
