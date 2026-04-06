import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import type { BudNodeProps } from '../types'
import { loadSchema } from './schema'
import { SchemaBloomIcon } from './SchemaBloomIcon'
import './SchemaBloomNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.bdb$/, '')
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
      <div className="sb-node__badge">
        <SchemaBloomIcon size={28} />
        {tableCount !== null && tableCount > 0 && (
          <span className="sb-node__count">{tableCount}</span>
        )}
      </div>
      <p className="sb-node__label">{displayLabel}</p>
    </div>
  )
}
