import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { EdgeStyle } from '@renderer/shared/types'
import {
  getSvgStrokeProps,
  resolveCanvasStrokeColor,
  resolveCanvasTextColor,
} from './vectorStyles'
import './WbEdge.css'

export type WbEdgeData = {
  normalizedStyle: EdgeStyle
}

function resolveDashArray(dash: EdgeStyle['stroke']['dash']): string | undefined {
  if (dash === 'dashed') return '8 4'
  if (dash === 'dotted') return '2 4'
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
  const edgeStyle = edgeData.normalizedStyle

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // Widen slightly when selected so selection state is visually clear
  const strokeWidth = selected
    ? Math.max(edgeStyle.stroke.width + 0.5, 2)
    : edgeStyle.stroke.width

  const stroke = resolveCanvasStrokeColor(edgeStyle.stroke.color, 'var(--color-secondary-fg)')
  const labelColor = resolveCanvasTextColor(edgeStyle.labelColor)
  const strokeDasharray = resolveDashArray(edgeStyle.stroke.dash)

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
