import type { BoardEdge, BoardNode, Position, Size } from '@renderer/shared/types'

export const CANVAS_CLIPBOARD_PREFIX = 'whitebloom:canvas-selection:v1\n'
export const CANVAS_CLIPBOARD_KIND = 'whitebloom.canvas-selection'

export type CanvasClipboardPayload = {
  kind: typeof CANVAS_CLIPBOARD_KIND
  version: 1
  nodes: BoardNode[]
  edges: BoardEdge[]
  anchor: Position
}

export type ClipboardBudPlacement = {
  resource: string
  moduleType: string | null
  size: Size
  label?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function serializeCanvasClipboardPayload(payload: CanvasClipboardPayload): string {
  return `${CANVAS_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`
}

export function parseCanvasClipboardPayload(text: string): CanvasClipboardPayload | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const json = text.startsWith(CANVAS_CLIPBOARD_PREFIX)
    ? text.slice(CANVAS_CLIPBOARD_PREFIX.length)
    : trimmed.startsWith('{')
      ? trimmed
      : ''
  if (!json) return null

  try {
    const parsed: unknown = JSON.parse(json)
    if (!isPlainObject(parsed)) return null
    if (parsed.kind !== CANVAS_CLIPBOARD_KIND || parsed.version !== 1) return null
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return null
    if (!Array.isArray(parsed.edges)) return null
    if (!isPlainObject(parsed.anchor)) return null
    const { x, y } = parsed.anchor
    if (typeof x !== 'number' || typeof y !== 'number') return null

    return {
      kind: CANVAS_CLIPBOARD_KIND,
      version: 1,
      nodes: parsed.nodes as BoardNode[],
      edges: parsed.edges as BoardEdge[],
      anchor: { x, y }
    }
  } catch {
    return null
  }
}
