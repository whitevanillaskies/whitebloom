import type { WhitebloomModule } from './types'

const registry = new Map<string, WhitebloomModule>()

export function registerModule(module: WhitebloomModule): void {
  registry.set(module.id, module)
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
 * Dispatch a dropped resource to the best-matching module.
 *
 * Priority:
 * 1. Specific modules (have `recognizes`) — first truthy result wins.
 * 2. Generic modules matched by file extension.
 * 3. `undefined` if nothing matches (caller should create a void-typed bud).
 */
export function dispatchModule(resource: string): WhitebloomModule | undefined {
  // Specific modules first
  for (const module of registry.values()) {
    if (module.recognizes?.(resource)) return module
  }

  // Generic modules by extension
  const dotIdx = resource.lastIndexOf('.')
  if (dotIdx !== -1) {
    const ext = resource.slice(dotIdx).toLowerCase()
    const byExt = resolveModuleByExtension(ext)
    if (byExt.length > 0) return byExt[0]
  }

  return undefined
}
