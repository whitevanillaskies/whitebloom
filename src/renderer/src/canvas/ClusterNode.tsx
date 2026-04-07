import { useCallback, useEffect, useState } from 'react'
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import type { ClusterColor, Size } from '@renderer/shared/types'
import { NodeResizeHandles } from './NodeResizeHandles'
import { useFixedCornerResize } from './useFixedCornerResize'
import './ClusterNode.css'

export type ClusterData = {
  label?: string
  color: ClusterColor
  size: Size
  membershipCue?: 'accept' | 'release' | null
}

const MIN_CLUSTER_WIDTH = 180
const MIN_CLUSTER_HEIGHT = 120

export function ClusterNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const clusterData = data as ClusterData
  const label = clusterData.label?.trim() || 'Cluster'
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const reconcileClusterMembershipsForCluster = useBoardStore((s) => s.reconcileClusterMembershipsForCluster)
  const updateNodeInternals = useUpdateNodeInternals()
  const [localSize, setLocalSize] = useState(clusterData.size)

  const handleResizePreview = useCallback(
    ({ position, size }: { position: { x: number; y: number }; size: Size }) => {
      setLocalSize(size)
      updateNodePosition(id, position.x, position.y)
    },
    [id, updateNodePosition]
  )

  const handleResizeCommit = useCallback(
    ({ position, size }: { position: { x: number; y: number }; size: Size }) => {
      setLocalSize(size)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, size.w, size.h)
      reconcileClusterMembershipsForCluster(id)
    },
    [id, reconcileClusterMembershipsForCluster, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
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
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])

  return (
    <>
      <div
        className={`cluster-node cluster-node--${clusterData.color}${selected ? ' cluster-node--selected' : ''}${clusterData.membershipCue ? ` cluster-node--cue-${clusterData.membershipCue}` : ''}${isResizing ? ' nodrag nopan' : ''}`}
        style={{ width: localSize.w, height: localSize.h }}
        title={label}
      >
        <div className="cluster-node__label">{label}</div>
      </div>
      <NodeResizeHandles
        visible={selected || isResizing}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
