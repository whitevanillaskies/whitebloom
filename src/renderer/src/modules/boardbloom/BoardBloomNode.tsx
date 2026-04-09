import { useEffect, useMemo, useState } from 'react'
import { PetalBudNode } from '@renderer/components/petal'
import { resolveWorkspaceBoardPath } from '@renderer/shared/board-resource'
import { resourceToImageSrc } from '@renderer/shared/resource-url'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import type { BudNodeProps } from '../types'
import { BoardBloomIcon } from './BoardBloomIcon'
import './BoardBloomNode.css'

type ThumbnailState = { status: 'loading' } | { status: 'ready'; src: string } | { status: 'fallback' }

function deriveLabel(resource: string): string {
  const normalized = resource.replace(/\\/g, '/')
  const segment = normalized.slice(normalized.lastIndexOf('/') + 1)
  return segment.replace(/\.wb\.json$/i, '') || segment || resource
}

export function BoardBloomNode({ resource, label, size, selected, onBloom }: BudNodeProps) {
  const workspaceRoot = useWorkspaceStore((state) => state.root)
  const [thumbnailState, setThumbnailState] = useState<ThumbnailState>({ status: 'loading' })

  const boardPath = useMemo(
    () => resolveWorkspaceBoardPath(resource, workspaceRoot),
    [resource, workspaceRoot]
  )

  useEffect(() => {
    if (!workspaceRoot || !boardPath) {
      setThumbnailState({ status: 'fallback' })
      return
    }

    let cancelled = false
    setThumbnailState({ status: 'loading' })

    void (async () => {
      const result = await window.api.getThumbnailUri(boardPath, workspaceRoot)
      if (cancelled) return

      if (!result.ok || !result.uri) {
        setThumbnailState({ status: 'fallback' })
        return
      }

      try {
        setThumbnailState({
          status: 'ready',
          src: resourceToImageSrc(result.uri, workspaceRoot)
        })
      } catch {
        setThumbnailState({ status: 'fallback' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [boardPath, workspaceRoot])

  return (
    <PetalBudNode
      size={{ w: size.w }}
      label={label ?? deriveLabel(resource)}
      selected={selected}
      accentColor="--color-accent-blue"
      onDoubleClick={onBloom}
    >
      <div className="board-bloom-node__preview">
        {thumbnailState.status === 'ready' ? (
          <img
            src={thumbnailState.src}
            alt=""
            className="board-bloom-node__thumbnail"
            draggable={false}
          />
        ) : (
          <div className="board-bloom-node__fallback" aria-hidden="true">
            <BoardBloomIcon size={Math.min(size.w * 0.34, 52)} />
          </div>
        )}
      </div>
    </PetalBudNode>
  )
}
