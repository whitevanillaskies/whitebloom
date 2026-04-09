import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ShapeNodeData as PersistedShapeNodeData, Size } from '@renderer/shared/types'
import { CONNECTION_HANDLE_OUTSET_PX, NODE_HANDLE_IDS } from './canvas-constants'
import { getShapePresetDefinition, type ShapePrimitive } from './shapePresets'
import { getSvgStrokeProps, resolveVectorColor } from './vectorStyles'

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

export function ShapeNode({ data, selected, dragging }: NodeProps) {
  const shapeData = data as ShapeNodeData
  const preset = getShapePresetDefinition(shapeData.shape.preset)
  const stroke = resolveVectorColor(shapeData.shape.style.stroke.color, 'var(--color-primary-fg)')
  const fill = resolveVectorColor(shapeData.shape.style.fill.color, 'var(--color-panel)')
  const strokeWidth = shapeData.shape.style.stroke.width
  const labelBox = preset.getLabelBox({
    width: shapeData.size.w,
    height: shapeData.size.h,
    strokeWidth
  })
  const anchors = preset.getConnectionAnchors({
    width: shapeData.size.w,
    height: shapeData.size.h,
    strokeWidth
  })
  const handleMap = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  const primitives = preset.renderShape({
    width: shapeData.size.w,
    height: shapeData.size.h,
    stroke,
    fill,
    strokeWidth,
    selected: selected ?? false
  })

  return (
    <>
      <div
        className={`shape-node${selected ? ' shape-node--selected' : ''}`}
        style={{
          width: shapeData.size.w,
          height: shapeData.size.h
        }}
      >
        <svg
          className="shape-node__svg"
          width={shapeData.size.w}
          height={shapeData.size.h}
          viewBox={`0 0 ${shapeData.size.w} ${shapeData.size.h}`}
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
            height: labelBox.height
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
    </>
  )
}
