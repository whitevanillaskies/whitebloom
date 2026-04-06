import { useEffect, useRef } from 'react'
import { useConnection, type Node as RFNode } from '@xyflow/react'
import type { BoardNode } from '@renderer/shared/types'
import { CONNECTION_PROXIMITY_THRESHOLD } from './canvas-constants'

type Props = {
  boardNodes: BoardNode[]
  setNodes: React.Dispatch<React.SetStateAction<RFNode[]>>
}

/**
 * Renders nothing. Lives inside the ReactFlow tree so it can read useConnection().
 * When a connection is in progress, tracks cursor proximity to board nodes and
 * stamps `wb-handles-visible` on the nearest node within threshold so its
 * handles become visible via CSS.
 */
export function ProximityTracker({ boardNodes, setNodes }: Props) {
  const connection = useConnection()
  const prevProximityIdRef = useRef<string | null>(null)

  useEffect(() => {
    const clearProximity = () => {
      if (prevProximityIdRef.current === null) return
      const prev = prevProximityIdRef.current
      prevProximityIdRef.current = null
      setNodes((nds) => nds.map((n) => (n.id === prev ? { ...n, className: '' } : n)))
    }

    if (!connection.inProgress || !connection.to) {
      clearProximity()
      return
    }

    const { x, y } = connection.to
    const sourceId = connection.fromNode?.id ?? null

    let nearestId: string | null = null
    let minDist = CONNECTION_PROXIMITY_THRESHOLD

    for (const node of boardNodes) {
      if (node.id === sourceId) continue
      // Distance from cursor to nearest point on node bounding box
      const dx = Math.max(node.position.x - x, 0, x - (node.position.x + node.size.w))
      const dy = Math.max(node.position.y - y, 0, y - (node.position.y + node.size.h))
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) {
        minDist = dist
        nearestId = node.id
      }
    }

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
  }, [connection, boardNodes, setNodes])

  return null
}
