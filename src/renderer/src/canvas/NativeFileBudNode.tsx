import { useEffect, useState } from 'react'
import { File } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { PetalBudNode } from '@renderer/components/petal'
import type { Size } from '@renderer/shared/types'
import './NativeFileBudNode.css'

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  // Strip file:/// prefix if present for display
  const decoded = decodeURIComponent(segment)
  return decoded.replace(/^.*[/\\]/, '')
}

type NativeFileBudNodeProps = {
  id: string
  resource: string
  label?: string
  size: Size
  selected: boolean
  onOpen: () => void
}

export function NativeFileBudNode({
  resource,
  label,
  size,
  selected,
  onOpen
}: NativeFileBudNodeProps) {
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const [iconUrl, setIconUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceRoot) return
    window.api
      .getFileIcon(workspaceRoot, resource)
      .then((result) => {
        if (result.ok && result.dataUrl) setIconUrl(result.dataUrl)
      })
      .catch(() => {/* leave iconUrl null — fallback renders */})
  }, [workspaceRoot, resource])

  const displayLabel = label ?? deriveLabel(resource)

  return (
    <PetalBudNode
      size={{ w: 88 }}
      label={displayLabel}
      selected={selected}
      accentColor="--color-accent-system"
      onDoubleClick={onOpen}
    >
      <div className={`native-node__icon-wrap${selected ? ' native-node__icon-wrap--selected' : ''}`}>
        {iconUrl ? (
          <img src={iconUrl} className="native-node__icon" alt="" draggable={false} />
        ) : (
          <File size={32} className="native-node__icon-fallback" strokeWidth={1.25} />
        )}
      </div>
    </PetalBudNode>
  )
}
