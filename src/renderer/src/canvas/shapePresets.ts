import type { ShapePreset, Size } from '@renderer/shared/types'

export type ShapeLabelBox = {
  x: number
  y: number
  width: number
  height: number
}

export type ShapeConnectionSide = 'top' | 'left' | 'bottom' | 'right'
export type ShapeConnectionRole = 'source' | 'target' | 'both'
export type ShapeConnectionModel = 'cardinal' | 'preset-aware'

export type ShapeConnectionAnchor = {
  /**
   * Stable per-preset port id. Today we use the four cardinal ids so the
   * current handle wiring remains simple; later this can hold richer named
   * ports such as `approve`, `reject`, `yes`, `no`, or `input-1`.
   */
  id: string
  side: ShapeConnectionSide
  role: ShapeConnectionRole
  x: number
  y: number
}

export type ShapeRenderContext = {
  width: number
  height: number
  stroke: string
  fill: string
  strokeWidth: number
  selected: boolean
}

type ShapeGeometryContext = Pick<ShapeRenderContext, 'height' | 'strokeWidth' | 'width'>

export type ShapePrimitive =
  | {
      kind: 'rect'
      x: number
      y: number
      width: number
      height: number
      rx?: number
      ry?: number
      fill: string
      stroke: string
      strokeWidth: number
    }
  | {
      kind: 'ellipse'
      cx: number
      cy: number
      rx: number
      ry: number
      fill: string
      stroke: string
      strokeWidth: number
    }
  | {
      kind: 'polygon'
      points: string
      fill: string
      stroke: string
      strokeWidth: number
    }
  | {
      kind: 'path'
      d: string
      fill: string
      stroke: string
      strokeWidth: number
    }

export type ShapePresetDefinition = {
  id: ShapePreset
  displayName: string
  defaultSize: Size
  minSize: Size
  /**
   * Omit for the common case where width and height may change independently.
   * Set to true only for presets that must preserve aspect ratio.
   */
  forbidsNonUniformScale?: true
  /**
   * Documents whether this preset is still using the basic four-cardinal handle
   * model or has moved to a richer preset-aware port layout.
   */
  connectionModel: ShapeConnectionModel
  renderShape: (context: ShapeRenderContext) => ShapePrimitive[]
  getLabelBox: (context: ShapeGeometryContext) => ShapeLabelBox
  getConnectionAnchors: (context: ShapeGeometryContext) => ShapeConnectionAnchor[]
}

