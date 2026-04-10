import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import type { ClusterColor, Size } from '@renderer/shared/types'
import { NodeResizeHandles } from './NodeResizeHandles'
import { useFixedCornerResize } from './useFixedCornerResize'
import './ClusterNode.css'

export type ClusterIndicatorTone = ClusterColor | 'neutral'
export type ClusterIndicator = {
  id: string
  tone?: ClusterIndicatorTone
  title?: string
}

export type ClusterSpringResize = {
  token: number
  strength: number
  durationMs: number
}

export type ClusterData = {
  label?: string
  color: ClusterColor
  size: Size
  indicators?: ClusterIndicator[]
  membershipCue?: 'accept' | 'release' | null
  springResize?: ClusterSpringResize | null
}

const MIN_CLUSTER_WIDTH = 180
const MIN_CLUSTER_HEIGHT = 120

export function ClusterNode({
  id,
  data,
  selected,
  dragging,
  positionAbsoluteX,
  positionAbsoluteY
}: NodeProps) {
  const clusterData = data as ClusterData
  const label = clusterData.label?.trim() || 'Cluster'
  const indicators = clusterData.indicators ?? []
  const updateClusterFrame = useBoardStore((s) => s.updateClusterFrame)
  const updateNodeLabel = useBoardStore((s) => s.updateNodeLabel)
  const updateNodeInternals = useUpdateNodeInternals()
  const [localSize, setLocalSize] = useState(clusterData.size)
  const [springAnimation, setSpringAnimation] = useState<ClusterSpringResize | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(clusterData.label ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const finishModeRef = useRef<'commit' | 'cancel'>('commit')

  const handleResizePreview = useCallback(
    ({ size }: { position: { x: number; y: number }; size: Size }) => {
      setLocalSize(size)
    },
    []
  )

  const handleResizeCommit = useCallback(
    ({ position, size }: { position: { x: number; y: number }; size: Size }) => {
      setLocalSize(size)
      updateClusterFrame(id, position, size)
    },
    [id, updateClusterFrame]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    nodeId: id,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size: localSize,
    minWidth: MIN_CLUSTER_WIDTH,
    minHeight: MIN_CLUSTER_HEIGHT,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })

  useEffect(() => {
    if (isResizing) return
    setLocalSize(clusterData.size)
  }, [clusterData.size, isResizing])

  useEffect(() => {
    if (!clusterData.springResize || dragging || isResizing) {
      setSpringAnimation(null)
      return
    }

    setSpringAnimation(null)
    const frame = window.requestAnimationFrame(() => {
      setSpringAnimation(clusterData.springResize ?? null)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [clusterData.springResize, dragging, isResizing])

  useEffect(() => {
    if (editing) return
    setDraftLabel(clusterData.label ?? '')
  }, [clusterData.label, editing])

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

  const springStyle = springAnimation
    ? ({
        '--cluster-spring-duration': `${springAnimation.durationMs}ms`,
        '--cluster-spring-scale-from': `${1 + springAnimation.strength}`
      } as CSSProperties)
    : undefined

  const startEditing = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isResizing) return
      event.stopPropagation()
      finishModeRef.current = 'commit'
      setDraftLabel(clusterData.label ?? '')
      setEditing(true)
    },
    [clusterData.label, isResizing]
  )

  const commitEditing = useCallback(() => {
    setEditing(false)
    updateNodeLabel(id, draftLabel)
  }, [draftLabel, id, updateNodeLabel])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setDraftLabel(clusterData.label ?? '')
  }, [clusterData.label])

  const finishEditing = useCallback(
    (mode: 'commit' | 'cancel') => {
      finishModeRef.current = mode
      if (mode === 'commit') {
        commitEditing()
        return
      }

      cancelEditing()
    },
    [cancelEditing, commitEditing]
  )

  return (
    <>
      <div
        className={`cluster-node cluster-node--${clusterData.color}${selected ? ' cluster-node--selected' : ''}${clusterData.membershipCue ? ` cluster-node--cue-${clusterData.membershipCue}` : ''}${isResizing || editing ? ' nodrag nopan' : ''}${springAnimation ? ' cluster-node--settle' : ''}`}
        style={
          springStyle
            ? { width: localSize.w, height: localSize.h, ...springStyle }
            : { width: localSize.w, height: localSize.h }
        }
        title={label}
        onDoubleClick={startEditing}
        onAnimationEnd={(e) => {
          if (e.animationName === 'cluster-settle') {
            setSpringAnimation(null)
          }
        }}
      >
        <div className="cluster-node__header">
          {editing ? (
            <input
              ref={inputRef}
              className="cluster-node__label-input nodrag nopan"
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
          ) : (
            <div className="cluster-node__label">{label}</div>
          )}
        </div>
        {indicators.length > 0 && (
          <div className="cluster-node__indicators">
            {indicators.map((indicator) => (
              <span
                key={indicator.id}
                className={`cluster-node__indicator cluster-node__indicator--${indicator.tone ?? 'neutral'}`}
                title={indicator.title}
              />
            ))}
          </div>
        )}
      </div>
      <NodeResizeHandles
        visible={selected || isResizing}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
