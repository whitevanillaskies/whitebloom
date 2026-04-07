import { create } from 'zustand'
import {
  CURRENT_BOARD_VERSION,
  type Board,
  type BoardEdge,
  type BoardNode,
  type ClusterColor,
  type ClusterNode,
  type BoardViewport,
  type WidthMode,
  isClusterNode
} from '@renderer/shared/types'
import { DEFAULT_USERNAME, normalizeUsername } from '../../../shared/app-settings'

type TextLayoutPatch = {
  content: string
  widthMode?: WidthMode
  wrapWidth?: number | null
}

type NodeMetadataFields = 'created' | 'createdBy' | 'updatedAt' | 'updatedBy'
type NodeMetadataCarrier = Partial<Record<NodeMetadataFields, string>>
type NonClusterBoardNode = Exclude<BoardNode, ClusterNode>

export type BoardNodeDraft = Omit<NonClusterBoardNode, NodeMetadataFields> &
  Partial<Pick<NonClusterBoardNode, NodeMetadataFields>>

export type ClusterNodeDraft = Omit<ClusterNode, NodeMetadataFields> &
  Partial<Pick<ClusterNode, NodeMetadataFields>>

type BoardState = Board & {
  path: string | null
  activeUsername: string
  isDirty: boolean
  addNode: (node: BoardNodeDraft) => void
  addCluster: (cluster: ClusterNodeDraft) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  addEdge: (edge: BoardEdge) => void
  deleteEdge: (id: string) => void
  updateEdge: (id: string, patch: Partial<Pick<BoardEdge, 'style' | 'color' | 'from' | 'to' | 'label'>>) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeSize: (id: string, w: number, h: number) => void
  updateNodeText: (id: string, patch: TextLayoutPatch) => void
  updateCluster: (
    id: string,
    patch: Partial<Pick<ClusterNode, 'label' | 'brief' | 'color' | 'children'>>
  ) => void
  translateCluster: (id: string, dx: number, dy: number) => void
  addNodeToCluster: (clusterId: string, nodeId: string) => void
  removeNodeFromCluster: (clusterId: string, nodeId: string) => void
  createClusterFromNodes: (input: {
    id: string
    label?: string
    brief?: string
    color?: ClusterColor
    childIds: string[]
    position: { x: number; y: number }
    size: { w: number; h: number }
  }) => void
  reconcileNodeClusterMembership: (nodeId: string) => void
  reconcileClusterMembershipsForCluster: (clusterId: string) => void
  fitClusterToChildren: (clusterId: string, padding?: number) => void
  updateBoardMeta: (patch: { name?: string; brief?: string }) => void
  updateViewport: (viewport: BoardViewport) => void
  setActiveUsername: (username: string) => void
  setBoardPersistence: (path: string | null, transient: boolean) => void
  clearBoard: () => void
  markSaved: () => void
  loadBoard: (board: Board, path: string) => void
}

