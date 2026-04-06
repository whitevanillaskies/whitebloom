import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import type { BudNodeProps } from '../types'
import './FocusWriterNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.blt$/, '')
}

function extractPreview(text: string): string {
  const first = text.split(/\n\n+/)[0].trim()
  if (first.length <= 200) return first
  return first.slice(0, 200) + '\u2026'
}

export function FocusWriterNode({ resource, label, size, selected, onBloom }: BudNodeProps): JSX.Element {
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceRoot) return
    window.api
      .readBlossom(workspaceRoot, resource)
      .then((data) => setPreview(extractPreview(data)))
      .catch(() => setPreview(null))
  }, [workspaceRoot, resource])

  const displayLabel = label ?? deriveLabel(resource)

  return (
    <div
      className="fw-node"
      style={{ width: size.w, height: size.h }}
      onDoubleClick={(e) => { e.stopPropagation(); onBloom() }}
    >
      <div className={`fw-node__card${selected ? ' fw-node__card--selected' : ''}`}>
        {preview ? (
          <p className="fw-node__preview">{preview}</p>
        ) : (
          <p className="fw-node__empty">—</p>
        )}
      </div>
      <p className={`fw-node__label${selected ? ' fw-node__label--selected' : ''}`}>
        {displayLabel}
      </p>
    </div>
  )
}
