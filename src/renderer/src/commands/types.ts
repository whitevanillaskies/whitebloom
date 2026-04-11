import type React from 'react'
import type { GardenPoint } from '../../../shared/arrangements'
import type { ShapePreset } from '@renderer/shared/types'

/**
 * Command contexts describe the surface a command is executing within.
 *
 * Commands should be registered against one or more of these context keys so
 * availability and runtime behavior can be resolved by surface, not by the
 * palette component itself.
 */
export type WhitebloomCommandContextKey = 'canvas' | 'arrangements'

type CommandContextBase<TKind extends WhitebloomCommandContextKey> = {
  kind: TKind
}

export type WhitebloomCanvasPoint = {
  x: number
  y: number
}

export type WhitebloomCanvasSize = {
  w: number
  h: number
}

export type CanvasCreateBudCommandArgs = {
  position: WhitebloomCanvasPoint
  resource: string
  moduleType: string | null
  size: WhitebloomCanvasSize
  label?: string
}

export type CanvasCreateShapeCommandArgs = {
  position: WhitebloomCanvasPoint
  preset: ShapePreset
}

export type CanvasCommandSelection = {
  nodeIds: string[]
  edgeIds: string[]
}

export type CanvasLinkableBoard = {
  resource: string
  name: string
  subtitle?: string
}

export type CanvasCommandCapabilities = {
  canBloomSelection?: boolean
  canOpenSelectionInNativeEditor?: boolean
}

export type CanvasCommandActions = {
  createBud?: (input: CanvasCreateBudCommandArgs) => string
  createShape?: (input: CanvasCreateShapeCommandArgs) => void
  deleteSelection?: () => void
  bloomSelection?: () => void | Promise<void>
  openSelectionInNativeEditor?: () => void | Promise<void>
  openArrangements?: () => void
  openMaterials?: () => void
}

/**
 * Runtime context for commands invoked from the main board canvas.
 *
 * Concrete command systems can extend this later with the exact selection,
 * viewport, workspace, and action handles commands need.
 */
export type CanvasCommandContext = CommandContextBase<'canvas'> & {
  selection: CanvasCommandSelection
  capabilities: CanvasCommandCapabilities
  insertionPoint?: WhitebloomCanvasPoint
  linkableBoards?: CanvasLinkableBoard[]
  actions: CanvasCommandActions
}

export type ArrangementsCreateBinCommandArgs = {
  position: GardenPoint
  name?: string
}

export type ArrangementsAssignMaterialsToBinCommandArgs = {
  materialKeys: string[]
  binId: string
}

export type ArrangementsRemoveMaterialsFromBinCommandArgs = {
  materialKeys: string[]
}

export type ArrangementsIncludeMaterialsInSetCommandArgs = {
  materialKeys: string[]
  setId: string
}

export type ArrangementsSendMaterialsToTrashCommandArgs = {
  materialKeys: string[]
}

export type ArrangementsMoveMaterialsToDesktopCommandArgs = {
  items: Array<{
    materialKey: string
    position: GardenPoint
  }>
}

export type ArrangementsCommandSelection = {
  materialKeys: string[]
}

export type ArrangementsCommandBin = {
  id: string
  name: string
}

export type ArrangementsCommandSet = {
  id: string
  name: string
  depth: number
}

export type ArrangementsCommandActions = {
  createBin?: (input: ArrangementsCreateBinCommandArgs) => Promise<string | null> | string | null
  createBinAtViewportCenter?: (name?: string) => Promise<string | null> | string | null
  renameBin?: (binId: string, name: string) => Promise<boolean> | boolean
  deleteBin?: (binId: string) => void | Promise<void>
  createRootSet?: (name?: string) => Promise<string | null> | string | null
  renameSet?: (setId: string, name: string) => Promise<boolean> | boolean
  deleteSet?: (setId: string) => void | Promise<void>
  assignMaterialsToBin?: (
    materialKeys: string[],
    binId: string
  ) => void | Promise<void>
  removeMaterialsFromBin?: (materialKeys: string[]) => void | Promise<void>
  includeMaterialsInSet?: (
    materialKeys: string[],
    setId: string
  ) => void | Promise<void>
  sendMaterialsToTrash?: (materialKeys: string[]) => void | Promise<void>
  moveMaterialsToDesktop?: (
    items: ArrangementsMoveMaterialsToDesktopCommandArgs['items']
  ) => void | Promise<void>
}

