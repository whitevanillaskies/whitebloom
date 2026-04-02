import { create } from 'zustand'
import type { Board, BoardNode, BoardEdge } from '@renderer/shared/types'

type BoardState = Board & {
  addNode: (node: BoardNode) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeContent: (id: string, content: string) => void
  loadBoard: (board: Board) => void
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
    })),

  updateNodeContent: (id, content) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, content } : n))
    })),

  loadBoard: (board) =>
    set({ version: board.version, nodes: board.nodes, edges: board.edges })
}))