function shouldMarkBoardDirty(state: Pick<BoardState, 'transient'>): boolean {
  return state.transient !== true
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function normalizeNodeMetadata<TNode extends NodeMetadataCarrier>(
  node: TNode,
  fallbackTimestamp: string,
  fallbackUsername: string
): TNode & Record<NodeMetadataFields, string> {
  const created = isValidIsoTimestamp(node.created)
    ? node.created
    : isValidIsoTimestamp(node.updatedAt)
      ? node.updatedAt
      : fallbackTimestamp
  const updatedAt = isValidIsoTimestamp(node.updatedAt) ? node.updatedAt : created
  const createdBy =
    typeof node.createdBy === 'string' && node.createdBy.trim().length > 0
      ? normalizeUsername(node.createdBy)
      : typeof node.updatedBy === 'string' && node.updatedBy.trim().length > 0
        ? normalizeUsername(node.updatedBy)
        : fallbackUsername
  const updatedBy =
    typeof node.updatedBy === 'string' && node.updatedBy.trim().length > 0
      ? normalizeUsername(node.updatedBy)
      : createdBy

  return { ...node, created, createdBy, updatedAt, updatedBy }
}

function touchNode<TNode extends BoardNode>(node: TNode, timestamp: string, username: string): TNode {
  const normalized = normalizeNodeMetadata(node, timestamp, username)
  if (normalized.updatedAt === timestamp && normalized.updatedBy === username) return normalized as TNode
  return { ...normalized, updatedAt: timestamp, updatedBy: username } as TNode
}

function sanitizeClusterChildren(nodes: BoardNode[]): BoardNode[] {
  const validNodeIds = new Set(nodes.filter((node) => !isClusterNode(node)).map((node) => node.id))
  const claimedChildIds = new Set<string>()

  return nodes.map((node) => {
    if (!isClusterNode(node)) return node

    const nextChildren: string[] = []
    for (const childId of node.children) {
      if (!validNodeIds.has(childId)) continue
      if (claimedChildIds.has(childId)) continue
      claimedChildIds.add(childId)
      nextChildren.push(childId)
    }

    return nextChildren.length === node.children.length &&
      nextChildren.every((childId, index) => childId === node.children[index])
      ? node
      : { ...node, children: nextChildren }
  })
}

function removeNodeIdsFromClusters(nodes: BoardNode[], removedIds: Set<string>): BoardNode[] {
  let changed = false

  const nextNodes = nodes
    .filter((node) => !removedIds.has(node.id))
    .map((node) => {
      if (!isClusterNode(node)) return node
      const nextChildren = node.children.filter((childId) => !removedIds.has(childId))
      if (nextChildren.length === node.children.length) return node
      changed = true
      return { ...node, children: nextChildren }
    })

  return changed ? nextNodes : nextNodes
}

function assignNodeToCluster(nodes: BoardNode[], clusterId: string, nodeId: string): BoardNode[] {
  const targetCluster = nodes.find(
    (node): node is ClusterNode => isClusterNode(node) && node.id === clusterId
  )
  if (!targetCluster) return nodes
  if (!nodes.some((node) => node.id === nodeId && !isClusterNode(node))) return nodes

  let changed = false
  const nextNodes = nodes.map((node) => {
    if (!isClusterNode(node)) return node

    if (node.id === clusterId) {
      if (node.children.includes(nodeId)) return node
      changed = true
      return { ...node, children: [...node.children, nodeId] }
    }

    if (!node.children.includes(nodeId)) return node
    changed = true
    return { ...node, children: node.children.filter((childId) => childId !== nodeId) }
  })

  return changed ? nextNodes : nodes
}

function removeNodeFromSingleCluster(nodes: BoardNode[], clusterId: string, nodeId: string): BoardNode[] {
  let changed = false
  const nextNodes = nodes.map((node) => {
    if (!isClusterNode(node) || node.id !== clusterId || !node.children.includes(nodeId)) return node
    changed = true
    return { ...node, children: node.children.filter((childId) => childId !== nodeId) }
  })

  return changed ? nextNodes : nodes
}

function getNodeBounds(node: Pick<BoardNode, 'position' | 'size'>) {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + node.size.w,
    bottom: node.position.y + node.size.h
  }
}

function isNodeFullyInsideCluster(node: BoardNode, cluster: ClusterNode): boolean {
  const nodeBounds = getNodeBounds(node)
  const clusterBounds = getNodeBounds(cluster)

  return (
    nodeBounds.left >= clusterBounds.left &&
    nodeBounds.top >= clusterBounds.top &&
    nodeBounds.right <= clusterBounds.right &&
    nodeBounds.bottom <= clusterBounds.bottom
  )
}

function isNodeFullyOutsideCluster(node: BoardNode, cluster: ClusterNode): boolean {
  const nodeBounds = getNodeBounds(node)
  const clusterBounds = getNodeBounds(cluster)

  return (
    nodeBounds.right < clusterBounds.left ||
    nodeBounds.left > clusterBounds.right ||
    nodeBounds.bottom < clusterBounds.top ||
    nodeBounds.top > clusterBounds.bottom
  )
}

function findOwningCluster(nodes: BoardNode[], nodeId: string): ClusterNode | null {
  return (
    nodes.find(
      (node): node is ClusterNode => isClusterNode(node) && node.children.includes(nodeId)
    ) ?? null
  )
}

function getContainingClusters(nodes: BoardNode[], targetNode: BoardNode): ClusterNode[] {
  return nodes
    .filter((node): node is ClusterNode => isClusterNode(node))
    .filter((cluster) => isNodeFullyInsideCluster(targetNode, cluster))
}

function getSmallestCluster(clusters: ClusterNode[]): ClusterNode | null {
  if (clusters.length === 0) return null

  return [...clusters].sort((left, right) => {
    const leftArea = left.size.w * left.size.h
    const rightArea = right.size.w * right.size.h
    return leftArea - rightArea
  })[0]
}

