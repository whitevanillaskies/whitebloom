import { getRegisteredCommandsForRuntimeContext } from './registry'
import type {
  WhitebloomCommandArgsSchema,
  WhitebloomCommandContext,
  WhitebloomCommandContextKey,
  WhitebloomCommandExecutionEnvelope,
  WhitebloomCommandExecutionEvent,
  WhitebloomCommandExecutionListener,
  WhitebloomCommandExecutionOptions,
  WhitebloomCommandExecutionResult,
  WhitebloomCommandInteractionController,
  WhitebloomRegisteredCommandForContext
} from './types'

type InFlightExecution<TKind extends WhitebloomCommandContextKey> = {
  execution: WhitebloomCommandExecutionEnvelope<TKind>
  startedAtMs: number
}

const executionListeners = new Set<WhitebloomCommandExecutionListener>()
const NOOP_INTERACTION_CONTROLLER: WhitebloomCommandInteractionController = {
  signal: new AbortController().signal,
  setBusyState: () => {}
}

export function isRegisteredCommandAvailable<TKind extends WhitebloomCommandContextKey>(
  entry: WhitebloomRegisteredCommandForContext<TKind>,
  context: WhitebloomCommandContext<TKind>
): boolean {
  return entry.command.core.when?.(context) ?? true
}

export function createCommandExecutionId(): string {
  return crypto.randomUUID()
}

export function createCommandExecutionGroupId(): string {
  return crypto.randomUUID()
}

export function subscribeToCommandExecutions(
  listener: WhitebloomCommandExecutionListener
): () => void {
  executionListeners.add(listener)
  return () => {
    executionListeners.delete(listener)
  }
}

function emitCommandExecutionEvent<TKind extends WhitebloomCommandContextKey, TResult = unknown>(
  event: WhitebloomCommandExecutionEvent<TKind, TResult>
): void {
  for (const listener of executionListeners) {
    try {
      listener(event as WhitebloomCommandExecutionEvent)
    } catch (error) {
      console.error('[commands] execution listener failed', error)
    }
  }
}

function beginExecution<TKind extends WhitebloomCommandContextKey>(input: {
  commandId: string
  context: WhitebloomCommandContext<TKind>
  args: unknown
  options?: WhitebloomCommandExecutionOptions
  providerId?: string
}): InFlightExecution<TKind> {
  const startedAtMs = Date.now()
  const execution: WhitebloomCommandExecutionEnvelope<TKind> = {
    executionId: createCommandExecutionId(),
    commandId: input.commandId,
    contextKind: input.context.kind as TKind,
    startedAt: new Date(startedAtMs).toISOString(),
    args: input.args,
    ...(input.providerId ? { providerId: input.providerId } : {}),
    ...(input.options?.source ? { source: input.options.source } : {}),
    ...(input.options?.groupId ? { groupId: input.options.groupId } : {}),
    ...(input.options?.metadata ? { metadata: input.options.metadata } : {})
  }

  emitCommandExecutionEvent({
    phase: 'started',
    execution
  })

  return {
    execution,
    startedAtMs
  }
}

function withNormalizedArgs<TKind extends WhitebloomCommandContextKey>(
  execution: WhitebloomCommandExecutionEnvelope<TKind>,
  normalizedArgs: unknown
): WhitebloomCommandExecutionEnvelope<TKind> {
  return {
    ...execution,
    normalizedArgs
  }
}

function finishExecution<TKind extends WhitebloomCommandContextKey, TResult = unknown>(
  inFlight: InFlightExecution<TKind>,
  outcome: WhitebloomCommandExecutionResult<TKind, TResult>
): WhitebloomCommandExecutionResult<TKind, TResult> {
  const finishedAtMs = Date.now()
  emitCommandExecutionEvent({
    phase: 'finished',
    execution: outcome.execution,
    outcome,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - inFlight.startedAtMs
  })

  return outcome
}

function isParserSchema<TArgs>(
  schema: WhitebloomCommandArgsSchema<TArgs>
): schema is ((args: unknown) => TArgs) | { parse: (args: unknown) => TArgs } {
  return typeof schema === 'function' || (typeof schema === 'object' && schema !== null && 'parse' in schema)
}

function isValidatorSchema<TArgs>(
  schema: WhitebloomCommandArgsSchema<TArgs>
): schema is { validate: (args: unknown) => args is TArgs; normalize?: (args: TArgs) => TArgs } {
  return typeof schema === 'object' && schema !== null && 'validate' in schema
}

export function normalizeCommandArgs<TArgs>(schema: WhitebloomCommandArgsSchema<TArgs> | undefined, args: unknown): TArgs {
  if (!schema) return args as TArgs

  if (isParserSchema(schema)) {
    return typeof schema === 'function' ? schema(args) : schema.parse(args)
  }

  if (isValidatorSchema(schema)) {
    if (!schema.validate(args)) {
      throw new Error('Invalid command arguments.')
    }

    return schema.normalize ? schema.normalize(args) : args
  }

  return args as TArgs
}

