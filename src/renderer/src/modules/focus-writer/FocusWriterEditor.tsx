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

function MirrorContent({ text, activePara }: { text: string; activePara: number }): JSX.Element {
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
        return (
          <span
            key={i}
            className={idx === activePara ? 'fw-editor__para--active' : 'fw-editor__para--dim'}
          >
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
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [activePara, setActivePara] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTextRef = useRef(initialData)

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
    setActivePara(getActiveParagraph(ta.value, ta.selectionStart))
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

      // Update active paragraph on any key
      window.requestAnimationFrame(updateActivePara)
    },
    [flushAndClose, updateActivePara]
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
        setMode('edit')
        return
      }

      // Any regular keypress returns to edit mode
      if (!isMod && e.key.length === 1) {
        setMode('edit')
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

  // Refocus textarea when returning to edit mode
  useEffect(() => {
    if (mode !== 'edit') return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    resizeTextarea()
  }, [mode, resizeTextarea])

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
    <div className="fw-editor">
      <div className="fw-editor__column">
        {/* Mirror: renders paragraph-dimmed text behind the transparent textarea */}
        <div className="fw-editor__mirror" aria-hidden="true">
          <MirrorContent text={text} activePara={activePara} />
        </div>
        <textarea
          ref={textareaRef}
          className="fw-editor__textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={updateActivePara}
          onClick={updateActivePara}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  )
}
