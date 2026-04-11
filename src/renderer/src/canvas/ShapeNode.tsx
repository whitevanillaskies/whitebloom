import { useCallback, useEffect, useRef, useState } from 'react'
import { type NodeProps, useInternalNode, useUpdateNodeInternals } from '@xyflow/react'
import type { ShapeNodeData as PersistedShapeNodeData, Size } from '@renderer/shared/types'
import { useBoardStore } from '@renderer/stores/board'
import { getShapePresetDefinition, supportsNonUniformScale, type ShapePrimitive } from './shapePresets'
import { NodeResizeHandles } from './NodeResizeHandles'
import { useFixedCornerResize } from './useFixedCornerResize'
import { CardinalHandles } from './CardinalHandles'
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
  const key = `${primitive.kind}-${index}`
  const commonProps = {
    fill: primitive.fill,
    stroke: primitive.stroke,
    ...getSvgStrokeProps(primitive.strokeWidth)
  }

  if (primitive.kind === 'rect') {
    return (
      <rect
        key={key}
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
        key={key}
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
        key={key}
        {...commonProps}
        points={primitive.points}
      />
    )
  }

  return (
    <path
      key={key}
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
  const updateNodeLabel = useBoardStore((s) => s.updateNodeLabel)
  const updateNodeInternals = useUpdateNodeInternals()
  const [localSize, setLocalSize] = useState({ w: shapeData.size.w, h: shapeData.size.h })
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(shapeData.label ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const finishModeRef = useRef<'commit' | 'cancel'>('commit')
  const stroke = resolveCanvasStrokeColor(shapeData.shape.style.stroke.color, 'var(--color-primary-fg)')
  const fill = resolveCanvasFillColor(shapeData.shape.style.fill.color, 'transparent')
  const labelColor = resolveCanvasTextColor()
  const strokeWidth = shapeData.shape.style.stroke.width
  const keepAspectRatio = !supportsNonUniformScale(shapeData.shape.preset)
  const label = shapeData.label?.trim()

  const handleResizePreview = useCallback(
    ({ size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
    },
    []
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
    nodeId: id,
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
    if (editing) return
    setDraftLabel(shapeData.label ?? '')
  }, [editing, shapeData.label])

  useEffect(() => {
    if (!editing) return
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editing])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])

  const startEditing = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isResizing) return
    event.stopPropagation()
    finishModeRef.current = 'commit'
    setDraftLabel(shapeData.label ?? '')
    setEditing(true)
  }, [isResizing, shapeData.label])

  const commitEditing = useCallback(() => {
    setEditing(false)
    updateNodeLabel(id, draftLabel)
  }, [draftLabel, id, updateNodeLabel])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setDraftLabel(shapeData.label ?? '')
  }, [shapeData.label])

  const finishEditing = useCallback((mode: 'commit' | 'cancel') => {
    finishModeRef.current = mode
    if (mode === 'commit') {
      commitEditing()
      return
    }

    cancelEditing()
  }, [cancelEditing, commitEditing])

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
        className={`shape-node${selected ? ' shape-node--selected' : ''}${isResizing ? ' shape-node--resizing nodrag nopan' : ''}${editing ? ' shape-node--editing nodrag nopan' : ''}`}
        style={{
          width: localSize.w,
          height: localSize.h
        }}
        onDoubleClick={startEditing}
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

        {editing ? (
          <input
            ref={inputRef}
            className="shape-node__label-input nodrag nopan"
            style={{
              left: labelBox.x,
              top: labelBox.y,
              width: labelBox.width,
              height: labelBox.height,
              color: labelColor
            }}
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onBlur={() => {
              const nextMode = finishModeRef.current
              finishModeRef.current = 'commit'
              if (nextMode === 'cancel') {
                cancelEditing()
                return
              }

              commitEditing()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                finishEditing('commit')
              } else if (event.key === 'Escape') {
                event.preventDefault()
                finishEditing('cancel')
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          />
        ) : label ? (
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
            {label}
          </div>
        ) : null}
      </div>

      <CardinalHandles
        hidden={dragging}
        offsets={{
          top: handleMap.get('top')?.x,
          left: handleMap.get('left')?.y,
          bottom: handleMap.get('bottom')?.x,
          right: handleMap.get('right')?.y
        }}
      />
      <NodeResizeHandles
        visible={((selected ?? false) || isResizing) && !dragging}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
