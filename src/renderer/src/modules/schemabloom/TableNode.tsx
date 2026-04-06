import { useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Column } from './schema'
import { Plus, Trash2 } from 'lucide-react'
import './TableNode.css'

// The shape of data passed to this node via the ReactFlow node's `data` field.
export type TableNodeData = {
  tableName: string
  columns: Column[]
  onRename: (newName: string) => void
  onAddColumn: () => void
  onRenameColumn: (columnId: string, newName: string) => void
  onDropColumn: (columnId: string) => void
}

// ── Inline-editable text ────────────────────────────────────────
// Reused for both the table name and column names.
// Double-click to edit, Enter to confirm, Escape to cancel.
function EditableText({
  value,
  onCommit,
  className
}: {
  value: string
  onCommit: (newValue: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = useCallback(() => {
    setDraft(value)
    setEditing(true)
  }, [value])

  const confirm = useCallback(() => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onCommit(trimmed)
    }
  }, [draft, value, onCommit])

  const cancel = useCallback(() => {
    setEditing(false)
    setDraft(value)
  }, [value])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    },
    [confirm, cancel]
  )

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="sbn-name-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={confirm}
      />
    )
  }

  return (
    <span className={className} onDoubleClick={startEditing}>
      {value}
    </span>
  )
}

// ── Column row ──────────────────────────────────────────────────
// Each column gets a left handle (target) and a right handle (source).
// ReactFlow uses the handle `id` to distinguish them within the same node.
function ColumnRow({
  column,
  onRename,
  onDrop
}: {
  column: Column
  onRename: (newName: string) => void
  onDrop: () => void
}) {
  return (
    <div className="sbn-column">
      {/*
        Handle id must be unique within this node.
        We use the column id so that edges can target a specific column.
      */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${column.id}-target`}
        className="sbn-handle"
      />

      <EditableText value={column.name} onCommit={onRename} className="sbn-column-name" />

      <button type="button" className="sbn-column-delete" onClick={onDrop} title="Delete column">
        <Trash2 size={12} />
      </button>

      <Handle
        type="source"
        position={Position.Right}
        id={`${column.id}-source`}
        className="sbn-handle"
      />
    </div>
  )
}

// ── Main node component ─────────────────────────────────────────
export default function TableNode({ data }: { data: TableNodeData }) {
  return (
    <div className="sbn-root">
      <div className="sbn-header">
        <EditableText value={data.tableName} onCommit={data.onRename} className="sbn-table-name" />
        <button
          type="button"
          className="sbn-add-column"
          onClick={data.onAddColumn}
          title="Add column"
        >
          <Plus size={12} />
        </button>
      </div>

      {data.columns.length > 0 && (
        <div className="sbn-columns">
          {data.columns.map((col) => (
            <ColumnRow
              key={col.id}
              column={col}
              onRename={(newName) => data.onRenameColumn(col.id, newName)}
              onDrop={() => data.onDropColumn(col.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
