import { createBuiltinCommandProvider, registerCommandProvider } from './registry'
import { useBoardStore } from '../stores/board'
import { useHistoryStore } from '../history/store'
import {
  Archive,
  ArrowDownToLine,
  Boxes,
  Database,
  Download,
  FileText,
  Globe,
  Layers,
  Link2,
  PanelsTopLeft,
  Scan,
  Tag,
  Trash2,
  Type
} from 'lucide-react'
import { boardBloomModule } from '../modules/boardbloom'
import { webPageBloomModule } from '../modules/webpagebloom'
import { normalizeWebPageUrl } from '../shared/web-page-url'
import { fetchPageTitle } from '../shared/page-title'
import type {
  ArrangementsAssignMaterialsToBinCommandArgs,
  ArrangementsCommandContext,
  ArrangementsCommandBin,
  ArrangementsCreateBinCommandArgs,
  ArrangementsCommandSet,
  ArrangementsIncludeMaterialsInSetCommandArgs,
  ArrangementsMoveMaterialsToDesktopCommandArgs,
  ArrangementsRemoveMaterialsFromBinCommandArgs,
  ArrangementsSendMaterialsToTrashCommandArgs,
  CanvasAddEdgeCommandArgs,
  CanvasCommandContext,
  CanvasCreateBudCommandArgs,
  CanvasCreateShapeCommandArgs,
  CanvasLinkableBoard,
  WhitebloomCommandForContext
} from './types'
import type { ShapePreset } from '@renderer/shared/types'
import type { InkStroke, InkSurfaceBinding } from '../../../shared/ink'

export const WHITEBLOOM_COMMAND_IDS = {
  canvas: {
    addBud: 'board.add-bud',
    addUrlPage: 'board.add-url-page',
    linkBoard: 'board.link-board',
    shapeDrawRectangle: 'board.shape.draw-rectangle',
    shapeDrawSlantedRectangle: 'board.shape.draw-slanted-rectangle',
    shapeDrawDiamond: 'board.shape.draw-diamond',
    shapeDrawEllipse: 'board.shape.draw-ellipse',
    shapeDrawTerminator: 'board.shape.draw-terminator',
    deleteSelection: 'selection.delete',
    bloomSelection: 'node.bloom',
    openSelectionInNativeEditor: 'resource.open-native',
    openMaterials: 'arrangements.open-materials',
    linkResources: 'board.link-resources',
    importResources: 'board.import-resources',
    addText: 'board.add-text',
    createCluster: 'board.create-cluster',
    fitCluster: 'board.fit-cluster',
    toggleClusterAutofit: 'board.toggle-cluster-autofit',
    promoteClusterToSubboard: 'board.promote-cluster-to-subboard',
    toggleTextAutoWidth: 'node.text.toggle-auto-width',
    addFocusWriter: 'board.add-focus-writer',
    addSchemaBloom: 'board.add-schema-bloom',
    addEdge: 'board.add-edge',
    inkAppendStroke: 'ink.append-stroke',
    historyUndo: 'history.undo',
    historyRedo: 'history.redo'
  },
  arrangements: {
    createBin: 'arrangements.bin.create',
    createBinAtCenter: 'arrangements.bin.create-at-center',
    renameBin: 'arrangements.bin.rename',
    deleteBin: 'arrangements.bin.delete',
    assignMaterialsToBin: 'arrangements.material.assign-to-bin',
    removeMaterialsFromBin: 'arrangements.material.remove-from-bin',
    includeMaterialsInSet: 'arrangements.material.include-in-set',
    sendMaterialsToTrash: 'arrangements.material.send-to-trash',
    moveMaterialsToDesktop: 'arrangements.material.move-to-desktop',
    createRootSet: 'arrangements.set.create-root',
    renameSet: 'arrangements.set.rename',
    deleteSet: 'arrangements.set.delete'
  }
} as const

const CANVAS_SHAPE_COMMANDS: Array<{ id: string; preset: ShapePreset }> = [
  { id: WHITEBLOOM_COMMAND_IDS.canvas.shapeDrawRectangle, preset: 'rectangle' },
  { id: WHITEBLOOM_COMMAND_IDS.canvas.shapeDrawSlantedRectangle, preset: 'slanted-rectangle' },
  { id: WHITEBLOOM_COMMAND_IDS.canvas.shapeDrawDiamond, preset: 'diamond' },
  { id: WHITEBLOOM_COMMAND_IDS.canvas.shapeDrawEllipse, preset: 'ellipse' },
  { id: WHITEBLOOM_COMMAND_IDS.canvas.shapeDrawTerminator, preset: 'terminator' }
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`)
  }

  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty.`)
  }

  return normalized
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new Error('label must be a string.')
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`)
  }

  return value
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`)
  }

  const normalized = value
    .map((item) => parseString(item, fieldName))
    .filter((item, index, array) => array.indexOf(item) === index)

  if (normalized.length === 0) {
    throw new Error(`${fieldName} cannot be empty.`)
  }

  return normalized
}

