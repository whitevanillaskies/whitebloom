import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useInternalNode, useUpdateNodeInternals } from '@xyflow/react'
import { ExternalLink, Globe } from 'lucide-react'
import { useBoardStore } from '@renderer/stores/board'
import { NodeResizeHandles } from '../../canvas/NodeResizeHandles'
import { useFixedCornerResize } from '../../canvas/useFixedCornerResize'
import type { BudNodeProps } from '../types'
import './WebBloomNode.css'

const HEADER_HEIGHT = 32
const MIN_WIDTH = 320
const MIN_HEIGHT = 220

function getUrlLabel(resource: string): string {
  try {
    const url = new URL(resource)
    return url.hostname
  } catch {
    return resource
  }
}

export function WebBloomNode({
  id,
  resource,
  label,
  size,
  selected,
  dragging
}: BudNodeProps): ReactElement {
  const viewId = `webbloom:${id}`
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const lastBoundsRef = useRef<string | null>(null)
  const internalNode = useInternalNode(id)
  const positionAbsoluteX = internalNode?.internals.positionAbsolute.x ?? 0
  const positionAbsoluteY = internalNode?.internals.positionAbsolute.y ?? 0
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()
  const [localSize, setLocalSize] = useState(size)
  const [viewState, setViewState] = useState({ resource, ready: false })
  const viewReady = viewState.resource === resource && viewState.ready

  const syncBounds = useCallback(
    (visible: boolean): void => {
      const element = bodyRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const bounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible: visible && rect.width > 8 && rect.height > 8 && !dragging
      }
      const serialized = JSON.stringify({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        visible: bounds.visible
      })
      if (serialized === lastBoundsRef.current) return

      lastBoundsRef.current = serialized
      void window.api.setWebBloomBounds(viewId, bounds)
    },
    [dragging, viewId]
  )

  useEffect(() => {
    let disposed = false
    lastBoundsRef.current = null

    void window.api.createWebBloomView(viewId, resource).then((result) => {
      if (disposed) return
      setViewState({ resource, ready: result.ok })
      syncBounds(result.ok)
    })

    return () => {
      disposed = true
      void window.api.destroyWebBloomView(viewId)
    }
  }, [resource, syncBounds, viewId])

  useEffect(() => {
    let animationFrame = 0
    const tick = (): void => {
      syncBounds(viewReady)
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [syncBounds, viewReady])

  useEffect(() => {
    if (dragging) {
      syncBounds(false)
    }
  }, [dragging, syncBounds])

  const handleResizePreview = useCallback(
    ({
      size: nextSize
    }: {
      position: { x: number; y: number }
      size: { w: number; h: number }
    }): void => {
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
    }): void => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, nextSize.w, nextSize.h)
    },
    [id, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    nodeId: id,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })
  const renderedSize = isResizing ? localSize : size

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, renderedSize.h, renderedSize.w, updateNodeInternals])

  const title = label ?? getUrlLabel(resource)

  return (
    <>
      <div
        className={[
          'webbloom-node',
          selected ? 'webbloom-node--selected' : '',
          isResizing ? 'webbloom-node--resizing' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ width: renderedSize.w, height: renderedSize.h }}
      >
        <div className="webbloom-node__header">
          <Globe size={14} strokeWidth={1.8} />
          <span className="webbloom-node__title">{title}</span>
          <span className="webbloom-node__url">{resource}</span>
          <ExternalLink
            size={14}
            strokeWidth={1.8}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              void window.api.openUrl(resource)
            }}
          />
        </div>
        <div
          ref={bodyRef}
          className="webbloom-node__body nowheel"
          style={{ width: renderedSize.w, height: Math.max(1, renderedSize.h - HEADER_HEIGHT) }}
          onPointerDown={() => {
            void window.api.focusWebBloomView(viewId)
          }}
        >
          {!viewReady ? <div className="webbloom-node__loading">Loading...</div> : null}
        </div>
      </div>
      <NodeResizeHandles
        visible={(selected || isResizing) && !dragging}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
