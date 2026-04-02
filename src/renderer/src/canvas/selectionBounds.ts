import type { Node as RFNode } from '@xyflow/react'

export type BoundingBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Computes the flow-space bounding box of the given nodes.
 * Returns null when the array is empty.
 * Pure function — no DOM access, no React hooks.
 */
export function getSelectionBoundingBox(nodes: RFNode[]): BoundingBox | null {
  if (nodes.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const x = node.position.x
    const y = node.position.y
    const size = node.data.size as { w: number; h: number } | undefined
    const w = size?.w ?? 0
    const h = size?.h ?? 0

    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + w > maxX) maxX = x + w
    if (y + h > maxY) maxY = y + h
  }

  return { minX, minY, maxX, maxY }
}
