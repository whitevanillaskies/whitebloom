import { useEffect, useState } from 'react'
import { Database } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import type { BudNodeProps } from '../types'
import { loadSchema } from './schema'
import './SchemaBloomNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.bdb$/, '')
}

function tableCountLabel(count: number): string {
  if (count === 0) return 'empty'
  return count === 1 ? '1 table' : `${count} tables`
}

export function SchemaBloomNode({ resource, label, size, selected, onBloom }: BudNodeProps): JSX.Element {
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const [tableCount, setTableCount] = useState<number | null>(null)

  useEffect(() => {
    if (!workspaceRoot) return
    window.api
      .readBlossom(workspaceRoot, resource)
      .then((data) => {
        try {
          const schema = loadSchema(data)
          setTableCount(schema.tables.length)
        } catch {
          setTableCount(0)
        }
      })
      .catch(() => setTableCount(null))
  }, [workspaceRoot, resource])

  const displayLabel = label ?? deriveLabel(resource)

  return (
    <div
      className={`sb-node${selected ? ' sb-node--selected' : ''}`}
      style={{ width: size.w, height: size.h }}
      onDoubleClick={(e) => { e.stopPropagation(); onBloom() }}
    >
      <div className="sb-node__header">
        <Database size={12} strokeWidth={1.5} className="sb-node__icon" />
        <span className="sb-node__label">{displayLabel}</span>
      </div>
      <p className="sb-node__count">
        {tableCount === null ? '—' : tableCountLabel(tableCount)}
      </p>
    </div>
  )
}
