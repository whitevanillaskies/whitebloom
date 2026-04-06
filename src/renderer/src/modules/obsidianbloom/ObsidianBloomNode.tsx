import { useCallback, useEffect, useState } from 'react'
import { PetalBudNode } from '@renderer/components/petal'
import type { BudNodeProps } from '../types'
import { ObsidianBloomIcon } from './ObsidianBloomIcon'
import { BUD_ICON_PX } from '@renderer/canvas/canvas-constants'

/**
 * Converts a `file:///` URI back to an absolute filesystem path.
 * Handles both Windows (`file:///C:/...`) and Unix (`file:///home/...`) forms.
 */
function fileUriToAbsolutePath(uri: string): string {
  const withoutScheme = uri.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '/')
  return decodeURIComponent(withoutScheme)
}

function deriveLabel(resource: string): string {
  // Strip trailing slash then take last path segment
  const trimmed = resource.replace(/[/\\]+$/, '')
  const segment = trimmed.split(/[/\\]/).pop() ?? trimmed
  return decodeURIComponent(segment)
}

/**
 * Icon-personality node for Obsidian vaults.
 * Does not use the BloomModal — opens the vault via the obsidian:// URI scheme directly.
 */
export function ObsidianBloomNode({ resource, label, size, selected }: BudNodeProps) {
  const [installed, setInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.checkProtocol('obsidian://').then(setInstalled).catch(() => setInstalled(false))
  }, [])

  const handleOpen = useCallback(() => {
    if (!installed) return
    const absolutePath = fileUriToAbsolutePath(resource)
    void window.api.openUrl(`obsidian://open?path=${encodeURIComponent(absolutePath)}`)
  }, [installed, resource])

  const displayLabel = label ?? deriveLabel(resource)

  return (
    <PetalBudNode
      size={{ w: 88 }}
      label={displayLabel}
      selected={selected}
      accentColor="--color-accent-purple"
      indicator={installed === false ? 'warning' : undefined}
      onDoubleClick={handleOpen}
    >
      <ObsidianBloomIcon size={BUD_ICON_PX} />
    </PetalBudNode>
  )
}
