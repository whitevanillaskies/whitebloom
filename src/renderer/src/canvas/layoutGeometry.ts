export type LayoutPoint = {
  x: number
  y: number
}

export type LayoutSize = {
  w: number
  h: number
}

export type LayoutNode = {
  id: string
  position: LayoutPoint
  size: LayoutSize
}

export type LayoutEdge = {
  from: string
  to: string
}

export type LayoutBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export type LayoutBoundsMetrics = LayoutBounds & {
  centerX: number
  centerY: number
  width: number
  height: number
}

export type LayoutAxis = 'x' | 'y'
export type LayoutExtreme = 'start' | 'center' | 'end'
export type AlignmentKind =
  | 'left'
  | 'horizontal-center'
  | 'right'
  | 'top'
  | 'vertical-center'
  | 'bottom'

export type SmartGuide = {
  axis: LayoutAxis
  source: LayoutExtreme
  target: LayoutExtreme
  targetNodeId: string
  value: number
  from: number
  to: number
}

export type SmartGuideSnap = {
  delta: LayoutPoint
  guides: SmartGuide[]
}

export type GridLayoutOptions = {
  columns?: number
  gapX?: number
  gapY?: number
}

export type SmartStraightenOptions = {
  threshold?: number
  nodeIds?: string[]
}

export type SmartMoveConstraint = {
  axis: 'horizontal' | 'vertical' | 'line'
  delta: LayoutPoint
}

const DEFAULT_SNAP_THRESHOLD = 6
const DEFAULT_GRID_STEP = 25
const DEFAULT_STRAIGHTEN_THRESHOLD = 12

type AxisMetric = {
  extreme: LayoutExtreme
  value: number
}

type DisjointSet = {
  find: (id: string) => string
  union: (left: string, right: string) => void
  groups: () => string[][]
}

export function getLayoutBounds(node: LayoutNode): LayoutBoundsMetrics {
  return normalizeBounds({
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + node.size.w,
    bottom: node.position.y + node.size.h
  })
}

export function normalizeBounds(bounds: LayoutBounds): LayoutBoundsMetrics {
  const left = Math.min(bounds.left, bounds.right)
  const right = Math.max(bounds.left, bounds.right)
  const top = Math.min(bounds.top, bounds.bottom)
  const bottom = Math.max(bounds.top, bounds.bottom)
  const width = right - left
  const height = bottom - top

  return {
    left,
    top,
    right,
    bottom,
    centerX: left + width / 2,
    centerY: top + height / 2,
    width,
    height
  }
}

export function translateBounds(
  bounds: LayoutBoundsMetrics,
  delta: LayoutPoint
): LayoutBoundsMetrics {
  return normalizeBounds({
    left: bounds.left + delta.x,
    top: bounds.top + delta.y,
    right: bounds.right + delta.x,
    bottom: bounds.bottom + delta.y
  })
}

export function getSelectionBounds(nodes: LayoutNode[]): LayoutBoundsMetrics | null {
  if (nodes.length === 0) return null

  return normalizeBounds({
    left: Math.min(...nodes.map((node) => node.position.x)),
    top: Math.min(...nodes.map((node) => node.position.y)),
    right: Math.max(...nodes.map((node) => node.position.x + node.size.w)),
    bottom: Math.max(...nodes.map((node) => node.position.y + node.size.h))
  })
}

export function computeSmartGuideSnap(input: {
  movingNodes: LayoutNode[]
  stationaryNodes: LayoutNode[]
  proposedDelta: LayoutPoint
  threshold?: number
}): SmartGuideSnap {
  const movingSelectionBounds = getSelectionBounds(input.movingNodes)
  if (!movingSelectionBounds) return { delta: input.proposedDelta, guides: [] }

  const threshold = input.threshold ?? DEFAULT_SNAP_THRESHOLD
  const movedBounds = translateBounds(movingSelectionBounds, input.proposedDelta)
  const xMatch = findBestAxisMatch('x', movedBounds, input.stationaryNodes, threshold)
  const yMatch = findBestAxisMatch('y', movedBounds, input.stationaryNodes, threshold)

  return {
    delta: {
      x: input.proposedDelta.x + (xMatch?.offset ?? 0),
      y: input.proposedDelta.y + (yMatch?.offset ?? 0)
    },
    guides: [xMatch?.guide, yMatch?.guide].filter((guide): guide is SmartGuide => Boolean(guide))
  }
}

export function alignNodes(
  nodes: LayoutNode[],
  alignment: AlignmentKind
): Map<string, LayoutPoint> {
  const selectionBounds = getSelectionBounds(nodes)
  const positions = new Map<string, LayoutPoint>()
  if (!selectionBounds) return positions

  for (const node of nodes) {
    const bounds = getLayoutBounds(node)
    let position = node.position

    if (alignment === 'left') {
      position = { ...position, x: selectionBounds.left }
    } else if (alignment === 'horizontal-center') {
      position = { ...position, x: selectionBounds.centerX - bounds.width / 2 }
    } else if (alignment === 'right') {
      position = { ...position, x: selectionBounds.right - bounds.width }
    } else if (alignment === 'top') {
      position = { ...position, y: selectionBounds.top }
    } else if (alignment === 'vertical-center') {
      position = { ...position, y: selectionBounds.centerY - bounds.height / 2 }
    } else if (alignment === 'bottom') {
      position = { ...position, y: selectionBounds.bottom - bounds.height }
    }

    positions.set(node.id, roundPoint(position))
  }

  return positions
}