function parseCanvasBudArgs(args: unknown): CanvasCreateBudCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Board bud creation arguments must be an object.')
  }

  const position = isRecord(args.position) ? args.position : null
  const size = isRecord(args.size) ? args.size : null
  const moduleType =
    args.moduleType === null
      ? null
      : typeof args.moduleType === 'string'
        ? args.moduleType.trim() || null
        : undefined

  if (!position) throw new Error('position is required.')
  if (!size) throw new Error('size is required.')
  if (moduleType === undefined) throw new Error('moduleType must be a string or null.')

  return {
    position: {
      x: parseNumber(position.x, 'position.x'),
      y: parseNumber(position.y, 'position.y')
    },
    resource: parseString(args.resource, 'resource'),
    moduleType,
    size: {
      w: parseNumber(size.w, 'size.w'),
      h: parseNumber(size.h, 'size.h')
    },
    label: parseOptionalString(args.label)
  }
}

function parseArrangementsCreateBinArgs(args: unknown): ArrangementsCreateBinCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Bin creation arguments must be an object.')
  }

  const position = isRecord(args.position) ? args.position : null
  if (!position) throw new Error('position is required.')

  return {
    position: {
      x: parseNumber(position.x, 'position.x'),
      y: parseNumber(position.y, 'position.y')
    },
    ...(args.name === undefined ? {} : { name: parseString(args.name, 'name') })
  }
}

function parseAssignMaterialsToBinArgs(args: unknown): ArrangementsAssignMaterialsToBinCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Assign-to-bin arguments must be an object.')
  }

  return {
    materialKeys: parseStringArray(args.materialKeys, 'materialKeys'),
    binId: parseString(args.binId, 'binId')
  }
}

function parseRemoveMaterialsFromBinArgs(
  args: unknown
): ArrangementsRemoveMaterialsFromBinCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Remove-from-bin arguments must be an object.')
  }

  return {
    materialKeys: parseStringArray(args.materialKeys, 'materialKeys')
  }
}

function parseIncludeMaterialsInSetArgs(
  args: unknown
): ArrangementsIncludeMaterialsInSetCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Include-in-set arguments must be an object.')
  }

  return {
    materialKeys: parseStringArray(args.materialKeys, 'materialKeys'),
    setId: parseString(args.setId, 'setId')
  }
}

function parseSendMaterialsToTrashArgs(args: unknown): ArrangementsSendMaterialsToTrashCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Send-to-trash arguments must be an object.')
  }

  return {
    materialKeys: parseStringArray(args.materialKeys, 'materialKeys')
  }
}

function parseMoveMaterialsToDesktopArgs(
  args: unknown
): ArrangementsMoveMaterialsToDesktopCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Move-to-desktop arguments must be an object.')
  }

  if (!Array.isArray(args.items) || args.items.length === 0) {
    throw new Error('items must be a non-empty array.')
  }

  return {
    items: args.items.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error(`items[${index}] must be an object.`)
      }

      const position = isRecord(item.position) ? item.position : null
      if (!position) {
        throw new Error(`items[${index}].position is required.`)
      }

      return {
        materialKey: parseString(item.materialKey, `items[${index}].materialKey`),
        position: {
          x: parseNumber(position.x, `items[${index}].position.x`),
          y: parseNumber(position.y, `items[${index}].position.y`)
        }
      }
    })
  }
}

type CanvasAddUrlPageCommandArgs = CanvasCreateBudCommandArgs
type CanvasLinkBoardCommandArgs = CanvasCreateBudCommandArgs
type ArrangementsRenameBinCommandArgs = {
  binId: string
  name: string
}
type ArrangementsDeleteBinCommandArgs = {
  binId: string
}
type ArrangementsCreateRootSetCommandArgs = {
  name: string
}
type ArrangementsRenameSetCommandArgs = {
  setId: string
  name: string
}
type ArrangementsDeleteSetCommandArgs = {
  setId: string
}

function parseRenameBinArgs(args: unknown): ArrangementsRenameBinCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Rename-bin arguments must be an object.')
  }

  return {
    binId: parseString(args.binId, 'binId'),
    name: parseString(args.name, 'name')
  }
}

function parseDeleteBinArgs(args: unknown): ArrangementsDeleteBinCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Delete-bin arguments must be an object.')
  }

  return {
    binId: parseString(args.binId, 'binId')
  }
}

function parseCreateRootSetArgs(args: unknown): ArrangementsCreateRootSetCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Create-root-set arguments must be an object.')
  }

  return {
    name: parseString(args.name, 'name')
  }
}

function parseRenameSetArgs(args: unknown): ArrangementsRenameSetCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Rename-set arguments must be an object.')
  }

  return {
    setId: parseString(args.setId, 'setId'),
    name: parseString(args.name, 'name')
  }
}

function parseDeleteSetArgs(args: unknown): ArrangementsDeleteSetCommandArgs {
  if (!isRecord(args)) {
    throw new Error('Delete-set arguments must be an object.')
  }

  return {
    setId: parseString(args.setId, 'setId')
  }
}

function createCanvasUrlPageInputStep(initialValue = '') {
  return {
    kind: 'input' as const,
    id: 'board.add-url-page.input',
    title: 'Add URL Page',
    subtitle: 'Paste a URL to create a web page bud on the board.',
    placeholder: 'Paste a URL',
    submitLabel: 'Continue',
    initialValue,
    onSubmit: (value: string) => {
      const resource = normalizeWebPageUrl(value)
      if (!resource) {
        return {
          type: 'step' as const,
          step: createCanvasUrlPageInputStep(value)
        }
      }

      return {
        type: 'step' as const,
        step: createUrlPageLabelStrategyStep(resource)
      }
    }
  }
}