/**
 * Runtime context for commands invoked from the Arrangements surface.
 *
 * Concrete command systems can extend this later with arrangements-specific
 * data such as bins, sets, desktop viewport state, and action handles.
 */
export type ArrangementsCommandContext = CommandContextBase<'arrangements'> & {
  selection: ArrangementsCommandSelection
  availableBinIds: string[]
  availableSetIds: string[]
  availableBins?: ArrangementsCommandBin[]
  availableSets?: ArrangementsCommandSet[]
  actions: ArrangementsCommandActions
}

export type WhitebloomCommandContextMap = {
  canvas: CanvasCommandContext
  arrangements: ArrangementsCommandContext
}

export type WhitebloomCommandContext<TKind extends WhitebloomCommandContextKey> =
  WhitebloomCommandContextMap[TKind]

export type AnyWhitebloomCommandContext =
  WhitebloomCommandContextMap[WhitebloomCommandContextKey]

/**
 * Stable naked/core command id.
 *
 * Recommended style is dot-namespaced segments with kebab-case leaves, e.g.
 * `board.add-bud` or `org.task.clock-in`.
 */
export type WhitebloomCommandId = string

export type WhitebloomCommandArgsSchema<TArgs = unknown> =
  | ((args: unknown) => TArgs)
  | {
      parse: (args: unknown) => TArgs
    }
  | {
      validate: (args: unknown) => args is TArgs
      normalize?: (args: TArgs) => TArgs
    }

export type WhitebloomCommandWhen<TContext extends AnyWhitebloomCommandContext> = (
  context: TContext
) => boolean

export type WhitebloomCommandLatentState = {
  title?: string
  label?: string
  /**
   * Optional normalized progress value between 0 and 1.
   *
   * When omitted or null, the palette should render an indeterminate spinner.
   */
  progress?: number | null
}

export type WhitebloomCommandInteractionController = {
  signal: AbortSignal
  setBusyState: (state: WhitebloomCommandLatentState | null) => void
}

export type WhitebloomCommandRun<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void,
  TResult = void
> = (
  args: TArgs,
  context: TContext,
  interaction: WhitebloomCommandInteractionController
) => TResult | Promise<TResult>

export type WhitebloomCommandDisplayMetadata = {
  title: string
  subtitle?: string
  hotkey?: string
  icon?: React.ComponentType<{ size?: number }>
}

/**
 * The real command.
 *
 * This is the stable identity that menus, shortcuts, scripts, LLM tooling, and
 * palette presentations should all bottom out to.
 */
export type WhitebloomCommandCore<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext,
  TArgs = void,
  TResult = void
> = {
  id: WhitebloomCommandId
  aliases?: string[]
  when?: WhitebloomCommandWhen<TContext>
  argsSchema?: WhitebloomCommandArgsSchema<TArgs>
  run: WhitebloomCommandRun<TContext, TArgs, TResult>
}

/**
 * Optional palette-facing presentation for a command.
 *
 * This is intentionally presentation-only. It does not create a second command
 * identity; it only tells command-consuming surfaces how to render the core
 * command in a friendlier way.
 */
export type WhitebloomCommandPresentation<TKind extends WhitebloomCommandContextKey> = {
  context: TKind
} & WhitebloomCommandDisplayMetadata

export type WhitebloomCommandFlowStepId = string

