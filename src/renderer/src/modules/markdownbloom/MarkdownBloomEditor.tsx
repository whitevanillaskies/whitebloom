import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { BudEditorProps } from '../types'
import './MarkdownBloomEditor.css'

const AUTOSAVE_DELAY_MS = 500

export function MarkdownBloomEditor({ initialData, onSave, onClose }: BudEditorProps) {
  const [markdown, setMarkdown] = useState(initialData)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingMarkdownRef = useRef(initialData)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scheduleSave = useCallback(
    (value: string) => {
      pendingMarkdownRef.current = value
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
    onSave(pendingMarkdownRef.current).catch(() => {})
    onClose()
  }, [onClose, onSave])

  useEffect(() => {
    textareaRef.current?.focus()

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextMarkdown = event.target.value
      setMarkdown(nextMarkdown)
      scheduleSave(nextMarkdown)
    },
    [scheduleSave]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        flushAndClose()
      }
    },
    [flushAndClose]
  )

  return (
    <div className="md-bloom-editor">
      <textarea
        ref={textareaRef}
        className="md-bloom-editor__textarea"
        value={markdown}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck
      />
      <div className="md-bloom-editor__preview" aria-live="polite">
        {markdown.trim() ? (
          <ReactMarkdown skipHtml>{markdown}</ReactMarkdown>
        ) : (
          <p className="md-bloom-editor__empty">Markdown</p>
        )}
      </div>
    </div>
  )
}