function createUrlPageLabelStrategyStep(resource: string) {
  return {
    kind: 'list' as const,
    id: 'board.add-url-page.label-strategy',
    title: 'Label This Page',
    subtitle: resource,
    placeholder: 'Choose a label strategy',
    items: [
      {
        id: 'use-url-name',
        title: 'Use URL Name',
        subtitle: 'Create the bud using the URL as its label',
        icon: Globe,
        onSelect: (context: CanvasCommandContext) => {
          if (!context.subjectSnapshot.insertionPoint) return { type: 'cancel' as const }
          return {
            type: 'submit' as const,
            args: {
              position: context.subjectSnapshot.insertionPoint,
              moduleType: webPageBloomModule.id,
              size: webPageBloomModule.defaultSize ?? { w: 88, h: 88 },
              resource
            } satisfies CanvasAddUrlPageCommandArgs
          }
        }
      },
      {
        id: 'try-page-title',
        title: 'Try Request Page Title',
        subtitle: 'Fetch the page title from the URL and use it as the label',
        icon: Download,
        onSelect: async (context: CanvasCommandContext, interaction) => {
          if (!context.subjectSnapshot.insertionPoint) return { type: 'cancel' as const }
          interaction.setBusyState({ title: 'Fetching page title', label: resource })
          const title = await fetchPageTitle(resource, interaction.signal)
          if (interaction.signal.aborted) return { type: 'cancel' as const }
          return {
            type: 'submit' as const,
            args: {
              position: context.subjectSnapshot.insertionPoint,
              moduleType: webPageBloomModule.id,
              size: webPageBloomModule.defaultSize ?? { w: 88, h: 88 },
              resource,
              ...(title ? { label: title } : {})
            } satisfies CanvasAddUrlPageCommandArgs
          }
        }
      },
      {
        id: 'set-label',
        title: 'Set Label',
        subtitle: 'Type a custom label for this page bud',
        icon: Tag,
        onSelect: () => ({
          type: 'step' as const,
          step: createUrlPageSetLabelInputStep(resource)
        })
      }
    ]
  }
}

function createUrlPageSetLabelInputStep(resource: string) {
  return {
    kind: 'input' as const,
    id: 'board.add-url-page.set-label',
    title: 'Set Page Label',
    subtitle: resource,
    placeholder: 'Type a label for this page',
    submitLabel: 'Add Page',
    initialValue: '',
    onSubmit: (value: string, context: CanvasCommandContext) => {
      const label = value.trim()
      if (!label) {
        return {
          type: 'step' as const,
          step: createUrlPageSetLabelInputStep(resource)
        }
      }
      if (!context.subjectSnapshot.insertionPoint) return { type: 'cancel' as const }
      return {
        type: 'submit' as const,
        args: {
          position: context.subjectSnapshot.insertionPoint,
          moduleType: webPageBloomModule.id,
          size: webPageBloomModule.defaultSize ?? { w: 88, h: 88 },
          resource,
          label
        } satisfies CanvasAddUrlPageCommandArgs
      }
    }
  }
}

function createCanvasLinkBoardListStep(linkableBoards: CanvasLinkableBoard[]) {
  return {
    kind: 'list' as const,
    id: 'board.link-board.select',
    title: 'Link Board',
    subtitle: 'Choose a workspace board to link as a bud.',
    placeholder: 'Choose a board to link',
    emptyLabel: 'No local boards available',
    items: linkableBoards.map((board) => ({
      id: board.resource,
      title: board.name,
      subtitle: board.subtitle,
      icon: PanelsTopLeft,
      onSelect: (context: CanvasCommandContext) => {
        if (!context.subjectSnapshot.insertionPoint) {
          return { type: 'cancel' as const }
        }

        return {
          type: 'submit' as const,
          args: {
            position: context.subjectSnapshot.insertionPoint,
            moduleType: boardBloomModule.id,
            size: boardBloomModule.defaultSize ?? { w: 196, h: 128 },
            label: board.name,
            resource: board.resource
          } satisfies CanvasLinkBoardCommandArgs
        }
      }
    }))
  }
}

function createArrangeCreateBinInputStep(initialValue = 'New Bin') {
  return {
    kind: 'input' as const,
    id: 'arrangements.bin.create-at-center.input',
    title: 'New Bin',
    subtitle: 'Name a new bin and create it at the desktop viewport center.',
    placeholder: 'Type the new bin name',
    submitLabel: 'Create Bin',
    initialValue,
    onSubmit: (value: string) => {
      const normalizedValue = value.trim()
      if (!normalizedValue) {
        return {
          type: 'step' as const,
          step: createArrangeCreateBinInputStep(value)
        }
      }

      return {
        type: 'submit' as const,
        args: {
          name: normalizedValue
        }
      }
    }
  }
}