function reconcileNodeClusterMemberships(
  nodes: BoardNode[],
  nodeIds: string[],
  timestamp: string,
  username: string
): BoardNode[] {
  let nextNodes = nodes

  for (const nodeId of nodeIds) {
    const targetNode = nextNodes.find((node) => node.id === nodeId && !isClusterNode(node))
    if (!targetNode) continue

    const owningCluster = findOwningCluster(nextNodes, nodeId)
    const desiredCluster = getSmallestCluster(getContainingClusters(nextNodes, targetNode))

    if (desiredCluster) {
      const beforeMembership = new Set(
        nextNodes
          .filter((node) => isClusterNode(node) && node.children.includes(nodeId))
          .map((node) => node.id)
      )
      const reassignedNodes = assignNodeToCluster(nextNodes, desiredCluster.id, nodeId)
      if (reassignedNodes !== nextNodes) {
        nextNodes = reassignedNodes.map((node) => {
          if (!isClusterNode(node)) return node
          if (node.id !== desiredCluster.id && !beforeMembership.has(node.id)) return node
          return touchNode(node, timestamp, username)
        })
      }
      continue
    }

    if (!owningCluster) continue
    if (!isNodeFullyOutsideCluster(targetNode, owningCluster)) continue

    const removedNodes = removeNodeFromSingleCluster(nextNodes, owningCluster.id, nodeId)
    if (removedNodes !== nextNodes) {
      nextNodes = removedNodes.map((node) =>
        isClusterNode(node) && node.id === owningCluster.id
          ? touchNode(node, timestamp, username)
          : node
      )
    }
  }

  return nextNodes
}

