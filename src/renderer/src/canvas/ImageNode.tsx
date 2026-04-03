import { useEffect, useState, type MouseEvent } from 'react'
import { type NodeProps, useViewport, useStore } from '@xyflow/react'
import './ImageNode.css'

type ImageNodeData = {
  resource: string
  size: { w: number; h: number }
}

function toFileUrl(resourcePath: string): string {
  return `wb-file://local?p=${encodeURIComponent(resourcePath)}`
}

export function ImageNode({ data, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { resource, size } = data as ImageNodeData
  const { x, y, zoom } = useViewport()
  const canvasWidth = useStore((s) => s.width)
  const canvasHeight = useStore((s) => s.height)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      const nodeScreenX = positionAbsoluteX * zoom + x
      const nodeScreenY = positionAbsoluteY * zoom + y
      const nodeScreenW = size.w * zoom
      const nodeScreenH = size.h * zoom
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
  }, [x, y, zoom, positionAbsoluteX, positionAbsoluteY, size.w, size.h, canvasWidth, canvasHeight])

  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation()
    void window.api.openFile(resource)
  }

  return (
    <div
      className="image-node"
      style={{ width: size.w, height: size.h }}
      onDoubleClick={handleDoubleClick}
    >
      {isVisible ? (
        <img
          className="image-node__img"
          src={toFileUrl(resource)}
          decoding="async"
          draggable={false}
        />
      ) : null}
    </div>
  )
}
