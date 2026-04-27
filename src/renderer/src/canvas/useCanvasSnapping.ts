import { useCallback, useMemo, useRef, useState } from 'react'
import {
  computeSmartGuideSnap,
  type LayoutNode,
  type LayoutPoint,
  type SmartGuide,
  type SmartGuideSnap
} from './layoutGeometry'

export type CanvasSnappingSession = {
  movingNodeIds: string[]
  movingNodes: LayoutNode[]
  stationaryNodes: LayoutNode[]
}

export type CanvasSnappingInput = {
  nodes: LayoutNode[]
  enabled?: boolean
  threshold?: number
}

export type CanvasSnappingPreviewInput = {
  movingNodeIds: string[]
  proposedDelta: LayoutPoint
}

export type CanvasSnappingState = {
  enabled: boolean
  guides: SmartGuide[]
  activeSession: CanvasSnappingSession | null
  beginSnapping: (movingNodeIds: string[]) => CanvasSnappingSession | null
  previewSnapping: (
    proposedDelta: LayoutPoint,
    session?: CanvasSnappingSession | null
  ) => SmartGuideSnap
  previewSnappingForNodes: (input: CanvasSnappingPreviewInput) => SmartGuideSnap
  clearGuides: () => void
  endSnapping: () => void
}

const EMPTY_SNAP: SmartGuideSnap = {
  delta: { x: 0, y: 0 },
  guides: []
}

export function useCanvasSnapping({
  nodes,
  enabled = true,
  threshold
}: CanvasSnappingInput): CanvasSnappingState {
  const [guides, setGuides] = useState<SmartGuide[]>([])
  const [activeSession, setActiveSession] = useState<CanvasSnappingSession | null>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node] as const)), [nodes])

  const clearGuides = useCallback(() => {
    setGuides((current) => (current.length === 0 ? current : []))
  }, [])

  const buildSession = useCallback(
    (movingNodeIds: string[]): CanvasSnappingSession | null => {
      const movingIdSet = new Set(movingNodeIds)
      const movingNodes = movingNodeIds
        .map((id) => nodeById.get(id))
        .filter((node): node is LayoutNode => node !== undefined)

      if (movingNodes.length === 0) return null

      return {
        movingNodeIds,
        movingNodes,
        stationaryNodes: nodesRef.current.filter((node) => !movingIdSet.has(node.id))
      }
    },
    [nodeById]
  )

  const beginSnapping = useCallback(
    (movingNodeIds: string[]) => {
      const nextSession = buildSession(movingNodeIds)
      setActiveSession(nextSession)
      if (!nextSession || !enabled) clearGuides()
      return nextSession
    },
    [buildSession, clearGuides, enabled]
  )

  const previewSnapping = useCallback(
    (proposedDelta: LayoutPoint, session: CanvasSnappingSession | null = activeSession) => {
      if (!enabled || !session) {
        clearGuides()
        return { ...EMPTY_SNAP, delta: proposedDelta }
      }

      const snap = computeSmartGuideSnap({
        movingNodes: session.movingNodes,
        stationaryNodes: session.stationaryNodes,
        proposedDelta,
        threshold
      })
      setGuides(snap.guides)
      return snap
    },
    [activeSession, clearGuides, enabled, threshold]
  )

  const previewSnappingForNodes = useCallback(
    ({ movingNodeIds, proposedDelta }: CanvasSnappingPreviewInput) => {
      const session = buildSession(movingNodeIds)
      return previewSnapping(proposedDelta, session)
    },
    [buildSession, previewSnapping]
  )

  const endSnapping = useCallback(() => {
    setActiveSession(null)
    clearGuides()
  }, [clearGuides])

  return {
    enabled,
    guides,
    activeSession,
    beginSnapping,
    previewSnapping,
    previewSnappingForNodes,
    clearGuides,
    endSnapping
  }
}
