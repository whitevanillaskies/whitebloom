function normalizePathForComparison(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function isBoardResource(resource: string): boolean {
  return /\.wb\.json$/i.test(resource.trim())
}

export function resolveWorkspaceBoardPath(resource: string, workspaceRoot: string | null): string | null {
  if (!workspaceRoot || !resource.startsWith('wloc:') || !isBoardResource(resource)) return null

  const relativePath = decodeURIComponent(resource.slice('wloc:'.length)).replace(/^\/+/, '')
  if (!relativePath || relativePath === '.' || relativePath === '..' || relativePath.startsWith('../')) {
    return null
  }

  const normalizedRoot = workspaceRoot.replace(/[\\/]+$/, '')
  const normalizedRelative = relativePath.replace(/\//g, '\\')
  return `${normalizedRoot}\\${normalizedRelative}`
}

export function toWorkspaceBoardResource(boardPath: string, workspaceRoot: string | null): string | null {
  if (!workspaceRoot || !isBoardResource(boardPath)) return null

  const normalizedRoot = normalizePathForComparison(workspaceRoot)
  const normalizedBoardPath = normalizePathForComparison(boardPath)
  const rootPrefix = `${normalizedRoot}/`

  if (normalizedBoardPath !== normalizedRoot && !normalizedBoardPath.startsWith(rootPrefix)) {
    return null
  }

  const relativePath = normalizedBoardPath.slice(normalizedRoot.length).replace(/^\/+/, '')
  if (!relativePath) return null

  return `wloc:${relativePath}`
}
