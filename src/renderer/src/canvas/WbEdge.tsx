import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { BoardEdge } from '@renderer/shared/types'
import './WbEdge.css'

export type WbEdgeData = {
  style?: BoardEdge['style']
  color?: BoardEdge['color']
}

const COLOR_TOKENS: Record<string, string> = {
  blue:   'var(--color-accent-blue)',
  pink:   'var(--color-accent-pink)',
  red:    'var(--color-accent-red)',
  purple: 'var(--color-accent-purple)',
  green:  'var(--color-accent-green)',
}

function resolveColor(color: string | undefined): string {
  if (!color) return 'var(--color-secondary-fg)'
  if (color.startsWith('#') || color.startsWith('rgb')) return color
  return COLOR_TOKENS[color] ?? 'var(--color-secondary-fg)'
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

  const stroke = resolveColor(edgeData.color)
  const strokeDasharray = resolveDashArray(edgeData.style)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray,
          strokeLinecap: 'round',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="wb-edge-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              color: stroke,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
