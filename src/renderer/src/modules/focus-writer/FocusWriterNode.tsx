import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { PetalBudNode } from '@renderer/components/petal'
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

export function FocusWriterNode({ resource, label, size, selected, onBloom }: BudNodeProps) {
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceRoot) return
    window.api
      .readBlossom(workspaceRoot, resource)
      .then((data) => setPreview(extractPreview(data)))
      .catch(() => setPreview(null))
  }, [workspaceRoot, resource])

  return (
    <PetalBudNode
      size={{ w: size.w, h: size.h }}
      label={label ?? deriveLabel(resource)}
      selected={selected}
      accentColor="--color-accent-blue"
      onDoubleClick={onBloom}
    >
      <div className={`fw-node__card${selected ? ' fw-node__card--selected' : ''}`}>
        {preview ? (
          <p className="fw-node__preview">{preview}</p>
        ) : (
          <p className="fw-node__empty">—</p>
        )}
      </div>
    </PetalBudNode>
  )
}
