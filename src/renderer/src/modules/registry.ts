import type { WhitebloomModule } from './types'
import {
  createModuleCommandProvider,
  registerCommandProvider
} from '../commands/registry'

const registry = new Map<string, WhitebloomModule>()

export function registerModule(module: WhitebloomModule): void {
  registry.set(module.id, module)

  if (module.commands) {
    registerCommandProvider(createModuleCommandProvider(module.id, module.commands))
  }
}

export function resolveModuleById(id: string | null): WhitebloomModule | undefined {
  if (id === null) return undefined
  return registry.get(id)
}

export function resolveModuleByExtension(ext: string): WhitebloomModule[] {
  const results: WhitebloomModule[] = []
  for (const module of registry.values()) {
    if (module.extensions.includes(ext)) {
      results.push(module)
    }
  }
  return results
}

export function getAllModules(): WhitebloomModule[] {
  return Array.from(registry.values())
}

/**
 * Dispatch a dropped file to the best-matching module.
 *
 * Priority:
 * 1. Specific modules (have `recognizes`) — first truthy result wins.
 * 2. Generic modules matched by file extension.
 * 3. `undefined` if nothing matches (caller should create a void-typed bud).
 */
export function dispatchModule(resource: string): WhitebloomModule | undefined {
  // Specific modules first
  for (const module of registry.values()) {
    if (module.handlesDirectories) continue
    if (module.recognizes?.(resource)) return module
  }

  // Generic modules by extension
  const dotIdx = resource.lastIndexOf('.')
  if (dotIdx !== -1) {
    const ext = resource.slice(dotIdx).toLowerCase()
    const byExt = resolveModuleByExtension(ext).filter((m) => !m.handlesDirectories)
    if (byExt.length > 0) return byExt[0]
  }

  return undefined
}

/**
 * Dispatch a dropped directory to the first module that opts in and recognizes it.
 *
 * Only modules with `handlesDirectories: true` participate.
 * `recognizes()` may return a Promise (e.g. for filesystem checks via IPC).
 * Returns `undefined` if no module claims the directory.
 */
export async function dispatchDirectory(dirPath: string): Promise<WhitebloomModule | undefined> {
  for (const module of registry.values()) {
    if (module.handlesDirectories && module.recognizes) {
      if (await module.recognizes(dirPath)) return module
    }
  }
  return undefined
}
