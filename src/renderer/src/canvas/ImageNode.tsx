import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { type NodeProps, useStore, useUpdateNodeInternals, useViewport } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import { NodeResizeHandles } from './NodeResizeHandles'
import { useFixedCornerResize } from './useFixedCornerResize'
import './ImageNode.css'

const MIN_SIZE = 80

type ImageNodeData = {
  resource: string
  size: { w: number; h: number }
}

function toFileUrl(resourcePath: string): string {
  return `wb-file://local?p=${encodeURIComponent(resourcePath)}`
}

export function ImageNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { resource, size } = data as ImageNodeData
  const { x, y, zoom } = useViewport()
  const canvasWidth = useStore((s) => s.width)
  const canvasHeight = useStore((s) => s.height)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()

  const [isVisible, setIsVisible] = useState(true)
  const [localSize, setLocalSize] = useState({ w: size.w, h: size.h })

  const handleResizePreview = useCallback(
    ({ position, size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
    },
    [id, updateNodePosition]
  )

  const handleResizeCommit = useCallback(
    ({ position, size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, nextSize.w, nextSize.h)
    },
    [id, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size: localSize,
    minWidth: MIN_SIZE,
    minHeight: MIN_SIZE,
    keepAspectRatio: true,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })

  useEffect(() => {
    if (isResizing) return
    setLocalSize({ w: size.w, h: size.h })
  }, [isResizing, size.w, size.h])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])

  useEffect(() => {
    const timer = setTimeout(() => {
      const nodeScreenX = positionAbsoluteX * zoom + x
      const nodeScreenY = positionAbsoluteY * zoom + y
      const nodeScreenW = localSize.w * zoom
      const nodeScreenH = localSize.h * zoom
      const bufferX = canvasWidth * 0.15
      const bufferY = canvasHeight * 0.15

      const visible =
        nodeScreenX + nodeScreenW > -bufferX &&
        nodeScreenX < canvasWidth + bufferX &&
        nodeScreenY + nodeScreenH > -bufferY &&
        nodeScreenY < canvasHeight + bufferY

      setIsVisible(visible)
    }, 400)

    return () => clearTimeout(timer)
  }, [x, y, zoom, positionAbsoluteX, positionAbsoluteY, localSize.w, localSize.h, canvasWidth, canvasHeight])

  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation()
    void window.api.openFile(resource)
  }

  return (
    <>
      <div
        className={`image-node${selected ? ' image-node--selected' : ''}${isResizing ? ' image-node--resizing nodrag nopan' : ''}`}
        style={{ width: localSize.w, height: localSize.h }}
        onDoubleClick={handleDoubleClick}
      >
        <div className="image-node__frame">
          {isVisible ? (
            <img
              className="image-node__img"
              src={toFileUrl(resource)}
              decoding="async"
              draggable={false}
            />
          ) : null}
        </div>
      </div>
      <NodeResizeHandles
        visible={selected || isResizing}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
