import { resolve as resolvePath, normalize as normalizePath, posix } from 'path'
import { fileURLToPath } from 'url'
import { getAppDataRoot } from './services/app-storage'

function toUnixPath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/')
}

function requireRootPath(rootPath: string, scheme: string, uri: string): string {
  const trimmedRoot = rootPath.trim()

  if (!trimmedRoot) {
    throw new Error(`${scheme} URI requires an active root path: ${uri}`)
  }

  return trimmedRoot
}

function resolveManagedUri(
  uri: string,
  scheme: 'wloc' | 'wbapp',
  rootPath: string,
  allowedTopLevelSegments?: string[]
): string {
  if (uri.startsWith(`${scheme}://`)) {
    throw new Error(`Invalid ${scheme} URI (authority not allowed): ${uri}`)
  }

  const encodedPath = uri.slice(`${scheme}:`.length)
  const decodedPath = decodeURIComponent(encodedPath)
  const normalizedResourcePath = posix.normalize(decodedPath.replace(/\\/g, '/'))
  const relativeResourcePath = normalizedResourcePath.replace(/^\/+/, '')

  if (!relativeResourcePath || relativeResourcePath === '.') {
    throw new Error(`Invalid ${scheme} URI path: ${uri}`)
  }

  if (relativeResourcePath === '..' || relativeResourcePath.startsWith('../')) {
    throw new Error(`${scheme} URI escapes root: ${uri}`)
  }

  if (allowedTopLevelSegments) {
    const topLevelSegment = relativeResourcePath.split('/')[0]
    if (!allowedTopLevelSegments.includes(topLevelSegment)) {
      throw new Error(`Unsupported ${scheme} URI path: ${uri}`)
    }
  }

  const absoluteRootUnix = toUnixPath(resolvePath(rootPath))
  const absoluteUnixPath = toUnixPath(resolvePath(rootPath, relativeResourcePath))
  const rootPrefix = absoluteRootUnix.endsWith('/') ? absoluteRootUnix : `${absoluteRootUnix}/`

  if (absoluteUnixPath !== absoluteRootUnix && !absoluteUnixPath.startsWith(rootPrefix)) {
    throw new Error(`${scheme} URI escapes root: ${uri}`)
  }

  return normalizePath(resolvePath(rootPath, relativeResourcePath))
}

/**
 * Resolve a Whitebloom resource URI to an absolute filesystem path.
 *
 * Supported schemes:
 * - wloc:resource/path (resolved against workspaceRoot)
 * - wbapp:resource/path (resolved against app.getPath('userData'))
 * - file:///absolute/path
 */
export function resolveResource(uri: string, workspaceRoot: string): string {
  const trimmedUri = uri.trim()
  if (!trimmedUri) {
    throw new Error('Resource URI cannot be empty.')
  }

  if (trimmedUri.startsWith('wloc:')) {
    return resolveManagedUri(trimmedUri, 'wloc', requireRootPath(workspaceRoot, 'wloc', trimmedUri))
  }

  if (trimmedUri.startsWith('wbapp:')) {
    return resolveManagedUri(trimmedUri, 'wbapp', getAppDataRoot(), ['boards', 'res', 'trash'])
  }

  if (trimmedUri.startsWith('file:///')) {
    return fileURLToPath(trimmedUri)
  }

  throw new Error(`Unsupported resource URI scheme: ${trimmedUri}`)
}