export function distributeNodes(nodes: LayoutNode[], axis: LayoutAxis): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>()
  if (nodes.length < 3) {
    for (const node of nodes) positions.set(node.id, node.position)
    return positions
  }

  const sorted = [...nodes].sort((left, right) => {
    const leftBounds = getLayoutBounds(left)
    const rightBounds = getLayoutBounds(right)
    return axis === 'x'
      ? leftBounds.centerX - rightBounds.centerX
      : leftBounds.centerY - rightBounds.centerY
  })

  const firstBounds = getLayoutBounds(sorted[0])
  const lastBounds = getLayoutBounds(sorted[sorted.length - 1])
  const start = axis === 'x' ? firstBounds.centerX : firstBounds.centerY
  const end = axis === 'x' ? lastBounds.centerX : lastBounds.centerY
  const step = (end - start) / (sorted.length - 1)

  sorted.forEach((node, index) => {
    const bounds = getLayoutBounds(node)
    const targetCenter = start + step * index
    const next =
      axis === 'x'
        ? { x: targetCenter - bounds.width / 2, y: node.position.y }
        : { x: node.position.x, y: targetCenter - bounds.height / 2 }
    positions.set(node.id, roundPoint(next))
  })

  return positions
}

export function gridifyNodes(
  nodes: LayoutNode[],
  step = DEFAULT_GRID_STEP
): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>()
  const normalizedStep = Math.max(1, step)

  for (const node of nodes) {
    positions.set(node.id, {
      x: Math.round(node.position.x / normalizedStep) * normalizedStep,
      y: Math.round(node.position.y / normalizedStep) * normalizedStep
    })
  }

  return positions
}

export function layoutNodesInGrid(
  nodes: LayoutNode[],
  options: GridLayoutOptions = {}
): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>()
  if (nodes.length === 0) return positions

  const ordered = [...nodes].sort((left, right) => {
    const leftBounds = getLayoutBounds(left)
    const rightBounds = getLayoutBounds(right)
    return leftBounds.top === rightBounds.top
      ? leftBounds.left - rightBounds.left
      : leftBounds.top - rightBounds.top
  })
  const selectionBounds = getSelectionBounds(ordered)
  if (!selectionBounds) return positions

  const columns = Math.max(1, options.columns ?? Math.ceil(Math.sqrt(ordered.length)))
  const maxWidth = Math.max(...ordered.map((node) => node.size.w))
  const maxHeight = Math.max(...ordered.map((node) => node.size.h))
  const gapX = options.gapX ?? 32
  const gapY = options.gapY ?? 32

  ordered.forEach((node, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    positions.set(node.id, {
      x: Math.round(selectionBounds.left + column * (maxWidth + gapX)),
      y: Math.round(selectionBounds.top + row * (maxHeight + gapY))
    })
  })

  return positions
}

export function smartStraightenNodes(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: SmartStraightenOptions = {}
): Map<string, LayoutPoint> {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const))
  const scopedIds = options.nodeIds
    ? new Set(options.nodeIds)
    : new Set(nodes.map((node) => node.id))
  const threshold = options.threshold ?? DEFAULT_STRAIGHTEN_THRESHOLD
  const horizontalGroups = createDisjointSet([...scopedIds])
  const verticalGroups = createDisjointSet([...scopedIds])

  for (const edge of edges) {
    if (!scopedIds.has(edge.from) || !scopedIds.has(edge.to)) continue
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (!from || !to) continue

    const fromBounds = getLayoutBounds(from)
    const toBounds = getLayoutBounds(to)
    const dx = Math.abs(fromBounds.centerX - toBounds.centerX)
    const dy = Math.abs(fromBounds.centerY - toBounds.centerY)

    if (dy <= threshold && dx > 0) horizontalGroups.union(edge.from, edge.to)
    if (dx <= threshold && dy > 0) verticalGroups.union(edge.from, edge.to)
  }

  const targetCenterYById = groupTargetCenters(horizontalGroups, nodeById, 'y')
  const targetCenterXById = groupTargetCenters(verticalGroups, nodeById, 'x')
  const positions = new Map<string, LayoutPoint>()

  for (const node of nodes) {
    if (!scopedIds.has(node.id)) continue

    const bounds = getLayoutBounds(node)
    const targetCenterX = targetCenterXById.get(node.id) ?? bounds.centerX
    const targetCenterY = targetCenterYById.get(node.id) ?? bounds.centerY
    const next = {
      x: targetCenterX - bounds.width / 2,
      y: targetCenterY - bounds.height / 2
    }

    positions.set(node.id, roundPoint(next))
  }

  return positions
}