function createRenameBinInputStep(bin: ArrangementsCommandBin, initialValue = bin.name) {
  return {
    kind: 'input' as const,
    id: `arrangements.bin.rename.input:${bin.id}`,
    title: 'Rename Bin',
    subtitle: `Rename ${bin.name}.`,
    placeholder: 'Type the new bin name',
    submitLabel: 'Rename Bin',
    initialValue,
    onSubmit: (value: string) => {
      const normalizedValue = value.trim()
      if (!normalizedValue) {
        return {
          type: 'step' as const,
          step: createRenameBinInputStep(bin, value)
        }
      }

      return {
        type: 'submit' as const,
        args: {
          binId: bin.id,
          name: normalizedValue
        } satisfies ArrangementsRenameBinCommandArgs
      }
    }
  }
}

function createRenameBinListStep(bins: ArrangementsCommandBin[]) {
  return {
    kind: 'list' as const,
    id: 'arrangements.bin.rename.select',
    title: 'Rename Bin',
    subtitle: 'Choose a bin, then type its new name.',
    placeholder: 'Choose a bin to rename',
    emptyLabel: 'No bins available',
    items: bins.map((bin) => ({
      id: bin.id,
      title: bin.name,
      icon: Archive,
      onSelect: () => ({
        type: 'step' as const,
        step: createRenameBinInputStep(bin)
      })
    }))
  }
}

function createDeleteBinListStep(bins: ArrangementsCommandBin[]) {
  return {
    kind: 'list' as const,
    id: 'arrangements.bin.delete.select',
    title: 'Remove Bin',
    subtitle: 'Choose a bin to remove from Arrangements.',
    placeholder: 'Choose a bin to remove',
    emptyLabel: 'No bins available',
    items: bins.map((bin) => ({
      id: bin.id,
      title: bin.name,
      subtitle: 'Remove this bin from Arrangements',
      icon: Trash2,
      onSelect: () => ({
        type: 'submit' as const,
        args: {
          binId: bin.id
        } satisfies ArrangementsDeleteBinCommandArgs
      })
    }))
  }
}

function createRootSetInputStep(initialValue = 'New Set') {
  return {
    kind: 'input' as const,
    id: 'arrangements.set.create-root.input',
    title: 'New Set',
    subtitle: 'Name a new root set in the Sets Island.',
    placeholder: 'Type the new set name',
    submitLabel: 'Create Set',
    initialValue,
    onSubmit: (value: string) => {
      const normalizedValue = value.trim()
      if (!normalizedValue) {
        return {
          type: 'step' as const,
          step: createRootSetInputStep(value)
        }
      }

      return {
        type: 'submit' as const,
        args: {
          name: normalizedValue
        } satisfies ArrangementsCreateRootSetCommandArgs
      }
    }
  }
}

function createRenameSetInputStep(setNode: ArrangementsCommandSet, initialValue = setNode.name) {
  return {
    kind: 'input' as const,
    id: `arrangements.set.rename.input:${setNode.id}`,
    title: 'Rename Set',
    subtitle: `Rename ${setNode.name}.`,
    placeholder: 'Type the new set name',
    submitLabel: 'Rename Set',
    initialValue,
    onSubmit: (value: string) => {
      const normalizedValue = value.trim()
      if (!normalizedValue) {
        return {
          type: 'step' as const,
          step: createRenameSetInputStep(setNode, value)
        }
      }

      return {
        type: 'submit' as const,
        args: {
          setId: setNode.id,
          name: normalizedValue
        } satisfies ArrangementsRenameSetCommandArgs
      }
    }
  }
}

function createRenameSetListStep(sets: ArrangementsCommandSet[]) {
  return {
    kind: 'list' as const,
    id: 'arrangements.set.rename.select',
    title: 'Rename Set',
    subtitle: 'Choose a set, then type its new name.',
    placeholder: 'Choose a set to rename',
    emptyLabel: 'No sets available',
    items: sets.map((setNode) => ({
      id: setNode.id,
      title: setNode.name,
      subtitle: setNode.depth > 0 ? `Depth ${setNode.depth}` : 'Root set',
      icon: Layers,
      onSelect: () => ({
        type: 'step' as const,
        step: createRenameSetInputStep(setNode)
      })
    }))
  }
}

function createDeleteSetListStep(sets: ArrangementsCommandSet[]) {
  return {
    kind: 'list' as const,
    id: 'arrangements.set.delete.select',
    title: 'Remove Set',
    subtitle: 'Choose a set to remove from Arrangements.',
    placeholder: 'Choose a set to remove',
    emptyLabel: 'No sets available',
    items: sets.map((setNode) => ({
      id: setNode.id,
      title: setNode.name,
      subtitle:
        setNode.depth > 0 ? `Remove nested set at depth ${setNode.depth}` : 'Remove root set',
      icon: Trash2,
      onSelect: () => ({
        type: 'submit' as const,
        args: {
          setId: setNode.id
        } satisfies ArrangementsDeleteSetCommandArgs
      })
    }))
  }
}

