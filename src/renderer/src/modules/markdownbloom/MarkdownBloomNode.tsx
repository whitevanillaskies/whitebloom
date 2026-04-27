import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useInternalNode, useUpdateNodeInternals } from '@xyflow/react'
import { NodeResizeHandles } from '@renderer/canvas/NodeResizeHandles'
import { useFixedCornerResize } from '@renderer/canvas/useFixedCornerResize'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { useBoardStore } from '@renderer/stores/board'
import { PetalBudNode } from '@renderer/components/petal'
import type { BudNodeProps } from '../types'
import './MarkdownBloomNode.css'

const MIN_WIDTH = 180
const MIN_HEIGHT = 120

function deriveLabel(resource: string): string {
  const segment = resource.split('/').pop() ?? resource
  return segment.replace(/\.(md|markdown)$/i, '')
}

export function MarkdownBloomNode({
  id,
  resource,
  label,
  size,
  selected,
  dragging,
  onBloom
}: BudNodeProps) {
  const internalNode = useInternalNode(id)
  const positionAbsoluteX = internalNode?.internals.positionAbsolute.x ?? 0
  const positionAbsoluteY = internalNode?.internals.positionAbsolute.y ?? 0
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()
  const [localSize, setLocalSize] = useState({ w: size.w, h: size.h })
  const [preview, setPreview] = useState<string>('')

  const handleResizePreview = useCallback(
    ({
      size: nextSize
    }: {
      position: { x: number; y: number }
      size: { w: number; h: number }
    }) => {
      setLocalSize(nextSize)
    },
    []
  )

  const handleResizeCommit = useCallback(
    ({
      position,
      size: nextSize
    }: {
      position: { x: number; y: number }
      size: { w: number; h: number }
    }) => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, nextSize.w, nextSize.h)
    },
    [id, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    nodeId: id,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size: localSize,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })

  useEffect(() => {
    if (!workspaceRoot) return

    let cancelled = false
    window.api
      .readBlossom(workspaceRoot, resource)
      .then((data) => {
        if (!cancelled) setPreview(data.trim())
      })
      .catch(() => {
        if (!cancelled) setPreview('')
      })

    return () => {
      cancelled = true
    }
  }, [workspaceRoot, resource])

  useEffect(() => {
    if (isResizing) return
    setLocalSize({ w: size.w, h: size.h })
  }, [isResizing, size.w, size.h])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])

  return (
    <>
      <PetalBudNode
        size={{ w: localSize.w, h: localSize.h }}
        label={label ?? deriveLabel(resource)}
        selected={selected}
        accentColor="--color-accent-blue"
        onDoubleClick={onBloom}
      >
        <div
          className={`md-bloom-node__card${selected ? ' md-bloom-node__card--selected' : ''}${isResizing ? ' md-bloom-node__card--resizing nodrag nopan' : ''}`}
        >
          {preview ? (
            <div className="md-bloom-node__preview">
              <ReactMarkdown skipHtml>{preview}</ReactMarkdown>
            </div>
          ) : (
            <p className="md-bloom-node__empty">Markdown</p>
          )}
        </div>
      </PetalBudNode>
      <NodeResizeHandles
        visible={(selected || isResizing) && !dragging}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
