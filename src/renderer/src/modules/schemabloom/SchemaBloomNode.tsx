import { PetalBudNode, PetalIconBadge } from '@renderer/components/petal'
import type { BudNodeProps } from '../types'
import { SchemaBloomIcon } from './SchemaBloomIcon'
import { BUD_ICON_PX, BUD_ICON_NODE_W } from '@renderer/canvas/canvas-constants'
import './SchemaBloomNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.bdb$/, '')
}

export function SchemaBloomNode({ resource, label, selected, onBloom }: BudNodeProps) {
  return (
    <PetalBudNode
      size={{ w: BUD_ICON_NODE_W }}
      label={label ?? deriveLabel(resource)}
      selected={selected}
      accentColor="--color-accent-blue"
      onDoubleClick={onBloom}
    >
      <div className="sb-node__badge-wrap">
        <PetalIconBadge
          IconComponent={SchemaBloomIcon}
          accentColor="--color-accent-blue"
          size={BUD_ICON_PX}
          selected={selected}
        />

      </div>
    </PetalBudNode>
  )
}
