import { useCallback, useEffect, useRef, useState } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import './TextNode.css'

type TextNodeData = { content: string }

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
  const { content } = data as TextNodeData
  const updateNodeContent = useBoardStore((s) => s.updateNodeContent)
  const [editing, setEditing] = useState(false)

  return (
    <>
      <NodeToolbar isVisible={selected && !dragging} position={Position.Top} offset={8}>
        <div className="text-node-toolbar">
          <span className="text-node-toolbar__placeholder">toolbar</span>
        </div>
      </NodeToolbar>

      <div className={`text-node${selected ? ' text-node--selected' : ''}${editing ? ' nodrag nopan' : ''}`}>
        <EditableText
          value={content}
          editing={editing}
          onEditingChange={setEditing}
          onCommit={(v) => updateNodeContent(id, v)}
        />
        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  )
}
