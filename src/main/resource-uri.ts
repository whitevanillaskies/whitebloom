import { posix, resolve as resolvePath, normalize as normalizePath } from 'path'
import { fileURLToPath } from 'url'

function toUnixPath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/')
}

/**
 * Resolve a Whitebloom resource URI to an absolute filesystem path.
 *
 * Supported schemes:
 * - wloc:resource/path (resolved against workspaceRoot)
 * - file:///absolute/path
 */
export function resolveResource(uri: string, workspaceRoot: string): string {
  const trimmedUri = uri.trim()
  if (!trimmedUri) {
    throw new Error('Resource URI cannot be empty.')
  }

  if (trimmedUri.startsWith('wloc:')) {
    if (trimmedUri.startsWith('wloc://')) {
      throw new Error(`Invalid wloc URI (authority not allowed): ${trimmedUri}`)
    }

    const encodedPath = trimmedUri.slice('wloc:'.length)
    const decodedPath = decodeURIComponent(encodedPath)
    const normalizedResourcePath = posix.normalize(decodedPath.replace(/\\/g, '/'))
    const relativeResourcePath = normalizedResourcePath.replace(/^\/+/, '')

    if (!relativeResourcePath || relativeResourcePath === '.') {
      throw new Error(`Invalid wloc URI path: ${trimmedUri}`)
    }

    if (relativeResourcePath === '..' || relativeResourcePath.startsWith('../')) {
      throw new Error(`wloc URI escapes workspace root: ${trimmedUri}`)
    }

    const workspaceAbsoluteUnix = toUnixPath(resolvePath(workspaceRoot))
    const absoluteUnixPath = posix.resolve(workspaceAbsoluteUnix, relativeResourcePath)
    const workspacePrefix = workspaceAbsoluteUnix.endsWith('/')
      ? workspaceAbsoluteUnix
      : `${workspaceAbsoluteUnix}/`

    if (
      absoluteUnixPath !== workspaceAbsoluteUnix &&
      !absoluteUnixPath.startsWith(workspacePrefix)
    ) {
      throw new Error(`wloc URI escapes workspace root: ${trimmedUri}`)
    }

    return normalizePath(absoluteUnixPath)
  }

  if (trimmedUri.startsWith('file:///')) {
    return fileURLToPath(trimmedUri)
  }

  throw new Error(`Unsupported resource URI scheme: ${trimmedUri}`)
}