export type WhitebloomCommandFlowTransition<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> =
  | { type: 'step'; step: WhitebloomCommandFlowStep<TContext, TArgs> }
  | { type: 'submit'; args: TArgs }
  | { type: 'cancel' }

export type WhitebloomCommandFlowHandler<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> = (
  context: TContext,
  interaction: WhitebloomCommandInteractionController
) => WhitebloomCommandFlowTransition<TContext, TArgs> | Promise<WhitebloomCommandFlowTransition<TContext, TArgs>>

export type WhitebloomCommandFlowInputHandler<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> = (
  value: string,
  context: TContext,
  interaction: WhitebloomCommandInteractionController
) => WhitebloomCommandFlowTransition<TContext, TArgs> | Promise<WhitebloomCommandFlowTransition<TContext, TArgs>>

export type WhitebloomCommandFlowChoice<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> = {
  id: string
  onSelect: WhitebloomCommandFlowHandler<TContext, TArgs>
} & WhitebloomCommandDisplayMetadata

export type WhitebloomCommandFlowListStep<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> = {
  kind: 'list'
  id: WhitebloomCommandFlowStepId
  title?: string
  subtitle?: string
  placeholder?: string
  emptyLabel?: string
  items: WhitebloomCommandFlowChoice<TContext, TArgs>[]
}

export type WhitebloomCommandFlowInputStep<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> = {
  kind: 'input'
  id: WhitebloomCommandFlowStepId
  title?: string
  subtitle?: string
  placeholder?: string
  submitLabel?: string
  initialValue?: string
  onSubmit: WhitebloomCommandFlowInputHandler<TContext, TArgs>
}

export type WhitebloomCommandFlowStep<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> =
  | WhitebloomCommandFlowListStep<TContext, TArgs>
  | WhitebloomCommandFlowInputStep<TContext, TArgs>

/**
 * Optional self-contained argument-collection flow owned by a command.
 *
 * The flow does not replace the command's core identity or execution. It only
 * describes how a command can gather follow-up intent before finally submitting
 * typed args back to the core `run(...)`.
 */
export type WhitebloomCommandFlow<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext,
  TArgs = void
> = {
  start: WhitebloomCommandFlowHandler<TContext, TArgs>
}

/**
 * Full command contract: one required naked/core command plus optional
 * dolled-up presentations.
 */
export type WhitebloomCommand<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext,
  TArgs = void,
  TResult = void
> = {
  core: WhitebloomCommandCore<TContext, TArgs, TResult>
  flow?: WhitebloomCommandFlow<TContext, TArgs>
  presentations?: WhitebloomCommandPresentation<TContext['kind']>[]
}

export type WhitebloomAnyCommand = WhitebloomCommand<AnyWhitebloomCommandContext, any, any>

export type WhitebloomCommandForContext<TKind extends WhitebloomCommandContextKey> =
  WhitebloomCommand<WhitebloomCommandContext<TKind>, any, any>

export type WhitebloomCommandsByContext = {
  [TKind in WhitebloomCommandContextKey]?: WhitebloomCommandForContext<TKind>[]
}

export type WhitebloomCommandProviderSource =
  | { kind: 'builtin' }
  | { kind: 'module'; moduleId: string }

/**
 * A registration unit that contributes commands into one or more command
 * contexts.
 *
 * Providers keep command contribution separate from the consuming surface. This
 * lets built-in app features and modules both participate in the same command
 * language without forcing command definitions to live inside the palette.
 */
export type WhitebloomCommandProvider = {
  id: string
  source: WhitebloomCommandProviderSource
  commands: WhitebloomCommandsByContext
}

export type WhitebloomRegisteredCommand<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext
> = {
  provider: WhitebloomCommandProvider
  command: WhitebloomCommand<TContext, any, any>
}

export type WhitebloomRegisteredCommandForContext<TKind extends WhitebloomCommandContextKey> =
  WhitebloomRegisteredCommand<WhitebloomCommandContext<TKind>>

