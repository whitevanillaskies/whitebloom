import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { PetalBudNode } from '@renderer/components/petal'
import type { BudNodeProps } from '../types'
import './MarkdownBloomNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.(md|markdown)$/i, '')
}

function extractPreview(markdown: string): string {
  const trimmed = markdown.trim()
  if (trimmed.length <= 520) return trimmed
  return `${trimmed.slice(0, 520)}...`
}

export function MarkdownBloomNode({ resource, label, size, selected, onBloom }: BudNodeProps) {
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    if (!workspaceRoot) return

    let cancelled = false
    window.api
      .readBlossom(workspaceRoot, resource)
      .then((data) => {
        if (!cancelled) setPreview(extractPreview(data))
      })
      .catch(() => {
        if (!cancelled) setPreview('')
      })

    return () => {
      cancelled = true
    }
  }, [workspaceRoot, resource])

  return (
    <PetalBudNode
      size={{ w: size.w, h: size.h }}
      label={label ?? deriveLabel(resource)}
      selected={selected}
      accentColor="--color-accent-blue"
      onDoubleClick={onBloom}
    >
      <div className={`md-bloom-node__card${selected ? ' md-bloom-node__card--selected' : ''}`}>
        {preview ? (
          <div className="md-bloom-node__preview">
            <ReactMarkdown skipHtml>{preview}</ReactMarkdown>
          </div>
        ) : (
          <p className="md-bloom-node__empty">Markdown</p>
        )}
      </div>
    </PetalBudNode>
  )
}
