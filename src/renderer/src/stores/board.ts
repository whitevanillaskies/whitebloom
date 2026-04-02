import { create } from 'zustand'
import type { Board, BoardNode, WidthMode } from '@renderer/shared/types'

type TextLayoutPatch = {
  content: string
  widthMode?: WidthMode
  wrapWidth?: number | null
}

type BoardState = Board & {
  addNode: (node: BoardNode) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeText: (id: string, patch: TextLayoutPatch) => void
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

  updateNodeText: (id, patch) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
    })),

  loadBoard: (board) =>
    set({ version: board.version, nodes: board.nodes, edges: board.edges })
}))
