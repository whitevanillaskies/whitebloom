import { create } from 'zustand'
import {
  CURRENT_BOARD_VERSION,
  type Board,
  type BoardNode,
  type WidthMode
} from '@renderer/shared/types'

type TextLayoutPatch = {
  content: string
  widthMode?: WidthMode
  wrapWidth?: number | null
}

type BoardNodeDraft = Omit<BoardNode, 'created' | 'updatedAt'> &
  Partial<Pick<BoardNode, 'created' | 'updatedAt'>>

type BoardState = Board & {
  isDirty: boolean
  addNode: (node: BoardNodeDraft) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeSize: (id: string, w: number, h: number) => void
  updateNodeText: (id: string, patch: TextLayoutPatch) => void
  updateBoardMeta: (patch: { name?: string; brief?: string }) => void
  clearBoard: () => void
  markSaved: () => void
  loadBoard: (board: Board) => void
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function normalizeNodeTimestamps(node: BoardNodeDraft, fallbackTimestamp: string): BoardNode {
  const created = isValidIsoTimestamp(node.created)
    ? node.created
    : isValidIsoTimestamp(node.updatedAt)
      ? node.updatedAt
      : fallbackTimestamp
  const updatedAt = isValidIsoTimestamp(node.updatedAt) ? node.updatedAt : created

  return { ...node, created, updatedAt }
}

function touchNode(node: BoardNode, timestamp: string): BoardNode {
  const normalized = normalizeNodeTimestamps(node, timestamp)
  if (normalized.updatedAt === timestamp) return normalized
  return { ...normalized, updatedAt: timestamp }
}

export const useBoardStore = create<BoardState>((set) => ({
  version: CURRENT_BOARD_VERSION,
  name: undefined,
  brief: undefined,
  nodes: [],
  edges: [],
  isDirty: false,

  addNode: (node) =>
    set((state) => {
      const timestamp = new Date().toISOString()
      return {
        nodes: [...state.nodes, normalizeNodeTimestamps(node, timestamp)],
        isDirty: true
      }
    }),

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
      const timestamp = new Date().toISOString()
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.position.x === x && n.position.y === y) return n
        changed = true
        return { ...touchNode(n, timestamp), position: { x, y } }
      })
      return changed ? { nodes, isDirty: true } : state
    }),

  updateNodeSize: (id, w, h) =>
    set((state) => {
      let changed = false
      const timestamp = new Date().toISOString()
      const nodes = state.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.size.w === w && n.size.h === h) return n
        changed = true
        return { ...touchNode(n, timestamp), size: { w, h } }
      })
      return changed ? { nodes, isDirty: true } : state
    }),

  updateNodeText: (id, patch) =>
    set((state) => {
      let changed = false
      const timestamp = new Date().toISOString()
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
        return { ...touchNode(n, timestamp), ...patch, updatedAt: timestamp }
      })

      return changed ? { nodes, isDirty: true } : state
    }),

  updateBoardMeta: (patch) =>
    set((state) => {
      const updates: Partial<BoardState> = {}
      if ('name' in patch && patch.name !== state.name) updates.name = patch.name
      if ('brief' in patch && patch.brief !== state.brief) updates.brief = patch.brief
      if (Object.keys(updates).length === 0) return state
      return { ...updates, isDirty: true }
    }),

  clearBoard: () =>
    set((state) => {
      if (state.nodes.length === 0 && state.edges.length === 0 && !state.isDirty) return state
      return { nodes: [], edges: [], name: undefined, brief: undefined, isDirty: false }
    }),

  markSaved: () => set({ isDirty: false }),

  loadBoard: (board) =>
    set(() => {
      const fallbackTimestamp = new Date().toISOString()
      return {
        version: CURRENT_BOARD_VERSION,
        name: board.name,
        brief: board.brief,
        nodes: board.nodes.map((node) => normalizeNodeTimestamps(node, fallbackTimestamp)),
        edges: board.edges,
        isDirty: false
      }
    })
}))