type Bounds = {
  x0: number
  y0: number
  x1: number
  y1: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function getStrokeBounds({ width, height, strokeWidth }: ShapeGeometryContext): Bounds {
  const inset = Math.max(1, strokeWidth) / 2
  return {
    x0: inset,
    y0: inset,
    x1: Math.max(inset, width - inset),
    y1: Math.max(inset, height - inset),
    width: Math.max(0, width - inset * 2),
    height: Math.max(0, height - inset * 2)
  }
}

function createCardinalAnchors(context: ShapeGeometryContext, input?: {
  topX?: number
  leftY?: number
  bottomX?: number
  rightY?: number
}): ShapeConnectionAnchor[] {
  const bounds = getStrokeBounds(context)
  return [
    { id: 'top', side: 'top', role: 'target', x: input?.topX ?? context.width / 2, y: bounds.y0 },
    { id: 'left', side: 'left', role: 'target', x: bounds.x0, y: input?.leftY ?? context.height / 2 },
    { id: 'bottom', side: 'bottom', role: 'source', x: input?.bottomX ?? context.width / 2, y: bounds.y1 },
    { id: 'right', side: 'right', role: 'source', x: bounds.x1, y: input?.rightY ?? context.height / 2 }
  ]
}

function getParallelogramOffset({ width, height, strokeWidth }: ShapeGeometryContext): number {
  const bounds = getStrokeBounds({ width, height, strokeWidth })
  const maxOffset = Math.max(10, Math.min(bounds.width * 0.28, bounds.height * 0.5))
  return clamp(bounds.width * 0.14, Math.min(10, maxOffset), maxOffset)
}

function getRectangleLabelBox({ width, height }: ShapeGeometryContext): ShapeLabelBox {
  return {
    x: 12,
    y: 12,
    width: Math.max(0, width - 24),
    height: Math.max(0, height - 24)
  }
}

const SHAPE_PRESET_DEFINITIONS = [
  {
    id: 'rectangle',
    displayName: 'Rectangle',
    defaultSize: { w: 180, h: 100 },
    minSize: { w: 80, h: 48 },
    connectionModel: 'cardinal',
    renderShape: ({ width, height, fill, stroke, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      return [
        {
          kind: 'rect',
          x: bounds.x0,
          y: bounds.y0,
          width: bounds.width,
          height: bounds.height,
          fill,
          stroke,
          strokeWidth
        }
      ]
    },
    getLabelBox: getRectangleLabelBox,
    getConnectionAnchors: (context) => createCardinalAnchors(context)
  },
  {
    id: 'slanted-rectangle',
    displayName: 'Slanted Rectangle',
    defaultSize: { w: 200, h: 110 },
    minSize: { w: 96, h: 56 },
    connectionModel: 'cardinal',
    renderShape: ({ width, height, fill, stroke, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      const offset = getParallelogramOffset({ width, height, strokeWidth })
      return [
        {
          kind: 'polygon',
          points: [
            `${bounds.x0 + offset},${bounds.y0}`,
            `${bounds.x1},${bounds.y0}`,
            `${bounds.x1 - offset},${bounds.y1}`,
            `${bounds.x0},${bounds.y1}`
          ].join(' '),
          fill,
          stroke,
          strokeWidth
        }
      ]
    },
    getLabelBox: (context) => {
      const offset = getParallelogramOffset(context)
      return {
        x: Math.round(offset * 0.55) + 10,
        y: 12,
        width: Math.max(0, context.width - Math.round(offset * 1.1) - 20),
        height: Math.max(0, context.height - 24)
      }
    },
    getConnectionAnchors: (context) => {
      const offset = getParallelogramOffset(context)
      return createCardinalAnchors(context, {
        topX: context.width / 2 + offset / 2,
        bottomX: context.width / 2 - offset / 2
      })
    }
  },
  {
    id: 'diamond',
    displayName: 'Diamond',
    defaultSize: { w: 160, h: 120 },
    minSize: { w: 80, h: 80 },
    connectionModel: 'cardinal',
    renderShape: ({ width, height, fill, stroke, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      return [
        {
          kind: 'polygon',
          points: [
            `${width / 2},${bounds.y0}`,
            `${bounds.x1},${height / 2}`,
            `${width / 2},${bounds.y1}`,
            `${bounds.x0},${height / 2}`
          ].join(' '),
          fill,
          stroke,
          strokeWidth
        }
      ]
    },
    getLabelBox: ({ width, height }) => ({
      x: width * 0.22,
      y: height * 0.22,
      width: Math.max(0, width * 0.56),
      height: Math.max(0, height * 0.56)
    }),
    getConnectionAnchors: (context) => createCardinalAnchors(context)
  },
  {
    id: 'ellipse',
    displayName: 'Ellipse',
    defaultSize: { w: 180, h: 110 },
    minSize: { w: 72, h: 72 },
    connectionModel: 'cardinal',
    renderShape: ({ width, height, fill, stroke, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      return [
        {
          kind: 'ellipse',
          cx: width / 2,
          cy: height / 2,
          rx: bounds.width / 2,
          ry: bounds.height / 2,
          fill,
          stroke,
          strokeWidth
        }
      ]
    },
    getLabelBox: ({ width, height }) => ({
      x: width * 0.16,
      y: height * 0.18,
      width: Math.max(0, width * 0.68),
      height: Math.max(0, height * 0.64)
    }),
    getConnectionAnchors: (context) => createCardinalAnchors(context)
  },
  {
    id: 'terminator',
    displayName: 'Terminator',
    defaultSize: { w: 200, h: 96 },
    minSize: { w: 96, h: 48 },
    connectionModel: 'cardinal',
    renderShape: ({ width, height, fill, stroke, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      const radius = clamp(bounds.height / 2, 12, Math.max(12, bounds.width / 3))
      return [
        {
          kind: 'rect',
          x: bounds.x0,
          y: bounds.y0,
          width: bounds.width,
          height: bounds.height,
          rx: radius,
          ry: radius,
          fill,
          stroke,
          strokeWidth
        }
      ]
    },
    getLabelBox: ({ width, height }) => {
      const sideInset = Math.min(height * 0.35, width * 0.18)
      return {
        x: sideInset,
        y: 12,
        width: Math.max(0, width - sideInset * 2),
        height: Math.max(0, height - 24)
      }
    },
    getConnectionAnchors: (context) => createCardinalAnchors(context)
  },
  {
    id: 'document',
    displayName: 'Document',
    defaultSize: { w: 180, h: 120 },
    minSize: { w: 88, h: 64 },
    connectionModel: 'cardinal',
    renderShape: ({ width, height, fill, stroke, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      const waveDepth = clamp(bounds.height * 0.12, 6, Math.min(16, bounds.height * 0.22))
      const baseY = bounds.y1 - waveDepth
      const curveX1 = bounds.x1 - bounds.width * 0.25
      const curveX2 = bounds.x0 + bounds.width * 0.5
      const curveX3 = bounds.x0 + bounds.width * 0.25
      const d = [
        `M ${bounds.x0} ${bounds.y0}`,
        `H ${bounds.x1}`,
        `V ${baseY}`,
        `Q ${curveX1} ${bounds.y1 + waveDepth * 0.45} ${curveX2} ${baseY}`,
        `Q ${curveX3} ${bounds.y1 - waveDepth * 0.1} ${bounds.x0} ${baseY}`,
        'Z'
      ].join(' ')

      return [
        {
          kind: 'path',
          d,
          fill,
          stroke,
          strokeWidth
        }
      ]
    },
    getLabelBox: ({ width, height, strokeWidth }) => {
      const bounds = getStrokeBounds({ width, height, strokeWidth })
      const waveDepth = clamp(bounds.height * 0.12, 6, Math.min(16, bounds.height * 0.22))
      return {
        x: 12,
        y: 12,
        width: Math.max(0, width - 24),
        height: Math.max(0, height - waveDepth - 20)
      }
    },
    getConnectionAnchors: (context) => createCardinalAnchors(context)
  }
] satisfies ShapePresetDefinition[]

const SHAPE_PRESET_MAP = new Map<ShapePreset, ShapePresetDefinition>(
  SHAPE_PRESET_DEFINITIONS.map((definition) => [definition.id, definition])
)

export function getShapePresetDefinition(preset: ShapePreset): ShapePresetDefinition {
  const definition = SHAPE_PRESET_MAP.get(preset)
  if (!definition) {
    throw new Error(`Unknown shape preset: ${preset}`)
  }
  return definition
}

export function getAllShapePresetDefinitions(): ShapePresetDefinition[] {
  return SHAPE_PRESET_DEFINITIONS
}

export function supportsNonUniformScale(preset: ShapePreset): boolean {
  return getShapePresetDefinition(preset).forbidsNonUniformScale !== true
}