export const useBoardStore = create<BoardState>((set) => ({
  version: CURRENT_BOARD_VERSION,
  path: null,
  transient: undefined,
  name: undefined,
  brief: undefined,
  nodes: [],
  edges: [],
  viewport: undefined,
  activeUsername: DEFAULT_USERNAME,
  isDirty: false,

  addNode: (node) =>
    set((state) => {
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      return {
        nodes: [...state.nodes, normalizeNodeMetadata(node, timestamp, username)],
        isDirty: shouldMarkBoardDirty(state)
      }
    }),

  addCluster: (cluster) =>
    set((state) => {
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const normalizedCluster = normalizeNodeMetadata(cluster, timestamp, username)
      const nodes = sanitizeClusterChildren([...state.nodes, normalizedCluster])
      return {
        nodes,
        isDirty: shouldMarkBoardDirty(state)
      }
    }),

  deleteNode: (id) =>
    set((state) => {
      const removedIds = new Set([id])
      return {
        nodes: removeNodeIdsFromClusters(state.nodes, removedIds),
        edges: state.edges.filter((e) => e.from !== id && e.to !== id),
        isDirty: shouldMarkBoardDirty(state)
      }
    }),

  deleteNodes: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        nodes: removeNodeIdsFromClusters(state.nodes, idSet),
        edges: state.edges.filter((e) => !idSet.has(e.from) && !idSet.has(e.to)),
        isDirty: shouldMarkBoardDirty(state)
      }
    }),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
      isDirty: shouldMarkBoardDirty(state)
    })),

  deleteEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      isDirty: shouldMarkBoardDirty(state)
    })),

  updateEdge: (id, patch) =>
    set((state) => {
      let changed = false
      const edges = state.edges.map((e) => {
        if (e.id !== id) return e
        const next = { ...e, ...patch }
        if (
          next.style === e.style &&
          next.color === e.color &&
          next.from === e.from &&
          next.to === e.to &&
          next.label === e.label
        ) return e
        changed = true
        return next
      })
      return changed ? { edges, isDirty: shouldMarkBoardDirty(state) } : state
    }),

  updateNodePosition: (id, x, y) =>
    set((state) => {
      let changed = false
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.position.x === x && n.position.y === y) return n
        changed = true
        return { ...touchNode(n, timestamp, username), position: { x, y } }
      })
      return changed ? { nodes, isDirty: shouldMarkBoardDirty(state) } : state
    }),

  updateNodeSize: (id, w, h) =>
    set((state) => {
      let changed = false
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.size.w === w && n.size.h === h) return n
        changed = true
        return { ...touchNode(n, timestamp, username), size: { w, h } }
      })
      return changed ? { nodes, isDirty: shouldMarkBoardDirty(state) } : state
    }),

  updateNodeText: (id, patch) =>
    set((state) => {
      let changed = false
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n

        const hasWidthMode = Object.prototype.hasOwnProperty.call(patch, 'widthMode')
        const hasWrapWidth = Object.prototype.hasOwnProperty.call(patch, 'wrapWidth')
        const nextWidthMode = hasWidthMode ? patch.widthMode : n.widthMode
        const nextWrapWidth = hasWrapWidth ? patch.wrapWidth : n.wrapWidth
        if (
          n.content === patch.content &&
          n.widthMode === nextWidthMode &&
          n.wrapWidth === nextWrapWidth
        ) {
          return n
        }

        changed = true
        return { ...touchNode(n, timestamp, username), ...patch, updatedAt: timestamp }
      })

      return changed ? { nodes, isDirty: shouldMarkBoardDirty(state) } : state
    }),

  updateCluster: (id, patch) =>
    set((state) => {
      let changed = false
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const candidateNodes = sanitizeClusterChildren(
        state.nodes.map((node) => {
          if (!isClusterNode(node) || node.id !== id) return node

          const next: ClusterNode = {
            ...touchNode(node, timestamp, username),
            ...patch
          }

          if (
            next.label === node.label &&
            next.brief === node.brief &&
            next.color === node.color &&
            next.children.length === node.children.length &&
            next.children.every((childId, index) => childId === node.children[index])
          ) {
            return node
          }

          changed = true
          return next
        })
      )
      const nodesChanged =
        candidateNodes.length !== state.nodes.length ||
        candidateNodes.some((node, index) => node !== state.nodes[index])

      return changed || nodesChanged
        ? { nodes: candidateNodes, isDirty: shouldMarkBoardDirty(state) }
        : state
    }),

  translateCluster: (id, dx, dy) =>
    set((state) => {
      if (dx === 0 && dy === 0) return state

      const cluster = state.nodes.find(
        (node): node is ClusterNode => isClusterNode(node) && node.id === id
      )
      if (!cluster) return state

      const childIds = new Set(cluster.children)
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      let changed = false

      const nodes = state.nodes.map((node) => {
        if (node.id !== id && !childIds.has(node.id)) return node
        changed = true
        return {
          ...touchNode(node, timestamp, username),
          position: {
            x: node.position.x + dx,
            y: node.position.y + dy
          }
        }
      })

      return changed ? { nodes, isDirty: shouldMarkBoardDirty(state) } : state
    }),

  addNodeToCluster: (clusterId, nodeId) =>
    set((state) => {
      const previousMembership = new Set(
        state.nodes
          .filter((node) => isClusterNode(node) && node.children.includes(nodeId))
          .map((node) => node.id)
      )
      const nextNodes = assignNodeToCluster(state.nodes, clusterId, nodeId)
      if (nextNodes === state.nodes) return state

      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const touchedNodes = nextNodes.map((node) => {
        if (!isClusterNode(node)) return node
        if (node.id !== clusterId && !previousMembership.has(node.id)) return node
        return touchNode(node, timestamp, username)
      })

      return { nodes: touchedNodes, isDirty: shouldMarkBoardDirty(state) }
    }),

  removeNodeFromCluster: (clusterId, nodeId) =>
    set((state) => {
      const nodes = removeNodeFromSingleCluster(state.nodes, clusterId, nodeId)
      if (nodes === state.nodes) return state

      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const touchedNodes = nodes.map((node) =>
        isClusterNode(node) && node.id === clusterId ? touchNode(node, timestamp, username) : node
      )

      return { nodes: touchedNodes, isDirty: shouldMarkBoardDirty(state) }
    }),

  createClusterFromNodes: (input) =>
    set((state) => {
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const cluster: ClusterNodeDraft = {
        id: input.id,
        kind: 'cluster',
        type: null,
        label: input.label,
        brief: input.brief,
        children: input.childIds,
        color: input.color ?? 'blue',
        position: input.position,
        size: input.size
      }

      const nodes = sanitizeClusterChildren([
        ...state.nodes,
        normalizeNodeMetadata(cluster, timestamp, username)
      ])

      return { nodes, isDirty: shouldMarkBoardDirty(state) }
    }),

  reconcileNodeClusterMembership: (nodeId) =>
    set((state) => {
      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const nodes = reconcileNodeClusterMemberships(state.nodes, [nodeId], timestamp, username)
      return nodes === state.nodes ? state : { nodes, isDirty: shouldMarkBoardDirty(state) }
    }),

  reconcileClusterMembershipsForCluster: (clusterId) =>
    set((state) => {
      const cluster = state.nodes.find(
        (node): node is ClusterNode => isClusterNode(node) && node.id === clusterId
      )
      if (!cluster) return state

      const candidateNodeIds = state.nodes
        .filter((node) => !isClusterNode(node))
        .map((node) => node.id)

      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const nodes = reconcileNodeClusterMemberships(state.nodes, candidateNodeIds, timestamp, username)
      return nodes === state.nodes ? state : { nodes, isDirty: shouldMarkBoardDirty(state) }
    }),

  fitClusterToChildren: (clusterId, padding = 48) =>
    set((state) => {
      const cluster = state.nodes.find(
        (node): node is ClusterNode => isClusterNode(node) && node.id === clusterId
      )
      if (!cluster || cluster.children.length === 0) return state

      const children = state.nodes.filter((node) => cluster.children.includes(node.id))
      if (children.length === 0) return state

      const minX = Math.min(...children.map((node) => node.position.x))
      const minY = Math.min(...children.map((node) => node.position.y))
      const maxX = Math.max(...children.map((node) => node.position.x + node.size.w))
      const maxY = Math.max(...children.map((node) => node.position.y + node.size.h))

      const nextPosition = {
        x: Math.round(minX - padding),
        y: Math.round(minY - padding)
      }
      const nextSize = {
        w: Math.round(maxX - minX + padding * 2),
        h: Math.round(maxY - minY + padding * 2)
      }

      if (
        cluster.position.x === nextPosition.x &&
        cluster.position.y === nextPosition.y &&
        cluster.size.w === nextSize.w &&
        cluster.size.h === nextSize.h
      ) {
        return state
      }

      const timestamp = new Date().toISOString()
      const username = normalizeUsername(state.activeUsername)
      const updatedNodes = state.nodes.map((node) =>
        isClusterNode(node) && node.id === clusterId
          ? {
              ...touchNode(node, timestamp, username),
              position: nextPosition,
              size: nextSize
            }
          : node
      )
      const nodes = reconcileNodeClusterMemberships(
        updatedNodes,
        updatedNodes.filter((node) => !isClusterNode(node)).map((node) => node.id),
        timestamp,
        username
      )

      return { nodes, isDirty: shouldMarkBoardDirty(state) }
    }),

  updateBoardMeta: (patch) =>
    set((state) => {
      const updates: Partial<BoardState> = {}
      if ('name' in patch && patch.name !== state.name) updates.name = patch.name
      if ('brief' in patch && patch.brief !== state.brief) updates.brief = patch.brief
      if (Object.keys(updates).length === 0) return state
      return { ...updates, isDirty: shouldMarkBoardDirty(state) }
    }),

  // Viewport changes are never dirty — they persist silently on the next save.
  updateViewport: (viewport) => set({ viewport }),

  setActiveUsername: (username) => set({ activeUsername: normalizeUsername(username) }),

  setBoardPersistence: (path, transient) =>
    set((state) => {
      const nextTransient = transient ? (true as const) : undefined
      if (state.path === path && state.transient === nextTransient) return state
      return { path, transient: nextTransient }
    }),

  clearBoard: () =>
    set((state) => {
      if (
        state.path === null &&
        state.transient === undefined &&
        state.nodes.length === 0 &&
        state.edges.length === 0 &&
        state.name === undefined &&
        state.brief === undefined &&
        state.viewport === undefined &&
        !state.isDirty
      ) {
        return state
      }

      return {
        path: null,
        transient: undefined,
        nodes: [],
        edges: [],
        name: undefined,
        brief: undefined,
        viewport: undefined,
        isDirty: false
      }
    }),

  markSaved: () => set({ isDirty: false }),

  loadBoard: (board, path) =>
    set(() => {
      const fallbackTimestamp = new Date().toISOString()
      const nodes = sanitizeClusterChildren(
        board.nodes.map((node) =>
          normalizeNodeMetadata(node, fallbackTimestamp, DEFAULT_USERNAME)
        )
      )
      return {
        version: CURRENT_BOARD_VERSION,
        path,
        transient: board.transient === true ? true : undefined,
        name: board.name,
        brief: board.brief,
        nodes,
        edges: board.edges,
        viewport: board.viewport,
        isDirty: false
      }
    })
}))
