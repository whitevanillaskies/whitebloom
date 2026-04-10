import { PetalBudNode, PetalIconBadge } from '@renderer/components/petal'
import { BUD_ICON_PX, BUD_ICON_NODE_W } from '@renderer/canvas/canvas-constants'
import type { BudNodeProps } from '../types'
import { WebPageBloomIcon } from './WebPageBloomIcon'

function deriveLabel(resource: string): string {
  try {
    const url = new URL(resource)
    const path = url.pathname.replace(/\/+$/, '')
    const lastSegment = path.split('/').filter(Boolean).pop()
    return decodeURIComponent(lastSegment ?? url.hostname)
  } catch {
    return resource
  }
}

export function WebPageBloomNode({ resource, label, selected }: BudNodeProps) {
  return (
    <PetalBudNode
      size={{ w: BUD_ICON_NODE_W }}
      label={label ?? deriveLabel(resource)}
      selected={selected}
      accentColor="--color-accent-blue"
      onDoubleClick={() => void window.api.openUrl(resource)}
    >
      <PetalIconBadge
        IconComponent={WebPageBloomIcon}
        accentColor="--color-accent-blue"
        size={BUD_ICON_PX}
        selected={selected}
      />
    </PetalBudNode>
  )
}
