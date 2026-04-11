import {
  createBuiltinCommandProvider,
  registerCommandProvider
} from './registry'
import { Archive, Boxes, Download, Globe, Layers, PanelsTopLeft, Tag, Trash2 } from 'lucide-react'
import { boardBloomModule } from '../modules/boardbloom'
import { webPageBloomModule } from '../modules/webpagebloom'
import { normalizeWebPageUrl } from '../shared/web-page-url'
import { fetchPageTitle } from '../shared/page-title'
import type {
  ArrangementsAssignMaterialsToBinCommandArgs,
  ArrangementsCommandBin,
  ArrangementsCreateBinCommandArgs,
  ArrangementsCommandSet,
  ArrangementsIncludeMaterialsInSetCommandArgs,
  ArrangementsMoveMaterialsToDesktopCommandArgs,
  ArrangementsSendMaterialsToTrashCommandArgs,
  CanvasCommandContext,
  CanvasCreateBudCommandArgs,
  CanvasCreateShapeCommandArgs,
  CanvasLinkableBoard,
  WhitebloomCommandForContext
} from './types'
import type { ShapePreset } from '@renderer/shared/types'

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
    openArrangements: 'arrangements.open',
    openMaterials: 'arrangements.open-materials'
  },
  arrangements: {
    createBin: 'arrangements.bin.create',
    createBinAtCenter: 'arrangements.bin.create-at-center',
    renameBin: 'arrangements.bin.rename',
    deleteBin: 'arrangements.bin.delete',
    assignMaterialsToBin: 'arrangements.material.assign-to-bin',
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

function parseSendMaterialsToTrashArgs(
  args: unknown
): ArrangementsSendMaterialsToTrashCommandArgs {
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
          if (!context.insertionPoint) return { type: 'cancel' as const }
          return {
            type: 'submit' as const,
            args: {
              position: context.insertionPoint,
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
          if (!context.insertionPoint) return { type: 'cancel' as const }
          interaction.setBusyState({ title: 'Fetching page title', label: resource })
          const title = await fetchPageTitle(resource, interaction.signal)
          if (interaction.signal.aborted) return { type: 'cancel' as const }
          return {
            type: 'submit' as const,
            args: {
              position: context.insertionPoint,
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
      if (!context.insertionPoint) return { type: 'cancel' as const }
      return {
        type: 'submit' as const,
        args: {
          position: context.insertionPoint,
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
      onSelect: (context: { insertionPoint?: { x: number; y: number } }) => {
        if (!context.insertionPoint) {
          return { type: 'cancel' as const }
        }

        return {
          type: 'submit' as const,
          args: {
            position: context.insertionPoint,
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
      subtitle: setNode.depth > 0 ? `Remove nested set at depth ${setNode.depth}` : 'Remove root set',
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

const canvasCommands: WhitebloomCommandForContext<'canvas'>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addBud,
      aliases: ['board.create-bud'],
      when: (context) => typeof context.actions.createBud === 'function',
      argsSchema: parseCanvasBudArgs,
      run: (args, context) => {
        if (!context.actions.createBud) {
          throw new Error('Canvas context cannot create buds.')
        }

        return context.actions.createBud(args)
      }
    }
  },
  ...CANVAS_SHAPE_COMMANDS.map<WhitebloomCommandForContext<'canvas'>>(({ id, preset }) => ({
    core: {
      id,
      when: (context) =>
        typeof context.actions.createShape === 'function' && context.insertionPoint !== undefined,
      run: async (_args, context) => {
        if (!context.actions.createShape || !context.insertionPoint) {
          throw new Error('Canvas context cannot create shapes.')
        }

        context.actions.createShape({
          position: context.insertionPoint,
          preset
        } satisfies CanvasCreateShapeCommandArgs)
      }
    }
  })),
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.addUrlPage,
      aliases: ['board.create-url-page'],
      when: (context) =>
        typeof context.actions.createBud === 'function' && context.insertionPoint !== undefined,
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
        if (!context.insertionPoint) {
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
        context: 'canvas',
        title: 'Add URL Page',
        subtitle: 'Paste a URL and create a web page bud',
        icon: Globe
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.linkBoard,
      aliases: ['board.link-subboard'],
      when: (context) =>
        typeof context.actions.createBud === 'function' &&
        context.insertionPoint !== undefined &&
        (context.linkableBoards?.length ?? 0) > 0,
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
        if (!context.insertionPoint) {
          return { type: 'cancel' as const }
        }

        return {
          type: 'step' as const,
          step: createCanvasLinkBoardListStep(context.linkableBoards ?? [])
        }
      }
    },
    presentations: [
      {
        context: 'canvas',
        title: 'Link Board',
        subtitle: 'Link another workspace board as a bud',
        icon: PanelsTopLeft
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.deleteSelection,
      aliases: ['selection.remove'],
      when: (context) =>
        typeof context.actions.deleteSelection === 'function' &&
        (context.selection.nodeIds.length > 0 || context.selection.edgeIds.length > 0),
      run: (_args, context) => {
        if (!context.actions.deleteSelection) {
          throw new Error('Canvas context cannot delete the current selection.')
        }

        context.actions.deleteSelection()
      }
    },
    presentations: [
      {
        context: 'canvas',
        title: 'Delete Selection',
        subtitle: 'Remove the currently selected nodes or edges'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.bloomSelection,
      aliases: ['node.open'],
      when: (context) =>
        context.capabilities.canBloomSelection === true &&
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
        context: 'canvas',
        title: 'Bloom Selection',
        subtitle: 'Open the selected bloom in its primary renderer'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.openSelectionInNativeEditor,
      aliases: ['resource.open-file'],
      when: (context) =>
        context.capabilities.canOpenSelectionInNativeEditor === true &&
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
        context: 'canvas',
        title: 'Open Natively',
        subtitle: 'Open the selected resource in the native editor or host app'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.openArrangements,
      aliases: ['workspace.open-arrangements'],
      when: (context) => typeof context.actions.openArrangements === 'function',
      run: async (_args, context) => {
        if (!context.actions.openArrangements) {
          throw new Error('Canvas context cannot open arrangements.')
        }

        await context.actions.openArrangements()
      }
    },
    presentations: [
      {
        context: 'canvas',
        title: 'Open Arrangements',
        subtitle: 'Open the arrangements desktop for this workspace',
        icon: PanelsTopLeft,
        hotkey: 'Arr'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.canvas.openMaterials,
      aliases: ['workspace.materials', 'materials'],
      when: (context) => typeof context.actions.openMaterials === 'function',
      run: async (_args, context) => {
        if (!context.actions.openMaterials) {
          throw new Error('Canvas context cannot open materials.')
        }

        await context.actions.openMaterials()
      }
    },
    presentations: [
      {
        context: 'canvas',
        title: 'Materials',
        subtitle: 'Open the materials window',
        icon: Boxes
      }
    ]
  }
]

const arrangementsCommands: WhitebloomCommandForContext<'arrangements'>[] = [
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.createBin,
      aliases: ['arrangements.bin.new'],
      when: (context) => typeof context.actions.createBin === 'function',
      argsSchema: parseArrangementsCreateBinArgs,
      run: async (args, context) => {
        if (!context.actions.createBin) {
          throw new Error('Arrangements context cannot create bins.')
        }

        return context.actions.createBin(args)
      }
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'New Bin',
        subtitle: 'Create a new bin on the arrangements desktop'
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.createBinAtCenter,
      aliases: ['arrangements.bin.create-from-palette'],
      when: (context) => typeof context.actions.createBinAtViewportCenter === 'function',
      argsSchema: {
        validate: (args: unknown): args is { name: string } => isRecord(args) && typeof args.name === 'string'
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
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'New Bin',
        subtitle: 'Name a new bin, then create it at the desktop viewport center',
        icon: Archive
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.renameBin,
      aliases: ['arrangements.bin.edit-name'],
      when: (context) =>
        typeof context.actions.renameBin === 'function' && (context.availableBins?.length ?? 0) > 0,
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
        step: createRenameBinListStep(context.availableBins ?? [])
      })
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'Rename Bin',
        subtitle: 'Choose a bin, then type its new name',
        icon: Archive
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.deleteBin,
      aliases: ['arrangements.bin.remove'],
      when: (context) =>
        typeof context.actions.deleteBin === 'function' && (context.availableBins?.length ?? 0) > 0,
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
        step: createDeleteBinListStep(context.availableBins ?? [])
      })
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'Remove Bin',
        subtitle: 'Choose a bin to remove from Arrangements',
        icon: Trash2
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.assignMaterialsToBin,
      aliases: ['arrangements.material.move-to-bin'],
      when: (context) =>
        typeof context.actions.assignMaterialsToBin === 'function' &&
        context.selection.materialKeys.length > 0,
      argsSchema: parseAssignMaterialsToBinArgs,
      run: async (args, context) => {
        if (!context.actions.assignMaterialsToBin) {
          throw new Error('Arrangements context cannot assign materials to bins.')
        }

        if (!context.availableBinIds.includes(args.binId)) {
          throw new Error(`Unknown arrangements bin: ${args.binId}`)
        }

        await context.actions.assignMaterialsToBin(args.materialKeys, args.binId)
      }
    }
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.includeMaterialsInSet,
      aliases: ['arrangements.material.add-to-set'],
      when: (context) =>
        typeof context.actions.includeMaterialsInSet === 'function' &&
        context.selection.materialKeys.length > 0,
      argsSchema: parseIncludeMaterialsInSetArgs,
      run: async (args, context) => {
        if (!context.actions.includeMaterialsInSet) {
          throw new Error('Arrangements context cannot include materials in sets.')
        }

        if (!context.availableSetIds.includes(args.setId)) {
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
      when: (context) =>
        typeof context.actions.sendMaterialsToTrash === 'function' &&
        context.selection.materialKeys.length > 0,
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
      when: (context) =>
        typeof context.actions.moveMaterialsToDesktop === 'function' &&
        context.selection.materialKeys.length > 0,
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
      when: (context) => typeof context.actions.createRootSet === 'function',
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
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'New Set',
        subtitle: 'Name a new root set in the Sets Island',
        icon: Layers
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.renameSet,
      aliases: ['arrangements.set.edit-name'],
      when: (context) =>
        typeof context.actions.renameSet === 'function' && (context.availableSets?.length ?? 0) > 0,
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
        step: createRenameSetListStep(context.availableSets ?? [])
      })
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'Rename Set',
        subtitle: 'Choose a set, then type its new name',
        icon: Layers
      }
    ]
  },
  {
    core: {
      id: WHITEBLOOM_COMMAND_IDS.arrangements.deleteSet,
      aliases: ['arrangements.set.remove'],
      when: (context) =>
        typeof context.actions.deleteSet === 'function' && (context.availableSets?.length ?? 0) > 0,
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
        step: createDeleteSetListStep(context.availableSets ?? [])
      })
    },
    presentations: [
      {
        context: 'arrangements',
        title: 'Remove Set',
        subtitle: 'Choose a set to remove from Arrangements',
        icon: Trash2
      }
    ]
  }
]

export const whitebloomBuiltinCommandProvider = createBuiltinCommandProvider(
  'builtin:whitebloom-mutations',
  {
    canvas: canvasCommands,
    arrangements: arrangementsCommands
  }
)

registerCommandProvider(whitebloomBuiltinCommandProvider)
