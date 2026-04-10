import {
  createBuiltinCommandProvider,
  registerCommandProvider
} from './registry'
import type {
  ArrangementsAssignMaterialsToBinCommandArgs,
  ArrangementsCreateBinCommandArgs,
  ArrangementsIncludeMaterialsInSetCommandArgs,
  ArrangementsMoveMaterialsToDesktopCommandArgs,
  ArrangementsSendMaterialsToTrashCommandArgs,
  CanvasCreateBudCommandArgs,
  WhitebloomCommandForContext
} from './types'

export const WHITEBLOOM_COMMAND_IDS = {
  canvas: {
    addBud: 'board.add-bud',
    deleteSelection: 'selection.delete',
    bloomSelection: 'node.bloom',
    openSelectionInNativeEditor: 'resource.open-native'
  },
  arrangements: {
    createBin: 'arrangements.bin.create',
    assignMaterialsToBin: 'arrangements.material.assign-to-bin',
    includeMaterialsInSet: 'arrangements.material.include-in-set',
    sendMaterialsToTrash: 'arrangements.material.send-to-trash',
    moveMaterialsToDesktop: 'arrangements.material.move-to-desktop'
  }
} as const

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
