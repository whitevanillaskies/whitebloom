export type Position = { x: number; y: number }
export type Size = { w: number; h: number }

export type BoardNode = {
  id: string
  kind: 'bud' | 'leaf'
  type: string
  position: Position
  size: Size
  label?: string
  content?: string
  resource?: string
}

export type BoardEdge = {
  id: string
  from: string
  to: string
  label?: string
}

export type Board = {
  version: number
  nodes: BoardNode[]
  edges: BoardEdge[]
}
