import { useEffect, useRef } from 'react'
import { useConnection, useReactFlow, type Node as RFNode } from '@xyflow/react'
import type { BoardNode } from '@renderer/shared/types'
import { CONNECTION_PROXIMITY_THRESHOLD } from './canvas-constants'

type Props = {
  boardNodes: BoardNode[]
  setNodes: React.Dispatch<React.SetStateAction<RFNode[]>>
  isReconnecting: boolean
}

/**
 * Two-pass nearest-node search:
 * 1. Find the nearest non-cluster node within threshold.
 * 2. If none, find the nearest cluster node within threshold.
 * This prevents a large cluster bbox (dist=0) from blocking proximity
 * detection of child nodes that are nearby but not yet under the cursor.
 */
function findNearestNode(x: number, y: number, boardNodes: BoardNode[], sourceId: string | null): string | null {
  let nearestId: string | null = null
  let minDist = CONNECTION_PROXIMITY_THRESHOLD

  // Pass 1: non-cluster nodes only
  for (const node of boardNodes) {
    if (node.id === sourceId || node.kind === 'cluster') continue
    const dx = Math.max(node.position.x - x, 0, x - (node.position.x + node.size.w))
    const dy = Math.max(node.position.y - y, 0, y - (node.position.y + node.size.h))
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) {
      minDist = dist
      nearestId = node.id
    }
  }

  if (nearestId !== null) return nearestId

  // Pass 2: cluster nodes (fallback when no leaf/bud is nearby)
  minDist = CONNECTION_PROXIMITY_THRESHOLD
  for (const node of boardNodes) {
    if (node.id === sourceId || node.kind !== 'cluster') continue
    const dx = Math.max(node.position.x - x, 0, x - (node.position.x + node.size.w))
    const dy = Math.max(node.position.y - y, 0, y - (node.position.y + node.size.h))
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) {
      minDist = dist
      nearestId = node.id
    }
  }

  return nearestId
}

/**
 * Renders nothing. Lives inside the ReactFlow tree so it can read useConnection().
 * When a connection is in progress, tracks cursor proximity to board nodes and
 * stamps `wb-handles-visible` on the nearest node within threshold so its
 * handles become visible via CSS.
 */
export function ProximityTracker({ boardNodes, setNodes, isReconnecting }: Props) {
  const connection = useConnection()
  const { screenToFlowPosition } = useReactFlow()
  const prevProximityIdRef = useRef<string | null>(null)

  useEffect(() => {
    const clearProximity = () => {
      if (prevProximityIdRef.current === null) return
      const prev = prevProximityIdRef.current
      prevProximityIdRef.current = null
      setNodes((nds) => nds.map((n) => (n.id === prev ? { ...n, className: '' } : n)))
    }

    if (!connection.inProgress || !connection.to) {
      if (!isReconnecting) clearProximity()
      return
    }

    const { x, y } = connection.to
    const sourceId = connection.fromNode?.id ?? null
    const nearestId = findNearestNode(x, y, boardNodes, sourceId)

    if (nearestId === prevProximityIdRef.current) return

    const prev = prevProximityIdRef.current
    prevProximityIdRef.current = nearestId

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === prev) return { ...n, className: '' }
        if (n.id === nearestId) return { ...n, className: 'wb-handles-visible' }
        return n
      })
    )
  }, [connection, boardNodes, setNodes, isReconnecting])

  // Track proximity via mousemove during edge-endpoint reconnection drags.
  // useConnection() may not fire during reconnection, so we listen to raw events.
  useEffect(() => {
    if (!isReconnecting || connection.inProgress) return

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const nearestId = findNearestNode(x, y, boardNodes, null)

      if (nearestId === prevProximityIdRef.current) return
      const prev = prevProximityIdRef.current
      prevProximityIdRef.current = nearestId
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === prev) return { ...n, className: '' }
          if (n.id === nearestId) return { ...n, className: 'wb-handles-visible' }
          return n
        })
      )
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (prevProximityIdRef.current !== null) {
        const prev = prevProximityIdRef.current
        prevProximityIdRef.current = null
        setNodes((nds) => nds.map((n) => (n.id === prev ? { ...n, className: '' } : n)))
      }
    }
  }, [isReconnecting, connection.inProgress, boardNodes, screenToFlowPosition, setNodes])

  return null
}
