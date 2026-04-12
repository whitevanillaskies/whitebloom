import { create } from 'zustand'
import type { WhitebloomCommandExecutionEnvelope, WhitebloomCommandModeKey } from '../commands'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HistoryEntry = {
  /** Stable id for this history entry. */
  id: string
  /** Shared group id when multiple command envelopes belong to one logical op. */
  groupId?: string
  /** The mode this entry belongs to. Undo/redo is scoped per mode. */
  modeKey: WhitebloomCommandModeKey
  /** One or more command envelopes captured at execution time. */
  envelopes: WhitebloomCommandExecutionEnvelope[]
  /** Reverses the effect of all envelopes in this entry. */
  undoFn: () => void | Promise<void>
  /** Re-applies the effect. Bound over the same args captured at execution time. */
  redoFn: () => void | Promise<void>
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

const MAX_DEPTH = 100

type ModeStack = {
  undo: HistoryEntry[]
  redo: HistoryEntry[]
}

type HistoryState = {
  stacks: Partial<Record<WhitebloomCommandModeKey, ModeStack>>
  /** The groupId currently being accumulated (if any). */
  openGroupId: string | undefined
}

type HistoryActions = {
  push: (entry: HistoryEntry) => void
  undo: (modeKey: WhitebloomCommandModeKey) => HistoryEntry | undefined
  redo: (modeKey: WhitebloomCommandModeKey) => HistoryEntry | undefined
  clear: (modeKey: WhitebloomCommandModeKey) => void
  peek: (modeKey: WhitebloomCommandModeKey) => { undoTop: HistoryEntry | undefined; redoTop: HistoryEntry | undefined }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureStack(
  stacks: Partial<Record<WhitebloomCommandModeKey, ModeStack>>,
  modeKey: WhitebloomCommandModeKey
): ModeStack {
  if (!stacks[modeKey]) {
    stacks[modeKey] = { undo: [], redo: [] }
  }

  return stacks[modeKey]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHistoryStore = create<HistoryState & HistoryActions>((set, get) => ({
  stacks: {},
  openGroupId: undefined,

  push(entry) {
    set((state) => {
      const stacks = { ...state.stacks }
      const stack = { ...ensureStack(stacks, entry.modeKey) }
      stack.undo = [...stack.undo]
      stack.redo = [...stack.redo]

      const openGroupId = state.openGroupId

      // If the entry belongs to the currently open group, coalesce into the
      // top undo entry rather than pushing a new one.
      if (
        entry.groupId !== undefined &&
        entry.groupId === openGroupId &&
        stack.undo.length > 0
      ) {
        const top = stack.undo[stack.undo.length - 1]
        if (top.groupId === entry.groupId) {
          stack.undo[stack.undo.length - 1] = {
            ...top,
            envelopes: [...top.envelopes, ...entry.envelopes]
          }
          stacks[entry.modeKey] = stack
          return { stacks }
        }
      }

      // New entry — clear redo and push.
      stack.redo = []
      stack.undo.push(entry)
      if (stack.undo.length > MAX_DEPTH) {
        stack.undo = stack.undo.slice(stack.undo.length - MAX_DEPTH)
      }

      stacks[entry.modeKey] = stack

      return {
        stacks,
        openGroupId: entry.groupId ?? undefined
      }
    })
  },

  undo(modeKey) {
    const { stacks } = get()
    const stack = stacks[modeKey]
    if (!stack || stack.undo.length === 0) return undefined

    const entry = stack.undo[stack.undo.length - 1]

    set((state) => {
      const stacks = { ...state.stacks }
      const s = { ...ensureStack(stacks, modeKey) }
      s.undo = s.undo.slice(0, -1)
      s.redo = [...s.redo, entry]
      stacks[modeKey] = s
      return { stacks, openGroupId: undefined }
    })

    return entry
  },

  redo(modeKey) {
    const { stacks } = get()
    const stack = stacks[modeKey]
    if (!stack || stack.redo.length === 0) return undefined

    const entry = stack.redo[stack.redo.length - 1]

    set((state) => {
      const stacks = { ...state.stacks }
      const s = { ...ensureStack(stacks, modeKey) }
      s.redo = s.redo.slice(0, -1)
      s.undo = [...s.undo, entry]
      stacks[modeKey] = s
      return { stacks, openGroupId: undefined }
    })

    return entry
  },

  clear(modeKey) {
    set((state) => {
      const stacks = { ...state.stacks }
      stacks[modeKey] = { undo: [], redo: [] }
      return { stacks, openGroupId: undefined }
    })
  },

  peek(modeKey) {
    const stack = get().stacks[modeKey]
    return {
      undoTop: stack?.undo.at(-1),
      redoTop: stack?.redo.at(-1)
    }
  }
}))
