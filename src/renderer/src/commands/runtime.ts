import { getAllRegisteredCommands } from './registry'
import type {
  AnyWhitebloomCommandContext,
  WhitebloomCommandArgsSchema,
  WhitebloomCommandExecutionEnvelope,
  WhitebloomCommandExecutionEvent,
  WhitebloomCommandExecutionListener,
  WhitebloomCommandExecutionOptions,
  WhitebloomCommandExecutionResult,
  WhitebloomCommandInteractionController,
  WhitebloomCommandModeKey,
  WhitebloomRegisteredCommandForContext
} from './types'

type InFlightExecution<TContext extends AnyWhitebloomCommandContext> = {
  execution: WhitebloomCommandExecutionEnvelope<TContext['majorMode']>
  startedAtMs: number
}

const executionListeners = new Set<WhitebloomCommandExecutionListener>()
const NOOP_INTERACTION_CONTROLLER: WhitebloomCommandInteractionController = {
  signal: new AbortController().signal,
  setBusyState: () => {}
}

export function doesCommandApplyToMajorMode(
  entry: WhitebloomRegisteredCommandForContext<any>,
  majorMode: WhitebloomCommandModeKey
): boolean {
  const scope = entry.command.core.modeScope
  if (!scope) return true
  return Array.isArray(scope) ? scope.includes(majorMode) : scope === majorMode
}

export function isCommandDiscoverableInMajorMode(
  entry: WhitebloomRegisteredCommandForContext<any>,
  majorMode: WhitebloomCommandModeKey
): boolean {
  const scope = entry.command.core.modeScope
  if (!scope) return false
  return Array.isArray(scope) ? scope.includes(majorMode) : scope === majorMode
}

export function isRegisteredCommandAvailable<TContext extends AnyWhitebloomCommandContext>(
  entry: WhitebloomRegisteredCommandForContext<TContext>,
  context: TContext
): boolean {
  if (!doesCommandApplyToMajorMode(entry, context.majorMode)) {
    return false
  }

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

function emitCommandExecutionEvent<TResult = unknown>(
  event: WhitebloomCommandExecutionEvent<any, TResult>
): void {
  for (const listener of executionListeners) {
    try {
      listener(event as WhitebloomCommandExecutionEvent)
    } catch (error) {
      console.error('[commands] execution listener failed', error)
    }
  }
}

function beginExecution<TContext extends AnyWhitebloomCommandContext>(input: {
  commandId: string
  context: TContext
  args: unknown
  options?: WhitebloomCommandExecutionOptions
  providerId?: string
}): InFlightExecution<TContext> {
  const startedAtMs = Date.now()
  const execution: WhitebloomCommandExecutionEnvelope<TContext['majorMode']> = {
    executionId: createCommandExecutionId(),
    commandId: input.commandId,
    majorMode: input.context.majorMode,
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

function withNormalizedArgs<TMajorMode extends WhitebloomCommandModeKey>(
  execution: WhitebloomCommandExecutionEnvelope<TMajorMode>,
  normalizedArgs: unknown
): WhitebloomCommandExecutionEnvelope<TMajorMode> {
  return {
    ...execution,
    normalizedArgs
  }
}

function finishExecution<TContext extends AnyWhitebloomCommandContext, TResult = unknown>(
  inFlight: InFlightExecution<TContext>,
  outcome: WhitebloomCommandExecutionResult<TContext, TResult>
): WhitebloomCommandExecutionResult<TContext, TResult> {
  const finishedAtMs = Date.now()
  emitCommandExecutionEvent({
    phase: 'finished',
    execution: outcome.execution,
    outcome,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - inFlight.startedAtMs
  } as WhitebloomCommandExecutionEvent<any, TResult>)

  return outcome
}

function isParserSchema<TArgs>(
  schema: WhitebloomCommandArgsSchema<TArgs>
): schema is ((args: unknown) => TArgs) | { parse: (args: unknown) => TArgs } {
  return (
    typeof schema === 'function' ||
    (typeof schema === 'object' && schema !== null && 'parse' in schema)
  )
}

function isValidatorSchema<TArgs>(
  schema: WhitebloomCommandArgsSchema<TArgs>
): schema is { validate: (args: unknown) => args is TArgs; normalize?: (args: TArgs) => TArgs } {
  return typeof schema === 'object' && schema !== null && 'validate' in schema
}

export function normalizeCommandArgs<TArgs>(
  schema: WhitebloomCommandArgsSchema<TArgs> | undefined,
  args: unknown
): TArgs {
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

export function resolveExecutableCommandById<TContext extends AnyWhitebloomCommandContext>(
  id: string,
  _context: TContext
): WhitebloomRegisteredCommandForContext<TContext> | undefined {
  const normalizedId = id.trim()
  if (!normalizedId) return undefined

  return getAllRegisteredCommands().find((entry) => entry.command.core.id === normalizedId) as
    | WhitebloomRegisteredCommandForContext<TContext>
    | undefined
}

export function resolveExecutableCommandByName<TContext extends AnyWhitebloomCommandContext>(
  name: string,
  _context: TContext
): WhitebloomRegisteredCommandForContext<TContext> | undefined {
  const normalizedName = name.trim().toLowerCase()
  if (!normalizedName) return undefined

  return getAllRegisteredCommands().find((entry) => {
    if (entry.command.core.id.toLowerCase() === normalizedName) return true
    return (
      entry.command.core.aliases?.some((alias) => alias.trim().toLowerCase() === normalizedName) ??
      false
    )
  }) as WhitebloomRegisteredCommandForContext<TContext> | undefined
}

export async function executeRegisteredCommand<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = unknown,
  TResult = unknown
>(
  entry: WhitebloomRegisteredCommandForContext<TContext>,
  args: TArgs,
  context: TContext,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<WhitebloomCommandExecutionResult<TContext, TResult>> {
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
      message: 'Command is not available in the current major mode or subject state.'
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
    const result = await (
      entry.command.core.run as (
        args: TArgs,
        context: TContext,
        interaction: WhitebloomCommandInteractionController
      ) => TResult | Promise<TResult>
    )(normalizedArgs as TArgs, context, options.interaction ?? NOOP_INTERACTION_CONTROLLER)

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
  TContext extends AnyWhitebloomCommandContext,
  TArgs = unknown,
  TResult = unknown
>(
  id: string,
  args: TArgs,
  context: TContext,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<WhitebloomCommandExecutionResult<TContext, TResult>> {
  const entry = resolveExecutableCommandById(id, context)
  if (!entry) {
    const inFlight = beginExecution({
      commandId: id,
      context,
      args,
      options
    })

    return finishExecution(inFlight, {
      ok: false,
      commandId: id,
      execution: inFlight.execution,
      reason: 'not-found',
      message: `Command not found: ${id}`
    })
  }

  return executeRegisteredCommand<TContext, TArgs, TResult>(entry, args, context, options)
}

export async function executeCommandByName<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = unknown,
  TResult = unknown
>(
  name: string,
  args: TArgs,
  context: TContext,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<WhitebloomCommandExecutionResult<TContext, TResult>> {
  const entry = resolveExecutableCommandByName(name, context)
  if (!entry) {
    const inFlight = beginExecution({
      commandId: name,
      context,
      args,
      options
    })

    return finishExecution(inFlight, {
      ok: false,
      commandId: name,
      execution: inFlight.execution,
      reason: 'not-found',
      message: `Command not found: ${name}`
    })
  }

  return executeRegisteredCommand<TContext, TArgs, TResult>(entry, args, context, options)
}