const canvasCommands: WhitebloomCommandForContext<CanvasCommandContext>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addBud,
      modeScope: 'canvas-mode',
      aliases: ['board.create-bud'],
      enabledWhen: (context) => typeof context.actions.createBud === 'function',
      argsSchema: parseCanvasBudArgs,
      run: (args, context) => {
        if (!context.actions.createBud) {
          throw new Error('Canvas context cannot create buds.')
        }

        return context.actions.createBud(args)
      },
      undo: (_args, nodeId) => {
        useBoardStore.getState().deleteNode(nodeId as string)
      }
    }
  },
  ...CANVAS_SHAPE_COMMANDS.map<WhitebloomCommandForContext<CanvasCommandContext>>(
    ({ id, preset }) => ({
      core: {
        id,
        modeScope: 'canvas-mode',
        enabledWhen: (context) =>
          typeof context.actions.createShape === 'function' &&
          context.subjectSnapshot.insertionPoint !== undefined,
        run: async (_args, context) => {
          if (!context.actions.createShape || !context.subjectSnapshot.insertionPoint) {
            throw new Error('Canvas context cannot create shapes.')
          }

          return context.actions.createShape({
            position: context.subjectSnapshot.insertionPoint,
            preset
          } satisfies CanvasCreateShapeCommandArgs)
        },
        undo: (_args, result) => {
          useBoardStore.getState().deleteNode((result as { nodeId: string }).nodeId)
        }
      }
    })
  ),
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addUrlPage,
      modeScope: 'canvas-mode',
      aliases: ['board.create-url-page'],
      enabledWhen: (context) =>
        typeof context.actions.createBud === 'function' &&
        context.subjectSnapshot.insertionPoint !== undefined,
      argsSchema: parseCanvasBudArgs,
      run: (args, context) => {
        if (!context.actions.createBud) {
          throw new Error('Canvas context cannot create buds.')
        }

        return context.actions.createBud(args)
      }
    },
    flow: {
      start: async (context) => {
        if (!context.subjectSnapshot.insertionPoint) {
          return { type: 'cancel' as const }
        }

        return {
          type: 'step' as const,
          step: createCanvasUrlPageInputStep()
        }
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Add URL Page',
        subtitle: 'Paste a URL and create a web page bud',
        icon: Globe
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.linkBoard,
      modeScope: 'canvas-mode',
      aliases: ['board.link-subboard'],
      enabledWhen: (context) =>
        typeof context.actions.createBud === 'function' &&
        context.subjectSnapshot.insertionPoint !== undefined &&
        (context.subjectSnapshot.linkableBoards?.length ?? 0) > 0,
      argsSchema: parseCanvasBudArgs,
      run: (args, context) => {
        if (!context.actions.createBud) {
          throw new Error('Canvas context cannot create buds.')
        }

        return context.actions.createBud(args)
      }
    },
    flow: {
      start: async (context) => {
        if (!context.subjectSnapshot.insertionPoint) {
          return { type: 'cancel' as const }
        }

        return {
          type: 'step' as const,
          step: createCanvasLinkBoardListStep(context.subjectSnapshot.linkableBoards ?? [])
        }
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Link Board',
        subtitle: 'Link another workspace board as a bud',
        icon: PanelsTopLeft
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.deleteSelection,
      modeScope: 'canvas-mode',
      aliases: ['selection.remove'],
      enabledWhen: (context) =>
        typeof context.actions.deleteSelection === 'function' &&
        context.subjectSnapshot.selectionShape !== 'none',
      run: (_args, context) => {
        if (!context.actions.deleteSelection) {
          throw new Error('Canvas context cannot delete the current selection.')
        }

        return context.actions.deleteSelection()
      },
      undo: (_args, result) => {
        const { deletedNodes, deletedEdges } = result as import('./types').CanvasDeletedSelection
        const store = useBoardStore.getState()
        for (const node of deletedNodes) {
          if (node.kind !== 'cluster') {
            store.addNode(node)
          }
        }
        for (const edge of deletedEdges) {
          store.addEdge(edge)
        }
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Delete Selection',
        subtitle: 'Remove the currently selected nodes or edges'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.bloomSelection,
      modeScope: 'canvas-mode',
      aliases: ['node.open'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canBloomSelection === true &&
        typeof context.actions.bloomSelection === 'function',
      run: async (_args, context) => {
        if (!context.actions.bloomSelection) {
          throw new Error('Canvas context cannot bloom the current selection.')
        }

        await context.actions.bloomSelection()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Bloom Selection',
        subtitle: 'Open the selected bloom in its primary renderer'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.openSelectionInNativeEditor,
      modeScope: 'canvas-mode',
      aliases: ['resource.open-file'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canOpenSelectionInNativeEditor === true &&
        typeof context.actions.openSelectionInNativeEditor === 'function',
      run: async (_args, context) => {
        if (!context.actions.openSelectionInNativeEditor) {
          throw new Error('Canvas context cannot open the current selection natively.')
        }

        await context.actions.openSelectionInNativeEditor()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Open Natively',
        subtitle: 'Open the selected resource in the native editor or host app'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.openMaterials,
      modeScope: 'canvas-mode',
      aliases: ['workspace.materials', 'materials'],
      enabledWhen: (context) => typeof context.actions.openMaterials === 'function',
      run: async (_args, context) => {
        if (!context.actions.openMaterials) {
          throw new Error('Canvas context cannot open materials.')
        }

        await context.actions.openMaterials()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Materials',
        subtitle: 'Open the materials window',
        icon: Boxes
      }
    ]
  }
]

const canvasContextualCommands: WhitebloomCommandForContext<CanvasCommandContext>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.linkResources,
      modeScope: 'canvas-mode',
      aliases: ['board.link', 'link-resources'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canLinkResources === true &&
        typeof context.actions.linkResources === 'function',
      run: async (_args, context) => {
        if (!context.actions.linkResources) {
          throw new Error('Canvas context cannot link resources.')
        }

        await context.actions.linkResources()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Link Resources',
        subtitle: 'Link external resources to the board',
        icon: Link2
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.importResources,
      modeScope: 'canvas-mode',
      aliases: ['board.import', 'import-resources'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canImportResources === true &&
        typeof context.actions.importResources === 'function',
      run: async (_args, context) => {
        if (!context.actions.importResources) {
          throw new Error('Canvas context cannot import resources.')
        }

        await context.actions.importResources()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Import Resources',
        subtitle: 'Import files or resources onto the board',
        icon: ArrowDownToLine
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addText,
      modeScope: 'canvas-mode',
      aliases: ['board.text', 'add-text-node'],
      enabledWhen: (context) => typeof context.actions.addTextNode === 'function',
      run: (_args, context) => {
        if (!context.actions.addTextNode) {
          throw new Error('Canvas context cannot add text nodes.')
        }

        return context.actions.addTextNode()
      },
      undo: (_args, result) => {
        useBoardStore.getState().deleteNode((result as { nodeId: string }).nodeId)
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Add Text',
        subtitle: 'Add a text node to the board',
        icon: Type
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.createCluster,
      modeScope: 'canvas-mode',
      aliases: ['board.cluster', 'cluster'],
      enabledWhen: (context) => typeof context.actions.createCluster === 'function',
      run: async (_args, context) => {
        if (!context.actions.createCluster) {
          throw new Error('Canvas context cannot create clusters.')
        }

        await context.actions.createCluster()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Create Cluster',
        subtitle: 'Group selected nodes into a cluster',
        icon: Scan
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.fitCluster,
      modeScope: 'canvas-mode',
      aliases: ['cluster.fit'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canFitCluster === true &&
        typeof context.actions.fitClusterToChildren === 'function',
      run: async (_args, context) => {
        if (!context.actions.fitClusterToChildren) {
          throw new Error('Canvas context cannot fit cluster to children.')
        }

        await context.actions.fitClusterToChildren()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Fit Cluster to Children',
        subtitle: 'Resize the cluster to fit its child nodes'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.toggleClusterAutofit,
      modeScope: 'canvas-mode',
      aliases: ['cluster.autofit'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canToggleClusterAutofit === true &&
        typeof context.actions.toggleClusterAutofit === 'function',
      run: async (_args, context) => {
        if (!context.actions.toggleClusterAutofit) {
          throw new Error('Canvas context cannot toggle cluster autofit.')
        }

        await context.actions.toggleClusterAutofit()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Toggle Cluster Autofit',
        subtitle: 'Enable or disable automatic resizing of the cluster'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.promoteClusterToSubboard,
      modeScope: 'canvas-mode',
      aliases: ['cluster.promote', 'promote-subboard'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canPromoteClusterToSubboard === true &&
        typeof context.actions.openPromoteSubboardModal === 'function',
      run: async (_args, context) => {
        if (!context.actions.openPromoteSubboardModal) {
          throw new Error('Canvas context cannot promote cluster to subboard.')
        }

        await context.actions.openPromoteSubboardModal()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Promote to Subboard',
        subtitle: 'Convert the selected cluster into a subboard'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.toggleTextAutoWidth,
      modeScope: 'canvas-mode',
      aliases: ['node.text.autowidth'],
      enabledWhen: (context) =>
        context.subjectSnapshot.capabilities.canToggleTextAutoWidth === true &&
        typeof context.actions.toggleTextAutoWidth === 'function',
      run: async (_args, context) => {
        if (!context.actions.toggleTextAutoWidth) {
          throw new Error('Canvas context cannot toggle text auto-width.')
        }

        await context.actions.toggleTextAutoWidth()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Toggle Text Auto-Width',
        subtitle: 'Enable or disable automatic width for the selected text node',
        icon: FileText
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addFocusWriter,
      modeScope: 'canvas-mode',
      aliases: ['board.focus-writer', 'add-focus-writer'],
      enabledWhen: (context) => typeof context.actions.addFocusWriterBud === 'function',
      run: async (_args, context) => {
        if (!context.actions.addFocusWriterBud) {
          throw new Error('Canvas context cannot add a Focus Writer bud.')
        }

        await context.actions.addFocusWriterBud()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Add Focus Writer',
        subtitle: 'Add a Focus Writer bud node to the board'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addSchemaBloom,
      modeScope: 'canvas-mode',
      aliases: ['board.schema-bloom', 'add-schema-bloom'],
      enabledWhen: (context) => typeof context.actions.addSchemaBloomBud === 'function',
      run: async (_args, context) => {
        if (!context.actions.addSchemaBloomBud) {
          throw new Error('Canvas context cannot add a Schema Bloom bud.')
        }

        await context.actions.addSchemaBloomBud()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Add Schema Bloom',
        subtitle: 'Add a Schema Bloom bud node to the board',
        icon: Database
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addEdge,
      modeScope: 'canvas-mode',
      enabledWhen: (context) => typeof context.actions.addEdge === 'function',
      run: (args: CanvasAddEdgeCommandArgs, context) => {
        if (!context.actions.addEdge) {
          throw new Error('Canvas context cannot add edges.')
        }

        return context.actions.addEdge(args)
      },
      undo: (_args, result) => {
        useBoardStore.getState().deleteEdge((result as { edgeId: string }).edgeId)
      }
    }
  }
]

type InkAppendStrokeArgs = { binding: InkSurfaceBinding; stroke: InkStroke }

const inkCommands: WhitebloomCommandForContext<CanvasCommandContext>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.inkAppendStroke,
      modeScope: ['canvas-mode', 'module:com.whitebloom.pdf'] as const,
      enabledWhen: (context) => typeof context.actions.appendInkStroke === 'function',
      run: async (args: InkAppendStrokeArgs, context) => {
        if (!context.actions.appendInkStroke) {
          throw new Error('Canvas context cannot append ink strokes.')
        }

        return context.actions.appendInkStroke(args.binding, args.stroke)
      },
      undo: async (args: InkAppendStrokeArgs, result, context) => {
        const { strokeId } = result as { strokeId: string }
        await context.actions.removeInkStroke?.(args.binding, strokeId)
      }
    }
  }
]

const historyCommands: WhitebloomCommandForContext<CanvasCommandContext>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.historyUndo,
      modeScope: ['canvas-mode', 'module:com.whitebloom.pdf'] as const,
      aliases: ['undo'],
      enabledWhen: (context) => {
        const { undoTop } = useHistoryStore.getState().peek(context.majorMode)
        return undoTop !== undefined
      },
      run: (_, context) => {
        const entry = useHistoryStore.getState().undo(context.majorMode)
        if (entry) void entry.undoFn()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Undo',
        subtitle: 'Reverse the last action'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.historyRedo,
      modeScope: ['canvas-mode', 'module:com.whitebloom.pdf'] as const,
      aliases: ['redo'],
      enabledWhen: (context) => {
        const { redoTop } = useHistoryStore.getState().peek(context.majorMode)
        return redoTop !== undefined
      },
      run: (_, context) => {
        const entry = useHistoryStore.getState().redo(context.majorMode)
        if (entry) void entry.redoFn()
      }
    },
    presentations: [
      {
        mode: 'canvas-mode',
        title: 'Redo',
        subtitle: 'Re-apply the last undone action'
      }
    ]
  }
]

const arrangementsCommands: WhitebloomCommandForContext<ArrangementsCommandContext>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.createBin,
      aliases: ['arrangements.bin.new'],
      enabledWhen: (context) => typeof context.actions.createBin === 'function',
      argsSchema: parseArrangementsCreateBinArgs,
      run: async (args, context) => {
        if (!context.actions.createBin) {
          throw new Error('Arrangements context cannot create bins.')
        }

        return context.actions.createBin(args)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.createBinAtCenter,
      aliases: ['arrangements.bin.create-from-palette'],
      enabledWhen: (context) => typeof context.actions.createBinAtViewportCenter === 'function',
      argsSchema: {
        validate: (args: unknown): args is { name: string } =>
          isRecord(args) && typeof args.name === 'string'
      },
      run: async (args, context) => {
        if (!context.actions.createBinAtViewportCenter) {
          throw new Error('Arrangements context cannot create bins at the viewport center.')
        }

        return context.actions.createBinAtViewportCenter(args.name)
      }
    },
    flow: {
      start: async () => ({
        type: 'step' as const,
        step: createArrangeCreateBinInputStep()
      })
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.renameBin,
      aliases: ['arrangements.bin.edit-name'],
      enabledWhen: (context) =>
        typeof context.actions.renameBin === 'function' &&
        (context.subjectSnapshot.availableBins?.length ?? 0) > 0,
      argsSchema: parseRenameBinArgs,
      run: async (args, context) => {
        if (!context.actions.renameBin) {
          throw new Error('Arrangements context cannot rename bins.')
        }

        await context.actions.renameBin(args.binId, args.name)
      }
    },
    flow: {
      start: async (context) => ({
        type: 'step' as const,
        step: createRenameBinListStep(context.subjectSnapshot.availableBins ?? [])
      })
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.deleteBin,
      aliases: ['arrangements.bin.remove'],
      enabledWhen: (context) =>
        typeof context.actions.deleteBin === 'function' &&
        (context.subjectSnapshot.availableBins?.length ?? 0) > 0,
      argsSchema: parseDeleteBinArgs,
      run: async (args, context) => {
        if (!context.actions.deleteBin) {
          throw new Error('Arrangements context cannot delete bins.')
        }

        await context.actions.deleteBin(args.binId)
      }
    },
    flow: {
      start: async (context) => ({
        type: 'step' as const,
        step: createDeleteBinListStep(context.subjectSnapshot.availableBins ?? [])
      })
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.assignMaterialsToBin,
      aliases: ['arrangements.material.move-to-bin'],
      enabledWhen: (context) =>
        typeof context.actions.assignMaterialsToBin === 'function' &&
        context.subjectSnapshot.selection.materialKeys.length > 0,
      argsSchema: parseAssignMaterialsToBinArgs,
      run: async (args, context) => {
        if (!context.actions.assignMaterialsToBin) {
          throw new Error('Arrangements context cannot assign materials to bins.')
        }

        if (!context.subjectSnapshot.availableBinIds.includes(args.binId)) {
          throw new Error(`Unknown arrangements bin: ${args.binId}`)
        }

        await context.actions.assignMaterialsToBin(args.materialKeys, args.binId)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.removeMaterialsFromBin,
      aliases: ['arrangements.material.unbin'],
      enabledWhen: (context) =>
        typeof context.actions.removeMaterialsFromBin === 'function' &&
        context.subjectSnapshot.selection.materialKeys.length > 0,
      argsSchema: parseRemoveMaterialsFromBinArgs,
      run: async (args, context) => {
        if (!context.actions.removeMaterialsFromBin) {
          throw new Error('Arrangements context cannot remove materials from bins.')
        }

        await context.actions.removeMaterialsFromBin(args.materialKeys)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.includeMaterialsInSet,
      aliases: ['arrangements.material.add-to-set'],
      enabledWhen: (context) =>
        typeof context.actions.includeMaterialsInSet === 'function' &&
        context.subjectSnapshot.selection.materialKeys.length > 0,
      argsSchema: parseIncludeMaterialsInSetArgs,
      run: async (args, context) => {
        if (!context.actions.includeMaterialsInSet) {
          throw new Error('Arrangements context cannot include materials in sets.')
        }

        if (!context.subjectSnapshot.availableSetIds.includes(args.setId)) {
          throw new Error(`Unknown arrangements set: ${args.setId}`)
        }

        await context.actions.includeMaterialsInSet(args.materialKeys, args.setId)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.sendMaterialsToTrash,
      aliases: ['arrangements.material.trash'],
      enabledWhen: (context) =>
        typeof context.actions.sendMaterialsToTrash === 'function' &&
        context.subjectSnapshot.selection.materialKeys.length > 0,
      argsSchema: parseSendMaterialsToTrashArgs,
      run: async (args, context) => {
        if (!context.actions.sendMaterialsToTrash) {
          throw new Error('Arrangements context cannot send materials to trash.')
        }

        await context.actions.sendMaterialsToTrash(args.materialKeys)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.moveMaterialsToDesktop,
      aliases: ['arrangements.material.move-to-desktop'],
      enabledWhen: (context) =>
        typeof context.actions.moveMaterialsToDesktop === 'function' &&
        context.subjectSnapshot.selection.materialKeys.length > 0,
      argsSchema: parseMoveMaterialsToDesktopArgs,
      run: async (args, context) => {
        if (!context.actions.moveMaterialsToDesktop) {
          throw new Error('Arrangements context cannot move materials to the desktop.')
        }

        await context.actions.moveMaterialsToDesktop(args.items)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.createRootSet,
      aliases: ['arrangements.set.create'],
      enabledWhen: (context) => typeof context.actions.createRootSet === 'function',
      argsSchema: parseCreateRootSetArgs,
      run: async (args, context) => {
        if (!context.actions.createRootSet) {
          throw new Error('Arrangements context cannot create root sets.')
        }

        return context.actions.createRootSet(args.name)
      }
    },
    flow: {
      start: async () => ({
        type: 'step' as const,
        step: createRootSetInputStep()
      })
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.renameSet,
      aliases: ['arrangements.set.edit-name'],
      enabledWhen: (context) =>
        typeof context.actions.renameSet === 'function' &&
        (context.subjectSnapshot.availableSets?.length ?? 0) > 0,
      argsSchema: parseRenameSetArgs,
      run: async (args, context) => {
        if (!context.actions.renameSet) {
          throw new Error('Arrangements context cannot rename sets.')
        }

        await context.actions.renameSet(args.setId, args.name)
      }
    },
    flow: {
      start: async (context) => ({
        type: 'step' as const,
        step: createRenameSetListStep(context.subjectSnapshot.availableSets ?? [])
      })
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.deleteSet,
      aliases: ['arrangements.set.remove'],
      enabledWhen: (context) =>
        typeof context.actions.deleteSet === 'function' &&
        (context.subjectSnapshot.availableSets?.length ?? 0) > 0,
      argsSchema: parseDeleteSetArgs,
      run: async (args, context) => {
        if (!context.actions.deleteSet) {
          throw new Error('Arrangements context cannot delete sets.')
        }

        await context.actions.deleteSet(args.setId)
      }
    },
    flow: {
      start: async (context) => ({
        type: 'step' as const,
        step: createDeleteSetListStep(context.subjectSnapshot.availableSets ?? [])
      })
    }
  }
]

export const whitebloomBuiltinCommandProvider = createBuiltinCommandProvider(
  'builtin:whitebloom-mutations',
  [...canvasCommands, ...canvasContextualCommands, ...inkCommands, ...historyCommands, ...arrangementsCommands]
)

registerCommandProvider(whitebloomBuiltinCommandProvider)
