import { create } from 'zustand'
import {
  CURRENT_BOARD_VERSION,
  type Board,
  type BoardNode,
  type WidthMode
} from '@renderer/shared/types'
import { DEFAULT_USERNAME, normalizeUsername } from '../../../shared/app-settings'

type TextLayoutPatch = {
  content: string
  widthMode?: WidthMode
  wrapWidth?: number | null
}

type BoardNodeDraft = Omit<BoardNode, 'created' | 'createdBy' | 'updatedAt' | 'updatedBy'> &
  Partial<Pick<BoardNode, 'created' | 'createdBy' | 'updatedAt' | 'updatedBy'>>

type BoardState = Board & {
  path: string | null
  activeUsername: string
  isDirty: boolean
  addNode: (node: BoardNodeDraft) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  updateNodePosition: (id: string, x: number, y: number) => void
  updateNodeSize: (id: string, w: number, h: number) => void
  updateNodeText: (id: string, patch: TextLayoutPatch) => void
  updateBoardMeta: (patch: { name?: string; brief?: string }) => void
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

function normalizeNodeMetadata(
  node: BoardNodeDraft,
  fallbackTimestamp: string,
  fallbackUsername: string
): BoardNode {
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

function touchNode(node: BoardNode, timestamp: string, username: string): BoardNode {
  const normalized = normalizeNodeMetadata(node, timestamp, username)
  if (normalized.updatedAt === timestamp && normalized.updatedBy === username) return normalized
  return { ...normalized, updatedAt: timestamp, updatedBy: username }
}

export const useBoardStore = create<BoardState>((set) => ({
  version: CURRENT_BOARD_VERSION,
  path: null,
  transient: undefined,
  name: undefined,
  brief: undefined,
  nodes: [],
  edges: [],
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

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.from !== id && e.to !== id),
      isDirty: shouldMarkBoardDirty(state)
    })),

  deleteNodes: (ids) =>
    set((state) => {
      const idSet = new Set(ids)
      return {
        nodes: state.nodes.filter((n) => !idSet.has(n.id)),
        edges: state.edges.filter((e) => !idSet.has(e.from) && !idSet.has(e.to)),
        isDirty: shouldMarkBoardDirty(state)
      }
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

  updateBoardMeta: (patch) =>
    set((state) => {
      const updates: Partial<BoardState> = {}
      if ('name' in patch && patch.name !== state.name) updates.name = patch.name
      if ('brief' in patch && patch.brief !== state.brief) updates.brief = patch.brief
      if (Object.keys(updates).length === 0) return state
      return { ...updates, isDirty: shouldMarkBoardDirty(state) }
    }),

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
        isDirty: false
      }
    }),

  markSaved: () => set({ isDirty: false }),

  loadBoard: (board, path) =>
    set(() => {
      const fallbackTimestamp = new Date().toISOString()
      return {
        version: CURRENT_BOARD_VERSION,
        path,
        transient: board.transient === true ? true : undefined,
        name: board.name,
        brief: board.brief,
        nodes: board.nodes.map((node) =>
          normalizeNodeMetadata(node, fallbackTimestamp, DEFAULT_USERNAME)
        ),
        edges: board.edges,
        isDirty: false
      }
    })
}))
