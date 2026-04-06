import { useCallback, useEffect, useState } from 'react'
import { PetalBudNode } from '@renderer/components/petal'
import type { BudNodeProps } from '../types'
import { ObsidianBloomIcon } from './ObsidianBloomIcon'

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
      onDoubleClick={handleOpen}
    >
      {/*
       * Mirror NativeFileBudNode layout: 64×64 wrap, centered icon.
       * The Obsidian SVG has ~17% whitespace on each axis, so we render
       * at 58px to make the visible logo content appear at ~48px — matching
       * native file icons from app.getFileIcon().
       */}
      <div style={{
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative'
      }}>
        <ObsidianBloomIcon size={58} />
        {installed === false && (
          <div
            title="Obsidian is not installed — download it at obsidian.md to open this vault"
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--color-accent-yellow, #F59E0B)',
              border: '1.5px solid var(--color-primary-bg)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    </PetalBudNode>
  )
}
