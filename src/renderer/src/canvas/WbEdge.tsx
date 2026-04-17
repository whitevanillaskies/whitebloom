import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import type { EdgeLabelLayout, EdgeStyle } from '@renderer/shared/types'
import {
  getSvgStrokeProps,
  resolveCanvasStrokeColor,
  resolveCanvasTextColor,
} from './vectorStyles'
import { useBoardStore } from '@renderer/stores/board'
import './WbEdge.css'

export type WbEdgeData = {
  normalizedStyle: EdgeStyle
  normalizedLabelLayout: EdgeLabelLayout
  edgeZIndex: number
}

function resolveDashArray(dash: EdgeStyle['stroke']['dash']): string | undefined {
  if (dash === 'dashed') return '8 4'
  if (dash === 'dotted') return '2 4'
  return undefined
}

/**
 * Samples 100 points along the path and returns the normalized t (0–1) of the
 * point closest to (flowX, flowY) in flow coordinates.
 */
function findNearestPathPosition(
  pathEl: SVGPathElement,
  flowX: number,
  flowY: number
): number {
  const totalLength = pathEl.getTotalLength()
  if (totalLength === 0) return 0.5
  const SAMPLES = 100
  let bestT = 0.5
  let bestDist = Infinity
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const pt = pathEl.getPointAtLength(t * totalLength)
    const dx = pt.x - flowX
    const dy = pt.y - flowY
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      bestT = t
    }
  }
  return bestT
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
  markerStart,
  markerEnd,
  selected,
}: EdgeProps) {
  const edgeData = (data ?? {}) as WbEdgeData
  const edgeStyle = edgeData.normalizedStyle

  // Call getBezierPath early so labelX/Y can seed initial display position state
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const updateEdge = useBoardStore((s) => s.updateEdge)
  const updateEdgeLabelLayout = useBoardStore((s) => s.updateEdgeLabelLayout)
  const { screenToFlowPosition } = useReactFlow()

  // --- label text editing ---
  const labelStr = typeof label === 'string' ? label.trim() : ''
  const [isEditing, setIsEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(labelStr)
  const inputRef = useRef<HTMLInputElement>(null)
  const finishModeRef = useRef<'commit' | 'cancel'>('commit')

  // --- label drag-along-path ---
  const hitPathRef = useRef<SVGPathElement>(null)
  const isDraggingLabelRef = useRef(false)
  const persistedPathPosition = edgeData.normalizedLabelLayout?.pathPosition ?? 0.5
  const [localPathPosition, setLocalPathPosition] = useState(persistedPathPosition)
  // Display coords, seeded with bezier midpoint; updated by layout effect via getPointAtLength
  const [labelDisplayX, setLabelDisplayX] = useState(labelX)
  const [labelDisplayY, setLabelDisplayY] = useState(labelY)

  // --- sync effects ---

  // Recompute display coords whenever the edge path changes or localPathPosition moves
  useLayoutEffect(() => {
    const pathEl = hitPathRef.current
    if (!pathEl) return
    const totalLength = pathEl.getTotalLength()
    if (totalLength === 0) return
    const pt = pathEl.getPointAtLength(localPathPosition * totalLength)
    setLabelDisplayX(pt.x)
    setLabelDisplayY(pt.y)
  }, [edgePath, localPathPosition])

  // Sync localPathPosition from store when not mid-drag
  useEffect(() => {
    if (isDraggingLabelRef.current) return
    setLocalPathPosition(persistedPathPosition)
  }, [persistedPathPosition])

  // Sync draft text when label prop changes externally (not while editing)
  useEffect(() => {
    if (isEditing) return
    setDraftLabel(labelStr)
  }, [isEditing, labelStr])

  // Auto-focus when editing starts
  useEffect(() => {
    if (!isEditing) return
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isEditing])

  // --- callbacks ---

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      finishModeRef.current = 'commit'
      setDraftLabel(labelStr)
      setIsEditing(true)
    },
    [labelStr]
  )

  const commitEditing = useCallback(() => {
    setIsEditing(false)
    const trimmed = draftLabel.trim()
    updateEdge(id, { label: trimmed || undefined })
  }, [draftLabel, id, updateEdge])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setDraftLabel(labelStr)
  }, [labelStr])

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return
      e.stopPropagation()
      e.preventDefault()

      const pathEl = hitPathRef.current
      if (!pathEl) return

      isDraggingLabelRef.current = true

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const flowPos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
        const nearest = findNearestPathPosition(pathEl, flowPos.x, flowPos.y)
        setLocalPathPosition(nearest)
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        isDraggingLabelRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        const flowPos = screenToFlowPosition({ x: upEvent.clientX, y: upEvent.clientY })
        const nearest = findNearestPathPosition(pathEl, flowPos.x, flowPos.y)
        setLocalPathPosition(nearest)
        updateEdgeLabelLayout(id, { pathPosition: nearest })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [id, isEditing, screenToFlowPosition, updateEdgeLabelLayout]
  )

  // --- render ---

  const strokeWidth = selected
    ? Math.max(edgeStyle.stroke.width + 0.5, 2)
    : edgeStyle.stroke.width

  const stroke = resolveCanvasStrokeColor(edgeStyle.stroke.color, 'var(--color-secondary-fg)')
  const labelColor = resolveCanvasTextColor(edgeStyle.labelColor)
  const labelZIndex = edgeData.edgeZIndex
  const strokeDasharray = resolveDashArray(edgeStyle.stroke.dash)
  const hitWidth = Math.max(strokeWidth + 20, 24)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          stroke,
          ...getSvgStrokeProps(strokeWidth),
          strokeDasharray,
        }}
      />
      {/* Invisible wide overlay — hit area for double-click-to-edit and also used for getPointAtLength */}
      <path
        ref={hitPathRef}
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        onDoubleClick={startEditing}
        onMouseDown={(e) => e.preventDefault()}
      />
      <EdgeLabelRenderer>
        {isEditing ? (
          <div
            className="wb-edge-label-edit nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelDisplayX}px,${labelDisplayY}px)`,
              zIndex: labelZIndex,
            }}
          >
            <input
              ref={inputRef}
              className="wb-edge-label-input"
              style={{ color: labelColor }}
              value={draftLabel}
              size={Math.max(draftLabel.length || 1, 8)}
              placeholder="Label…"
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={() => {
                const mode = finishModeRef.current
                finishModeRef.current = 'commit'
                if (mode === 'cancel') {
                  cancelEditing()
                  return
                }
                commitEditing()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finishModeRef.current = 'commit'
                  commitEditing()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  finishModeRef.current = 'cancel'
                  cancelEditing()
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : labelStr ? (
          <div
            className="wb-edge-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelDisplayX}px,${labelDisplayY}px)`,
              color: labelColor,
              zIndex: labelZIndex,
            }}
            onDoubleClick={startEditing}
            onMouseDown={handleLabelMouseDown}
          >
            {labelStr}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  )
}
