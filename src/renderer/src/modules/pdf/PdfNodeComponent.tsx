import PetalBudNode from '@renderer/components/petal/PetalBudNode'
import { PdfIcon } from './PdfIcon'
import type { BudNodeProps } from '../types'

function deriveLabel(resource: string): string {
  const normalizedResource = resource.replace(/\\/g, '/')
  const segment = normalizedResource.split('/').pop() ?? resource
  return decodeURIComponent(segment).replace(/^.*[/\\]/, '')
}

export function PdfNodeComponent({ label, resource, size, selected, onBloom }: BudNodeProps) {
  const displayLabel = label ?? deriveLabel(resource)

  return (
    <PetalBudNode
      size={{ w: size.w }}
      label={displayLabel}
      selected={selected}
      accentColor="--color-accent-red"
      onDoubleClick={onBloom}
    >
      <PdfIcon size={40} />
    </PetalBudNode>
  )
}
