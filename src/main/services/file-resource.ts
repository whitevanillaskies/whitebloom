import { shell } from 'electron'
import { resolveResource } from '../resource-uri'
import type { MainProcessContext } from '../state/main-process-context'

function toFileUriFromAbsolutePath(filePath: string): string {
  const unixPath = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(unixPath)) {
    return `file:///${encodeURI(unixPath)}`
  }

  if (unixPath.startsWith('/')) {
    return `file://${encodeURI(unixPath)}`
  }

  return filePath
}

export function openResource(resource: string, context: MainProcessContext): Promise<string> {
  const resourceValue = resource.trim()

  if (!resourceValue) return Promise.resolve('')

  if (
    resourceValue.startsWith('wloc:') ||
    resourceValue.startsWith('wbapp:') ||
    resourceValue.startsWith('file:///')
  ) {
    try {
      const absolutePath = resolveResource(resourceValue, context.getActiveWorkspaceRoot() ?? '')
      return shell.openPath(absolutePath)
    } catch {
      return Promise.resolve('')
    }
  }

  if (resourceValue.includes('://')) {
    return Promise.resolve('')
  }

  const asFileUri = toFileUriFromAbsolutePath(resourceValue)
  try {
    const absolutePath = resolveResource(asFileUri, context.getActiveWorkspaceRoot() ?? '')
    return shell.openPath(absolutePath)
  } catch {
    return shell.openPath(resourceValue)
  }
}