export function resolveExecutableCommandById<TKind extends WhitebloomCommandContextKey>(
  id: string,
  context: WhitebloomCommandContext<TKind>
): WhitebloomRegisteredCommandForContext<TKind> | undefined {
  const normalizedId = id.trim()
  if (!normalizedId) return undefined

  return getRegisteredCommandsForRuntimeContext(context).find((entry) => entry.command.core.id === normalizedId)
}

export function resolveExecutableCommandByName<TKind extends WhitebloomCommandContextKey>(
  name: string,
  context: WhitebloomCommandContext<TKind>
): WhitebloomRegisteredCommandForContext<TKind> | undefined {
  const normalizedName = name.trim().toLowerCase()
  if (!normalizedName) return undefined

  return getRegisteredCommandsForRuntimeContext(context).find((entry) => {
    if (entry.command.core.id.toLowerCase() === normalizedName) return true
    return entry.command.core.aliases?.some((alias) => alias.trim().toLowerCase() === normalizedName) ?? false
  })
}

export async function executeRegisteredCommand<
  TKind extends WhitebloomCommandContextKey,
  TArgs = unknown,
  TResult = unknown
>(
  entry: WhitebloomRegisteredCommandForContext<TKind>,
  args: TArgs,
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<WhitebloomCommandExecutionResult<TKind, TResult>> {
  const inFlight = beginExecution({
    commandId: entry.command.core.id,
    context,
    args,
    options,
    providerId: entry.provider.id
  })

  if (!isRegisteredCommandAvailable(entry, context)) {
    return finishExecution(inFlight, {
      ok: false,
      commandId: entry.command.core.id,
      execution: inFlight.execution,
      reason: 'unavailable',
      entry,
      message: 'Command is not available in the current context.'
    })
  }

  let normalizedArgs: unknown
  try {
    normalizedArgs = normalizeCommandArgs(entry.command.core.argsSchema, args)
  } catch (error) {
    return finishExecution(inFlight, {
      ok: false,
      commandId: entry.command.core.id,
      execution: inFlight.execution,
      reason: 'invalid-args',
      entry,
      message: error instanceof Error ? error.message : 'Invalid command arguments.',
      error: error instanceof Error ? error : undefined
    })
  }

  const normalizedExecution = withNormalizedArgs(inFlight.execution, normalizedArgs)

  try {
    const result = await (entry.command.core.run as (
      args: TArgs,
      context: WhitebloomCommandContext<TKind>,
      interaction: WhitebloomCommandInteractionController
    ) => TResult | Promise<TResult>)(
      normalizedArgs as TArgs,
      context,
      options.interaction ?? NOOP_INTERACTION_CONTROLLER
    )

    return finishExecution(inFlight, {
      ok: true,
      entry,
      execution: normalizedExecution,
      args: normalizedArgs,
      result
    })
  } catch (error) {
    return finishExecution(inFlight, {
      ok: false,
      commandId: entry.command.core.id,
      execution: normalizedExecution,
      reason: 'error',
      entry,
      message: error instanceof Error ? error.message : 'Command execution failed.',
      error: error instanceof Error ? error : undefined
    })
  }
}

export async function executeCommandById<
  TKind extends WhitebloomCommandContextKey,
  TArgs = unknown,
  TResult = unknown
>(
  id: string,
  args: TArgs,
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<WhitebloomCommandExecutionResult<TKind, TResult>> {
  const entry = resolveExecutableCommandById(id, context)
  if (!entry) {
    const inFlight = beginExecution({
      commandId: id.trim(),
      context,
      args,
      options
    })

    return finishExecution(inFlight, {
      ok: false,
      commandId: id.trim(),
      execution: inFlight.execution,
      reason: 'not-found',
      message: `Command not found: ${id}`
    })
  }

  return executeRegisteredCommand<TKind, TArgs, TResult>(entry, args, context, options)
}

export async function executeCommandByName<
  TKind extends WhitebloomCommandContextKey,
  TArgs = unknown,
  TResult = unknown
>(
  name: string,
  args: TArgs,
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<WhitebloomCommandExecutionResult<TKind, TResult>> {
  const entry = resolveExecutableCommandByName(name, context)
  if (!entry) {
    const inFlight = beginExecution({
      commandId: name.trim(),
      context,
      args,
      options
    })

    return finishExecution(inFlight, {
      ok: false,
      commandId: name.trim(),
      execution: inFlight.execution,
      reason: 'not-found',
      message: `Command not found: ${name}`
    })
  }

  return executeRegisteredCommand<TKind, TArgs, TResult>(entry, args, context, options)
}
