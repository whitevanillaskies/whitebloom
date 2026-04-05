export interface MainProcessContext {
  getActiveWorkspaceRoot(): string | null
  setActiveWorkspaceRoot(workspaceRoot: string | null): void
}

export function createMainProcessContext(): MainProcessContext {
  let activeWorkspaceRoot: string | null = null

  return {
    getActiveWorkspaceRoot() {
      return activeWorkspaceRoot
    },
    setActiveWorkspaceRoot(workspaceRoot) {
      activeWorkspaceRoot = workspaceRoot
    }
  }
}
