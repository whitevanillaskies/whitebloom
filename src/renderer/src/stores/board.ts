import { create } from 'zustand'
import type { Board, BoardNode, BoardEdge } from '@renderer/shared/types'

type BoardState = Board & {
  addNode: (node: BoardNode) => void
  updateNodePosition: (id: string, x: number, y: number) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  version: 1,
  nodes: [],
  edges: [],

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  updateNodePosition: (id, x, y) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n))
    }))
}))
