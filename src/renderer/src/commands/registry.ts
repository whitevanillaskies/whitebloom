import type {
  WhitebloomAnyCommand,
  WhitebloomCommandModeKey,
  WhitebloomCommandProvider,
  WhitebloomCommandsByContext,
  WhitebloomRegisteredCommand
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

export function getAllCommands(): WhitebloomAnyCommand[] {
  const commands: WhitebloomAnyCommand[] = []

  for (const provider of registry.values()) {
    commands.push(...provider.commands)
  }

  return commands
}

export function getAllRegisteredCommands(): WhitebloomRegisteredCommand[] {
  const commands: WhitebloomRegisteredCommand[] = []

  for (const provider of registry.values()) {
    commands.push(
      ...provider.commands.map((command) => ({
        provider,
        command
      }))
    )
  }

  return commands
}

export function getCommandsForMajorMode(
  majorMode: WhitebloomCommandModeKey
): WhitebloomAnyCommand[] {
  return getAllCommands().filter((command) => {
    const scope = command.core.modeScope
    if (!scope) return true
    return Array.isArray(scope) ? scope.includes(majorMode) : scope === majorMode
  })
}

export function getRegisteredCommandsForMajorMode(
  majorMode: WhitebloomCommandModeKey
): WhitebloomRegisteredCommand[] {
  return getAllRegisteredCommands().filter((entry) => {
    const scope = entry.command.core.modeScope
    if (!scope) return true
    return Array.isArray(scope) ? scope.includes(majorMode) : scope === majorMode
  })
}
