import { create } from 'zustand'
import type { Workspace, WorkspaceConfig } from '@renderer/shared/types'

type WorkspaceState = {
  root: string | null
  config: WorkspaceConfig | null
  boards: string[]
  loadWorkspace: (workspace: Workspace) => void
  setBoards: (boards: string[]) => void
  addBoard: (boardPath: string) => void
  removeBoard: (boardPath: string) => void
  clearWorkspace: () => void
}

function sortBoardPaths(paths: string[]): string[] {
  return [...paths].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  )
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  root: null,
  config: null,
  boards: [],

  loadWorkspace: (workspace) =>
    set({
      root: workspace.rootPath,
      config: workspace.config,
      boards: sortBoardPaths(workspace.boards)
    }),

  setBoards: (boards) => set({ boards: sortBoardPaths(boards) }),

  addBoard: (boardPath) =>
    set((state) => {
      if (state.boards.includes(boardPath)) return state
      return { boards: sortBoardPaths([...state.boards, boardPath]) }
    }),

  removeBoard: (boardPath) =>
    set((state) => {
      if (!state.boards.includes(boardPath)) return state
      return { boards: state.boards.filter((path) => path !== boardPath) }
    }),

  clearWorkspace: () =>
    set((state) => {
      if (state.root === null && state.config === null && state.boards.length === 0) return state
      return { root: null, config: null, boards: [] }
    })
}))
