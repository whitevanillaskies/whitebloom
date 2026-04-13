import type React from 'react'
import type { GardenPoint } from '../../../shared/arrangements'
import type { BoardEdge, BoardNode, ShapePreset } from '@renderer/shared/types'
import type { InkStroke, InkSurfaceBinding } from '../../../shared/ink'

export type WhitebloomCommandModeKey = 'canvas-mode' | `module:${string}`

export type WhitebloomCommandModeScope =
  | WhitebloomCommandModeKey
  | readonly WhitebloomCommandModeKey[]

type CommandContextBase<TMajorMode extends WhitebloomCommandModeKey = WhitebloomCommandModeKey> = {
  majorMode: TMajorMode
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

export type CanvasAddEdgeCommandArgs = {
  from: string
  to: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type CanvasDeletedSelection = {
  deletedNodes: BoardNode[]
  deletedEdges: BoardEdge[]
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
  /** Linking is always available; no workspace required. */
  canLinkResources?: boolean
  /** Import requires a workspace to copy files into. */
  canImportResources?: boolean
  /** A cluster is the sole selected node and it has at least one child. */
  canFitCluster?: boolean
  /** A cluster is the sole selected node. */
  canToggleClusterAutofit?: boolean
  /** A cluster with children is selected and a workspace root is available. */
  canPromoteClusterToSubboard?: boolean
  /** At least one selected node is a fixed-width text node. */
  canToggleTextAutoWidth?: boolean
}

export type CanvasToolKind = 'pointer' | 'hand' | 'text' | 'ink'

export type CanvasSelectionShape =
  | 'none'
  | 'single-node'
  | 'single-edge'
  | 'multiple-nodes'
  | 'multiple-edges'
  | 'mixed'

export type CanvasCommandActions = {
  createBud?: (input: CanvasCreateBudCommandArgs) => string
  createShape?: (input: CanvasCreateShapeCommandArgs) => { nodeId: string }
  deleteSelection?: () => CanvasDeletedSelection
  bloomSelection?: () => void | Promise<void>
  openSelectionInNativeEditor?: () => void | Promise<void>
  openMaterials?: () => void
  /** Open the OS file-link dialog and place the picked resources on the canvas. */
  linkResources?: () => Promise<void>
  /**
   * Open the OS file-import dialog and copy the picked resources into the
   * workspace, then place them on the canvas. Absent when no workspace is open.
   */
  importResources?: () => Promise<void>
  /** Insert a new text node at the current insertion point. Returns the new node id. */
  addTextNode?: () => { nodeId: string }
  /** Connect two nodes with an edge. Returns the new edge id. */
  addEdge?: (params: CanvasAddEdgeCommandArgs) => { edgeId: string }
  /** Group the current selection (or an empty cluster) into a cluster node. */
  createCluster?: () => void
  /**
   * Resize the selected cluster frame to tightly wrap its children.
   * Absent when no cluster is selected or the cluster has no children.
   */
  fitClusterToChildren?: () => void
  /**
   * Toggle auto-fit-to-contents on the selected cluster.
   * Absent when no cluster is selected.
   */
  toggleClusterAutofit?: () => void
  /**
   * Open the promote-to-subboard modal for the selected cluster.
   * Absent when no cluster with children is selected or no workspace is open.
   */
  openPromoteSubboardModal?: () => void
  /**
   * Convert all selected fixed-width text nodes to auto-width mode.
   * Absent when no qualifying node is selected.
   */
  toggleTextAutoWidth?: () => void
  /**
   * Create a new Focus Writer bud at the insertion point and open it.
   * Absent when no workspace is open.
   */
  addFocusWriterBud?: () => Promise<void>
  /**
   * Create a new Schema Bloom bud at the insertion point and open it.
   * Absent when no workspace is open.
   */
  addSchemaBloomBud?: () => Promise<void>
  /** Persist an ink stroke to the acetate for the current board surface. Returns the stroke id. */
  appendInkStroke?: (binding: InkSurfaceBinding, stroke: InkStroke) => Promise<{ strokeId: string }>
  /** Remove an ink stroke from the acetate. */
  removeInkStroke?: (binding: InkSurfaceBinding, strokeId: string) => Promise<void>
  /** Clear all strokes from the acetate. Returns the strokes that were removed (for undo). */
  clearInkLayer?: (binding: InkSurfaceBinding) => Promise<{ clearedStrokes: InkStroke[] }>
  /** Restore a set of strokes to the acetate (used by undo of clear). */
  restoreInkStrokes?: (binding: InkSurfaceBinding, strokes: InkStroke[]) => Promise<void>
  /** Erase a specific set of strokes from the acetate (used for eraser gesture). */
  eraseInkStrokes?: (binding: InkSurfaceBinding, strokes: InkStroke[]) => Promise<void>
}

export type CanvasSubjectSnapshot = {
  selectionShape: CanvasSelectionShape
  selection: CanvasCommandSelection
  capabilities: CanvasCommandCapabilities
  activeTool: CanvasToolKind
  insertionPoint?: WhitebloomCanvasPoint
  linkableBoards?: CanvasLinkableBoard[]
}

/**
 * Command state for the main board surface.
 *
 * The current major mode rides alongside the semantic snapshot so command
 * discovery can be driven by mode without reintroducing a separate runtime
 * context registry axis.
 */
export type CanvasCommandContext = CommandContextBase & {
  subjectSnapshot: CanvasSubjectSnapshot
  actions: CanvasCommandActions
}

// ---------------------------------------------------------------------------
// PDF module
// ---------------------------------------------------------------------------

export type PdfSubjectSnapshot = {
  /** `file:` or `wloc:` URI of the active PDF document. */
  resource: string
  /** Total number of pages in the document. */
  pageCount: number
  /** The page currently visible or focused (1-based). */
  activePage: number
}

export type PdfCommandActions = {
  navigateToPage?: (page: number) => void
  extractPages?: (pages: number[]) => Promise<void>
  appendInkStroke?: (binding: InkSurfaceBinding, stroke: InkStroke) => Promise<{ strokeId: string }>
  removeInkStroke?: (binding: InkSurfaceBinding, strokeId: string) => Promise<void>
  clearInkLayer?: (binding: InkSurfaceBinding) => Promise<{ clearedStrokes: InkStroke[] }>
  restoreInkStrokes?: (binding: InkSurfaceBinding, strokes: InkStroke[]) => Promise<void>
  /** Erase a specific set of strokes from the acetate (used for eraser gesture). */
  eraseInkStrokes?: (binding: InkSurfaceBinding, strokes: InkStroke[]) => Promise<void>
}

export type PdfCommandContext = CommandContextBase<'module:com.whitebloom.pdf'> & {
  subjectSnapshot: PdfSubjectSnapshot
  actions: PdfCommandActions
}

// ---------------------------------------------------------------------------
// Focus Writer module
// ---------------------------------------------------------------------------

export type FocusWriterSubjectSnapshot = {
  /** `wloc:` URI of the open document. */
  resource: string
  /** True when the document has no content. */
  isEmpty: boolean
  /** True when the embedded textarea has a non-collapsed text selection. */
  hasTextSelection: boolean
}

/**
 * Focus Writer has no discrete command actions yet. The type is a named
 * placeholder so commands can depend on it and expand it later without
 * changing call sites.
 */
export type FocusWriterCommandActions = Record<string, never>

export type FocusWriterCommandContext =
  CommandContextBase<'module:com.whitebloom.focus-writer'> & {
    subjectSnapshot: FocusWriterSubjectSnapshot
    actions: FocusWriterCommandActions
  }

// ---------------------------------------------------------------------------
// Generic module fallback
//
// Modules that do not yet publish a typed snapshot use this context. It
// carries the resource and module identity so mode-scoped commands can still
// inspect the most basic facts without needing a richer per-module contract.
// ---------------------------------------------------------------------------

export type GenericModuleSubjectSnapshot = {
  /** The resource URI currently open in the module editor. */
  resource: string
  /** The owning module's id, e.g. `'com.whitebloom.boardbloom'`. */
  moduleId: string
}

export type GenericModuleCommandContext = CommandContextBase<`module:${string}`> & {
  subjectSnapshot: GenericModuleSubjectSnapshot
  actions: Record<string, never>
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
  assignMaterialsToBin?: (materialKeys: string[], binId: string) => void | Promise<void>
  removeMaterialsFromBin?: (materialKeys: string[]) => void | Promise<void>
  includeMaterialsInSet?: (materialKeys: string[], setId: string) => void | Promise<void>
  sendMaterialsToTrash?: (materialKeys: string[]) => void | Promise<void>
  moveMaterialsToDesktop?: (
    items: ArrangementsMoveMaterialsToDesktopCommandArgs['items']
  ) => void | Promise<void>
}

export type ArrangementsSubjectSnapshot = {
  selection: ArrangementsCommandSelection
  availableBinIds: string[]
  availableSetIds: string[]
  availableBins?: ArrangementsCommandBin[]
  availableSets?: ArrangementsCommandSet[]
}

/**
 * Programmatic command state for arrangements mutations.
 *
 * These commands are intentionally not treated as a separate major mode. They
 * execute under the caller's current major mode while keeping their own
 * semantic payload for mutation operations.
 */
export type ArrangementsCommandContext = CommandContextBase & {
  subjectSnapshot: ArrangementsSubjectSnapshot
  actions: ArrangementsCommandActions
}

export type AnyWhitebloomCommandContext =
  | CanvasCommandContext
  | ArrangementsCommandContext
  | PdfCommandContext
  | FocusWriterCommandContext
  | GenericModuleCommandContext

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

export type WhitebloomCommandEnabledWhen<TContext extends AnyWhitebloomCommandContext> = (
  context: TContext
) => boolean

export type WhitebloomCommandWhen<TContext extends AnyWhitebloomCommandContext> =
  WhitebloomCommandEnabledWhen<TContext>

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

/**
 * The execution body of a command.
 *
 * `run` receives the context that was current at dispatch time, but it must
 * revalidate before acting on mutable state. The context snapshot may be
 * slightly older than the world by the time `run` fires — particularly for
 * flow commands where the user walks through several steps before submitting.
 *
 * Concretely: always check that any `actions.*` function you intend to call is
 * still present and that the `subjectSnapshot` fields you depend on still hold
 * before performing mutations. Throw if the preconditions are not met — the
 * runtime will record the failure cleanly.
 */
export type WhitebloomCommandRun<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void,
  TResult = void
> = (
  args: TArgs,
  context: TContext,
  interaction: WhitebloomCommandInteractionController
) => TResult | Promise<TResult>

/**
 * The inverse of {@link WhitebloomCommandRun}.
 *
 * Receives the same `args` and `result` that were captured at execution time,
 * plus the context that was current when the undo is triggered. Implementations
 * should exactly reverse the effect of `run`.
 *
 * Presence of this field is what opts a command into the history system.
 * Commands without `undo` are treated as non-undoable and never pushed to the
 * undo stack — this covers pure navigation, view toggles, palette interactions,
 * and any command that is intentionally ephemeral. The `history.undo` and
 * `history.redo` commands themselves omit `undo` for the same reason.
 */
export type WhitebloomCommandUndo<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void,
  TResult = void
> = (args: TArgs, result: TResult, context: TContext) => void | Promise<void>

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
 *
 * ## Availability vs. safety
 *
 * `enabledWhen` controls whether the command is surfaced at all (palette
 * visibility, keyboard-shortcut activation). It is evaluated against a snapshot
 * that may be slightly stale relative to the moment `run` fires.
 *
 * `run` is therefore responsible for revalidating its own preconditions before
 * mutating state — see {@link WhitebloomCommandRun} for details.
 */
export type WhitebloomCommandCore<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext,
  TArgs = void,
  TResult = void
> = {
  id: WhitebloomCommandId
  aliases?: string[]
  modeScope?: WhitebloomCommandModeScope
  enabledWhen?: WhitebloomCommandEnabledWhen<TContext>
  argsSchema?: WhitebloomCommandArgsSchema<TArgs>
  run: WhitebloomCommandRun<TContext, TArgs, TResult>
  /**
   * The inverse of `run`. Presence opts this command into the history system.
   * Omit for commands that are non-mutating or intentionally non-undoable.
   */
  undo?: WhitebloomCommandUndo<TContext, TArgs, TResult>
}

/**
 * Optional palette-facing presentation for a command.
 *
 * This is intentionally presentation-only. It does not create a second command
 * identity; it only tells command-consuming surfaces how to render the core
 * command in a friendlier way.
 */
export type WhitebloomCommandPresentation = {
  mode: WhitebloomCommandModeKey
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
) =>
  | WhitebloomCommandFlowTransition<TContext, TArgs>
  | Promise<WhitebloomCommandFlowTransition<TContext, TArgs>>

export type WhitebloomCommandFlowInputHandler<
  TContext extends AnyWhitebloomCommandContext,
  TArgs = void
> = (
  value: string,
  context: TContext,
  interaction: WhitebloomCommandInteractionController
) =>
  | WhitebloomCommandFlowTransition<TContext, TArgs>
  | Promise<WhitebloomCommandFlowTransition<TContext, TArgs>>

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

export type WhitebloomCommandFlowStep<TContext extends AnyWhitebloomCommandContext, TArgs = void> =
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
  presentations?: WhitebloomCommandPresentation[]
}

export type WhitebloomAnyCommand = WhitebloomCommand<any, any, any>

export type WhitebloomCommandForContext<TContext extends AnyWhitebloomCommandContext> =
  WhitebloomCommand<TContext, any, any>

/**
 * Legacy export name preserved while commands move away from runtime-context
 * buckets and toward a flat registry plus `modeScope`.
 */
export type WhitebloomCommandsByContext = WhitebloomCommand<any, any, any>[]

export type WhitebloomCommandProviderSource =
  | { kind: 'builtin' }
  | { kind: 'module'; moduleId: string }

/**
 * A registration unit that contributes commands into the shared command
 * language.
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

export type WhitebloomRegisteredCommandForContext<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext
> = WhitebloomRegisteredCommand<TContext>

export type WhitebloomCommandSearchOptions = {
  namespace?: string
  limit?: number
}

export type WhitebloomCommandSearchMatchKind =
  | 'core-id'
  | 'core-alias'
  | 'presentation-title'
  | 'presentation-subtitle'

export type WhitebloomCommandSearchResult<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext
> = {
  entry: WhitebloomRegisteredCommandForContext<TContext>
  matchedBy: WhitebloomCommandSearchMatchKind
  presentation?: WhitebloomCommandPresentation
}

/**
 * Virtual namespace node inferred from flat command ids.
 *
 * These nodes are derived on demand from currently available commands; they
 * are not registered as first-class command objects.
 */
export type WhitebloomVirtualCommandNamespace<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext
> = {
  id: string
  segment: string
  parentId: string | null
  depth: number
  hasDirectCommand: boolean
  hasChildren: boolean
  commandCount: number
  entries: WhitebloomRegisteredCommandForContext<TContext>[]
}

export type WhitebloomCommandExecutionMetadata = Record<string, unknown>

export type WhitebloomCommandExecutionOptions = {
  source?: string
  groupId?: string
  metadata?: WhitebloomCommandExecutionMetadata
  interaction?: WhitebloomCommandInteractionController
}

export type WhitebloomCommandExecutionEnvelope<
  TMajorMode extends WhitebloomCommandModeKey = WhitebloomCommandModeKey
> = {
  executionId: string
  commandId: string
  majorMode: TMajorMode
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
  TContext extends AnyWhitebloomCommandContext,
  TResult = unknown
> = {
  ok: true
  entry: WhitebloomRegisteredCommandForContext<TContext>
  execution: WhitebloomCommandExecutionEnvelope<TContext['majorMode']>
  args: unknown
  result: TResult
}

export type WhitebloomCommandExecutionFailure<TContext extends AnyWhitebloomCommandContext> = {
  ok: false
  commandId: string
  reason: WhitebloomCommandExecutionFailureReason
  execution: WhitebloomCommandExecutionEnvelope<TContext['majorMode']>
  entry?: WhitebloomRegisteredCommandForContext<TContext>
  message?: string
  error?: Error
}

export type WhitebloomCommandExecutionResult<
  TContext extends AnyWhitebloomCommandContext,
  TResult = unknown
> =
  | WhitebloomCommandExecutionSuccess<TContext, TResult>
  | WhitebloomCommandExecutionFailure<TContext>

export type WhitebloomCommandExecutionStartedEvent<
  TMajorMode extends WhitebloomCommandModeKey = WhitebloomCommandModeKey
> = {
  phase: 'started'
  execution: WhitebloomCommandExecutionEnvelope<TMajorMode>
}

export type WhitebloomCommandExecutionFinishedEvent<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext,
  TResult = unknown
> = {
  phase: 'finished'
  execution: WhitebloomCommandExecutionEnvelope<TContext['majorMode']>
  outcome: WhitebloomCommandExecutionResult<TContext, TResult>
  finishedAt: string
  durationMs: number
}

export type WhitebloomCommandExecutionEvent<
  TContext extends AnyWhitebloomCommandContext = AnyWhitebloomCommandContext,
  TResult = unknown
> =
  | WhitebloomCommandExecutionStartedEvent<TContext['majorMode']>
  | WhitebloomCommandExecutionFinishedEvent<TContext, TResult>

export type WhitebloomCommandExecutionListener = (event: WhitebloomCommandExecutionEvent) => void
