import { useCallback, useEffect, useState } from 'react'
import { Handle, Position, type NodeProps, useInternalNode, useUpdateNodeInternals } from '@xyflow/react'
import type { ShapeNodeData as PersistedShapeNodeData, Size } from '@renderer/shared/types'
import { useBoardStore } from '@renderer/stores/board'
import { CONNECTION_HANDLE_OUTSET_PX, NODE_HANDLE_IDS } from './canvas-constants'
import { getShapePresetDefinition, supportsNonUniformScale, type ShapePrimitive } from './shapePresets'
import { NodeResizeHandles } from './NodeResizeHandles'
import { useFixedCornerResize } from './useFixedCornerResize'
import {
  getSvgStrokeProps,
  resolveCanvasFillColor,
  resolveCanvasStrokeColor,
  resolveCanvasTextColor
} from './vectorStyles'

export type ShapeNodeData = {
  shape: PersistedShapeNodeData
  size: Size
  label?: string
}

function renderShapePrimitive(primitive: ShapePrimitive, index: number) {
  const commonProps = {
    key: `${primitive.kind}-${index}`,
    fill: primitive.fill,
    stroke: primitive.stroke,
    ...getSvgStrokeProps(primitive.strokeWidth)
  }

  if (primitive.kind === 'rect') {
    return (
      <rect
        {...commonProps}
        x={primitive.x}
        y={primitive.y}
        width={primitive.width}
        height={primitive.height}
        rx={primitive.rx}
        ry={primitive.ry}
      />
    )
  }

  if (primitive.kind === 'ellipse') {
    return (
      <ellipse
        {...commonProps}
        cx={primitive.cx}
        cy={primitive.cy}
        rx={primitive.rx}
        ry={primitive.ry}
      />
    )
  }

  if (primitive.kind === 'polygon') {
    return (
      <polygon
        {...commonProps}
        points={primitive.points}
      />
    )
  }

  return (
    <path
      {...commonProps}
      d={primitive.d}
    />
  )
}

export function ShapeNode({ id, data, selected, dragging }: NodeProps) {
  const shapeData = data as ShapeNodeData
  const internalNode = useInternalNode(id)
  const fallbackPositionAbsoluteX = typeof internalNode?.internals.positionAbsolute.x === 'number'
    ? internalNode.internals.positionAbsolute.x
    : 0
  const fallbackPositionAbsoluteY = typeof internalNode?.internals.positionAbsolute.y === 'number'
    ? internalNode.internals.positionAbsolute.y
    : 0
  const preset = getShapePresetDefinition(shapeData.shape.preset)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()
  const [localSize, setLocalSize] = useState({ w: shapeData.size.w, h: shapeData.size.h })
  const stroke = resolveCanvasStrokeColor(shapeData.shape.style.stroke.color, 'var(--color-primary-fg)')
  const fill = resolveCanvasFillColor(shapeData.shape.style.fill.color, 'transparent')
  const labelColor = resolveCanvasTextColor()
  const strokeWidth = shapeData.shape.style.stroke.width
  const keepAspectRatio = !supportsNonUniformScale(shapeData.shape.preset)

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
    position: { x: fallbackPositionAbsoluteX, y: fallbackPositionAbsoluteY },
    size: localSize,
    minWidth: preset.minSize.w,
    minHeight: preset.minSize.h,
    keepAspectRatio,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })

  useEffect(() => {
    if (isResizing) return
    setLocalSize({ w: shapeData.size.w, h: shapeData.size.h })
  }, [isResizing, shapeData.size.h, shapeData.size.w])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])

  const labelBox = preset.getLabelBox({
    width: localSize.w,
    height: localSize.h,
    strokeWidth
  })
  const anchors = preset.getConnectionAnchors({
    width: localSize.w,
    height: localSize.h,
    strokeWidth
  })
  const handleMap = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  const primitives = preset.renderShape({
    width: localSize.w,
    height: localSize.h,
    stroke,
    fill,
    strokeWidth,
    selected: selected ?? false
  })

  return (
    <>
      <div
        className={`shape-node${selected ? ' shape-node--selected' : ''}${isResizing ? ' shape-node--resizing nodrag nopan' : ''}`}
        style={{
          width: localSize.w,
          height: localSize.h
        }}
      >
        <svg
          className="shape-node__svg"
          width={localSize.w}
          height={localSize.h}
          viewBox={`0 0 ${localSize.w} ${localSize.h}`}
          aria-hidden="true"
        >
          {primitives.map((primitive, index) => renderShapePrimitive(primitive, index))}
        </svg>

        <div
          className="shape-node__label"
          style={{
            left: labelBox.x,
            top: labelBox.y,
            width: labelBox.width,
            height: labelBox.height,
            color: labelColor
          }}
        >
          {shapeData.label?.trim() || preset.displayName}
        </div>
      </div>

      <span style={{ visibility: dragging ? 'hidden' : undefined }}>
        <Handle
          id={NODE_HANDLE_IDS.top}
          type="target"
          position={Position.Top}
          style={{ top: -CONNECTION_HANDLE_OUTSET_PX, left: handleMap.get('top')?.x }}
        />
        <Handle
          id={NODE_HANDLE_IDS.left}
          type="target"
          position={Position.Left}
          style={{ left: -CONNECTION_HANDLE_OUTSET_PX, top: handleMap.get('left')?.y }}
        />
        <Handle
          id={NODE_HANDLE_IDS.bottom}
          type="source"
          position={Position.Bottom}
          style={{ bottom: -CONNECTION_HANDLE_OUTSET_PX, left: handleMap.get('bottom')?.x }}
        />
        <Handle
          id={NODE_HANDLE_IDS.right}
          type="source"
          position={Position.Right}
          style={{ right: -CONNECTION_HANDLE_OUTSET_PX, top: handleMap.get('right')?.y }}
        />
      </span>
      <NodeResizeHandles
        visible={(selected ?? false) || isResizing}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