export function constrainDeltaAlongStraightConnections(input: {
  nodeIds: string[]
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  proposedDelta: LayoutPoint
  threshold?: number
}): SmartMoveConstraint | null {
  const selectedIds = new Set(input.nodeIds)
  const nodeById = new Map(input.nodes.map((node) => [node.id, node] as const))
  const threshold = input.threshold ?? DEFAULT_STRAIGHTEN_THRESHOLD
  let horizontalVotes = 0
  let verticalVotes = 0

  for (const edge of input.edges) {
    const touchesSelection = selectedIds.has(edge.from) !== selectedIds.has(edge.to)
    if (!touchesSelection) continue

    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (!from || !to) continue

    const fromBounds = getLayoutBounds(from)
    const toBounds = getLayoutBounds(to)
    const dx = Math.abs(fromBounds.centerX - toBounds.centerX)
    const dy = Math.abs(fromBounds.centerY - toBounds.centerY)

    if (dy <= threshold && dx > 0) horizontalVotes += 1
    if (dx <= threshold && dy > 0) verticalVotes += 1
  }

  if (horizontalVotes === 0 && verticalVotes === 0) return null

  if (horizontalVotes >= verticalVotes) {
    return {
      axis: 'horizontal',
      delta: { x: input.proposedDelta.x, y: 0 }
    }
  }

  return {
    axis: 'vertical',
    delta: { x: 0, y: input.proposedDelta.y }
  }
}

function findBestAxisMatch(
  axis: LayoutAxis,
  movingBounds: LayoutBoundsMetrics,
  stationaryNodes: LayoutNode[],
  threshold: number
): { offset: number; guide: SmartGuide } | null {
  const movingMetrics = getAxisMetrics(axis, movingBounds)
  let best: { distance: number; offset: number; guide: SmartGuide } | null = null

  for (const targetNode of stationaryNodes) {
    const targetBounds = getLayoutBounds(targetNode)
    const targetMetrics = getAxisMetrics(axis, targetBounds)

    for (const movingMetric of movingMetrics) {
      for (const targetMetric of targetMetrics) {
        const offset = targetMetric.value - movingMetric.value
        const distance = Math.abs(offset)
        if (distance > threshold) continue
        if (best && distance >= best.distance) continue

        best = {
          distance,
          offset,
          guide: createSmartGuide(
            axis,
            movingMetric,
            targetMetric,
            movingBounds,
            targetBounds,
            targetNode.id
          )
        }
      }
    }
  }

  return best
}

function getAxisMetrics(axis: LayoutAxis, bounds: LayoutBoundsMetrics): AxisMetric[] {
  return axis === 'x'
    ? [
        { extreme: 'start', value: bounds.left },
        { extreme: 'center', value: bounds.centerX },
        { extreme: 'end', value: bounds.right }
      ]
    : [
        { extreme: 'start', value: bounds.top },
        { extreme: 'center', value: bounds.centerY },
        { extreme: 'end', value: bounds.bottom }
      ]
}

function createSmartGuide(
  axis: LayoutAxis,
  source: AxisMetric,
  target: AxisMetric,
  movingBounds: LayoutBoundsMetrics,
  targetBounds: LayoutBoundsMetrics,
  targetNodeId: string
): SmartGuide {
  return axis === 'x'
    ? {
        axis,
        source: source.extreme,
        target: target.extreme,
        targetNodeId,
        value: target.value,
        from: Math.min(movingBounds.top, targetBounds.top),
        to: Math.max(movingBounds.bottom, targetBounds.bottom)
      }
    : {
        axis,
        source: source.extreme,
        target: target.extreme,
        targetNodeId,
        value: target.value,
        from: Math.min(movingBounds.left, targetBounds.left),
        to: Math.max(movingBounds.right, targetBounds.right)
      }
}

function createDisjointSet(ids: string[]): DisjointSet {
  const parent = new Map(ids.map((id) => [id, id] as const))

  const find = (id: string): string => {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }

  const union = (left: string, right: string) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot)
  }

  const groups = () => {
    const byRoot = new Map<string, string[]>()
    for (const id of parent.keys()) {
      const root = find(id)
      byRoot.set(root, [...(byRoot.get(root) ?? []), id])
    }
    return [...byRoot.values()]
  }

  return { find, union, groups }
}

function groupTargetCenters(
  disjointSet: DisjointSet,
  nodeById: Map<string, LayoutNode>,
  axis: LayoutAxis
): Map<string, number> {
  const result = new Map<string, number>()

  for (const group of disjointSet.groups()) {
    if (group.length < 2) continue

    const centers = group
      .map((id) => nodeById.get(id))
      .filter((node): node is LayoutNode => Boolean(node))
      .map((node) => {
        const bounds = getLayoutBounds(node)
        return axis === 'x' ? bounds.centerX : bounds.centerY
      })

    if (centers.length < 2) continue
    const targetCenter = median(centers)
    for (const id of group) result.set(id, targetCenter)
  }

  return result
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function roundPoint(point: LayoutPoint): LayoutPoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  }
}
