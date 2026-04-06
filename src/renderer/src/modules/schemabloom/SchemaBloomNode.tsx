import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { PetalBudNode, PetalIconBadge } from '@renderer/components/petal'
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

  return (
    <PetalBudNode
      size={size}
      label={label ?? deriveLabel(resource)}
      selected={selected}
      accentColor="--color-accent-blue"
      onDoubleClick={onBloom}
    >
      <div className="sb-node__badge-wrap">
        <PetalIconBadge
          IconComponent={SchemaBloomIcon}
          accentColor="--color-accent-blue"
          size={64}
          selected={selected}
        />
        {tableCount !== null && tableCount > 0 && (
          <span className="sb-node__count">{tableCount}</span>
        )}
      </div>
    </PetalBudNode>
  )
}
