import type {
  WhitebloomCommandContext,
  WhitebloomCommandContextKey,
  WhitebloomCommandForContext,
  WhitebloomCommandProvider,
  WhitebloomRegisteredCommandForContext,
  WhitebloomCommandsByContext
} from './types'

const registry = new Map<string, WhitebloomCommandProvider>()

export function registerCommandProvider(provider: WhitebloomCommandProvider): void {
  registry.set(provider.id, provider)
}

export function createBuiltinCommandProvider(
  id: string,
  commands: WhitebloomCommandsByContext
): WhitebloomCommandProvider {
  return {
    id,
    source: { kind: 'builtin' },
    commands
  }
}

export function createModuleCommandProvider(
  moduleId: string,
  commands: WhitebloomCommandsByContext
): WhitebloomCommandProvider {
  return {
    id: `module:${moduleId}`,
    source: { kind: 'module', moduleId },
    commands
  }
}

export function resolveCommandProvider(id: string): WhitebloomCommandProvider | undefined {
  return registry.get(id)
}

export function getAllCommandProviders(): WhitebloomCommandProvider[] {
  return Array.from(registry.values())
}

export function getCommandProvidersForContext<TKind extends WhitebloomCommandContextKey>(
  context: TKind
): WhitebloomCommandProvider[] {
  return getAllCommandProviders().filter((provider) => provider.commands[context] !== undefined)
}

export function getCommandsForContext<TKind extends WhitebloomCommandContextKey>(
  context: TKind
): WhitebloomCommandForContext<TKind>[] {
  const commands: WhitebloomCommandForContext<TKind>[] = []

  for (const provider of registry.values()) {
    const contributed = provider.commands[context]
    if (!contributed) continue
    commands.push(...contributed)
  }

  return commands
}

export function getCommandsForRuntimeContext<TKind extends WhitebloomCommandContextKey>(
  context: WhitebloomCommandContext<TKind>
): WhitebloomCommandForContext<TKind>[] {
  return getCommandsForContext(context.kind) as unknown as WhitebloomCommandForContext<TKind>[]
}

export function getRegisteredCommandsForContext<TKind extends WhitebloomCommandContextKey>(
  context: TKind
): WhitebloomRegisteredCommandForContext<TKind>[] {
  const commands: WhitebloomRegisteredCommandForContext<TKind>[] = []

  for (const provider of registry.values()) {
    const contributed = provider.commands[context]
    if (!contributed) continue

    commands.push(
      ...contributed.map((command) => ({
        provider,
        command
      }))
    )
  }

  return commands
}

export function getRegisteredCommandsForRuntimeContext<TKind extends WhitebloomCommandContextKey>(
  context: WhitebloomCommandContext<TKind>
): WhitebloomRegisteredCommandForContext<TKind>[] {
  return getRegisteredCommandsForContext(context.kind) as unknown as WhitebloomRegisteredCommandForContext<TKind>[]
}
