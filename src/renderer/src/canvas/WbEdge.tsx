import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { BoardEdge } from '@renderer/shared/types'
import {
  getSvgStrokeProps,
  resolveCanvasStrokeColor,
  resolveCanvasTextColor
} from './vectorStyles'
import './WbEdge.css'

export type WbEdgeData = {
  style?: BoardEdge['style']
  color?: BoardEdge['color']
}

function resolveDashArray(style: BoardEdge['style']): string | undefined {
  if (style === 'dashed') return '8 4'
  if (style === 'dotted') return '2 4'
  return undefined
}

export function WbEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
}: EdgeProps) {
  const edgeData = (data ?? {}) as WbEdgeData

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const strokeWidth = selected ? 2 : 1.5
  const stroke = resolveCanvasStrokeColor(edgeData.color, 'var(--color-secondary-fg)')
  const labelColor = resolveCanvasTextColor(edgeData.color, 'var(--color-primary-fg)')
  const strokeDasharray = resolveDashArray(edgeData.style)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          ...getSvgStrokeProps(strokeWidth),
          strokeDasharray,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="wb-edge-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              color: labelColor,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
