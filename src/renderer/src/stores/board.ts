import { create } from 'zustand'
import type { Board, BoardNode, WidthMode } from '@renderer/shared/types'

type TextLayoutPatch = {
  content: string
  widthMode?: WidthMode
  wrapWidth?: number | null
}

type BoardState = Board & {
  isDirty: boolean
  addNode: (node: BoardNode) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeSize: (id: string, w: number, h: number) => void
  updateNodeText: (id: string, patch: TextLayoutPatch) => void
  clearBoard: () => void
  markSaved: () => void
  loadBoard: (board: Board) => void
}

export const useBoardStore = create<BoardState>((set) => ({
  version: 1,
  nodes: [],
  edges: [],
  isDirty: false,

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node], isDirty: true })),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.from !== id && e.to !== id),
      isDirty: true
    })),

  deleteNodes: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        nodes: state.nodes.filter((n) => !idSet.has(n.id)),
        edges: state.edges.filter((e) => !idSet.has(e.from) && !idSet.has(e.to)),
        isDirty: true
      }
    }),

  updateNodePosition: (id, x, y) =>
    set((state) => {
      let changed = false
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.position.x === x && n.position.y === y) return n
        changed = true
        return { ...n, position: { x, y } }
      })
      return changed ? { nodes, isDirty: true } : state
    }),

  updateNodeSize: (id, w, h) =>
    set((state) => {
      let changed = false
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.size.w === w && n.size.h === h) return n
        changed = true
        return { ...n, size: { w, h } }
      })
      return changed ? { nodes, isDirty: true } : state
    }),

  updateNodeText: (id, patch) =>
    set((state) => {
      let changed = false
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
        return { ...n, ...patch }
      })

      return changed ? { nodes, isDirty: true } : state
    }),

  clearBoard: () =>
    set((state) => {
      if (state.nodes.length === 0 && state.edges.length === 0 && !state.isDirty) return state
      return { nodes: [], edges: [], isDirty: false }
    }),

  markSaved: () => set({ isDirty: false }),

  loadBoard: (board) =>
    set({ version: board.version, nodes: board.nodes, edges: board.edges, isDirty: false })
}))
