import { useEffect, useState } from 'react'
import { PetalBudNode } from '@renderer/components/petal'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import type { BudNodeProps } from '../types'
import { parseDramaticBloomProject } from './model'
import './DramaticBloomNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.drb$/i, '')
}

export function DramaticBloomNode({ resource, label, size, selected, onBloom }: BudNodeProps) {
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const [title, setTitle] = useState(label ?? deriveLabel(resource))
  const [summary, setSummary] = useState('')

  useEffect(() => {
    if (!workspaceRoot) return

    let cancelled = false
    window.api
      .readBlossom(workspaceRoot, resource)
      .then((data) => {
        if (cancelled) return
        const project = parseDramaticBloomProject(data)
        setTitle(project.project.title)
        setSummary(project.project.notes.trim())
      })
      .catch(() => {
        if (!cancelled) setSummary('')
      })

    return () => {
      cancelled = true
    }
  }, [workspaceRoot, resource])

  return (
    <PetalBudNode
      size={{ w: size.w, h: size.h }}
      label={title}
      selected={selected}
      accentColor="--color-accent-purple"
      onDoubleClick={onBloom}
    >
      <div className={`drb-node__card${selected ? ' drb-node__card--selected' : ''}`}>
        <p className="drb-node__eyebrow">DramaticBloom</p>
        <p className="drb-node__title">{title}</p>
        {summary ? <p className="drb-node__summary">{summary}</p> : null}
      </div>
    </PetalBudNode>
  )
}