export type WhitebloomCommandSearchOptions = {
  namespace?: string
  limit?: number
}

export type WhitebloomCommandSearchMatchKind =
  | 'core-id'
  | 'core-alias'
  | 'presentation-title'
  | 'presentation-subtitle'

export type WhitebloomCommandSearchResult<TKind extends WhitebloomCommandContextKey> = {
  entry: WhitebloomRegisteredCommandForContext<TKind>
  matchedBy: WhitebloomCommandSearchMatchKind
  presentation?: WhitebloomCommandPresentation<TKind>
}

/**
 * Virtual namespace node inferred from flat command ids.
 *
 * These nodes are derived on demand from currently available commands; they
 * are not registered as first-class command objects.
 */
export type WhitebloomVirtualCommandNamespace<TKind extends WhitebloomCommandContextKey> = {
  id: string
  segment: string
  parentId: string | null
  depth: number
  hasDirectCommand: boolean
  hasChildren: boolean
  commandCount: number
  entries: WhitebloomRegisteredCommandForContext<TKind>[]
}

export type WhitebloomCommandExecutionMetadata = Record<string, unknown>

export type WhitebloomCommandExecutionOptions = {
  source?: string
  groupId?: string
  metadata?: WhitebloomCommandExecutionMetadata
  interaction?: WhitebloomCommandInteractionController
}

export type WhitebloomCommandExecutionEnvelope<
  TKind extends WhitebloomCommandContextKey = WhitebloomCommandContextKey
> = {
  executionId: string
  commandId: string
  contextKind: TKind
  providerId?: string
  source?: string
  groupId?: string
  metadata?: WhitebloomCommandExecutionMetadata
  startedAt: string
  args: unknown
  normalizedArgs?: unknown
}

export type WhitebloomCommandExecutionFailureReason =
  | 'not-found'
  | 'unavailable'
  | 'invalid-args'
  | 'error'

export type WhitebloomCommandExecutionSuccess<
  TKind extends WhitebloomCommandContextKey,
  TResult = unknown
> = {
  ok: true
  entry: WhitebloomRegisteredCommandForContext<TKind>
  execution: WhitebloomCommandExecutionEnvelope<TKind>
  args: unknown
  result: TResult
}

export type WhitebloomCommandExecutionFailure<TKind extends WhitebloomCommandContextKey> = {
  ok: false
  commandId: string
  reason: WhitebloomCommandExecutionFailureReason
  execution: WhitebloomCommandExecutionEnvelope<TKind>
  entry?: WhitebloomRegisteredCommandForContext<TKind>
  message?: string
  error?: Error
}

export type WhitebloomCommandExecutionResult<
  TKind extends WhitebloomCommandContextKey,
  TResult = unknown
> =
  | WhitebloomCommandExecutionSuccess<TKind, TResult>
  | WhitebloomCommandExecutionFailure<TKind>

export type WhitebloomCommandExecutionStartedEvent<
  TKind extends WhitebloomCommandContextKey = WhitebloomCommandContextKey
> = {
  phase: 'started'
  execution: WhitebloomCommandExecutionEnvelope<TKind>
}

export type WhitebloomCommandExecutionFinishedEvent<
  TKind extends WhitebloomCommandContextKey = WhitebloomCommandContextKey,
  TResult = unknown
> = {
  phase: 'finished'
  execution: WhitebloomCommandExecutionEnvelope<TKind>
  outcome: WhitebloomCommandExecutionResult<TKind, TResult>
  finishedAt: string
  durationMs: number
}

export type WhitebloomCommandExecutionEvent<
  TKind extends WhitebloomCommandContextKey = WhitebloomCommandContextKey,
  TResult = unknown
> =
  | WhitebloomCommandExecutionStartedEvent<TKind>
  | WhitebloomCommandExecutionFinishedEvent<TKind, TResult>

export type WhitebloomCommandExecutionListener = (
  event: WhitebloomCommandExecutionEvent
) => void
