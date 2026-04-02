import { useCallback, useEffect, useRef, useState } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import { makeLexicalContent } from '@renderer/shared/types'
import type { WidthMode } from '@renderer/shared/types'
import './TextNode.css'

type TextNodeData = {
  content: string // Lexical EditorState JSON
  widthMode: WidthMode
  wrapWidth: number | null
}

/** Extract plain text from Lexical EditorState JSON for temporary display until WU4. */
function extractPlainText(lexicalJson: string): string {
  try {
    const state = JSON.parse(lexicalJson)
    return (state.root.children as any[])
      .flatMap((p) => (p.children as any[]).map((n) => n.text ?? ''))
      .join('\n')
  } catch {
    return lexicalJson
  }
}

// ── Inline-editable text ─────────────────────────────────────────
function EditableText({
  value,
  editing,
  onEditingChange,
  onCommit
}: {
  value: string
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const confirm = useCallback(() => {
    onEditingChange(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
  }, [draft, value, onCommit, onEditingChange])

  const cancel = useCallback(() => {
    onEditingChange(false)
    setDraft(value)
  }, [value, onEditingChange])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation() // prevent RF from handling arrow keys etc.
      if (e.key === 'Enter') { e.preventDefault(); confirm() }
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
    },
    [confirm, cancel]
  )

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="text-node__input nodrag nopan nowheel"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={confirm}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      className="text-node__content"
      onDoubleClick={() => {
        setDraft(value)
        onEditingChange(true)
      }}
    >
      {value || ''}
    </span>
  )
}

// ── Text node ────────────────────────────────────────────────────
export function TextNode({ id, data, selected, dragging }: NodeProps) {
  const { content, widthMode, wrapWidth } = data as TextNodeData
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const [editing, setEditing] = useState(false)

  const plainText = extractPlainText(content)

  return (
    <>
      <NodeToolbar isVisible={selected && !dragging} position={Position.Top} offset={8}>
        <div className="text-node-toolbar">
          <span className="text-node-toolbar__placeholder">toolbar</span>
        </div>
      </NodeToolbar>

      <div className={`text-node${selected ? ' text-node--selected' : ''}${editing ? ' nodrag nopan' : ''}`}>
        <EditableText
          value={plainText}
          editing={editing}
          onEditingChange={setEditing}
          onCommit={(v) => updateNodeText(id, { content: makeLexicalContent(v), widthMode, wrapWidth })}
        />
        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  )
}
