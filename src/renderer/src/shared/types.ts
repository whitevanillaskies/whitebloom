export type Position = { x: number; y: number }
export type Size = { w: number; h: number }
export type WidthMode = 'auto' | 'fixed'
export type ClusterColor = 'blue' | 'pink' | 'red' | 'purple' | 'green'
export type ShapePreset =
  | 'rectangle'
  | 'slanted-rectangle'
  | 'diamond'
  | 'ellipse'
  | 'terminator'
  | 'document'

/**
 * Shared named color tokens for vector-rendered board elements.
 * Shapes use both stroke and fill; edges will later reuse the stroke side.
 */
export type VectorColorToken =
  | 'blue'
  | 'pink'
  | 'red'
  | 'purple'
  | 'green'
  | 'neutral'
  | 'foreground'

export type TokenColorValue = { kind: 'token'; value: VectorColorToken }
export type CustomColorValue = { kind: 'custom'; value: string }
/** Reference to a swatch in a named palette. Resolves to the swatch's literal color at render time. */
export type SwatchColorValue = { kind: 'swatch'; paletteId: string; swatchId: string }

/**
 * Three-source canvas color model:
 * - token: semantic theme variable (always available, adapts to theme)
 * - swatch: palette-scoped reference (resolves via palette registry)
 * - custom: arbitrary literal color chosen by the user
 */
export type ColorValue = TokenColorValue | CustomColorValue | SwatchColorValue

export type StrokeStyle = {
  width: number
  color: ColorValue
}

export type FillStyle = {
  color: ColorValue
}

export type TextStyle = {
  color: ColorValue
}

export type StrokedElementStyle = {
  stroke: StrokeStyle
}

export type FilledElementStyle = {
  fill: FillStyle
}

export type FilledStrokedElementStyle = StrokedElementStyle & FilledElementStyle

/**
 * Stroke contract for edges. Dash is required (not optional) when used inside EdgeStyle.
 */
export type EdgeStrokeStyle = StrokeStyle & {
  dash: 'solid' | 'dashed' | 'dotted'
}

/** End-point marker kind for directed edges. */
export type EdgeMarkerKind = 'none' | 'arrow'

/**
 * Persisted edge-label placement along the rendered edge path.
 * `pathPosition` is normalized: 0 = source end, 0.5 = midpoint, 1 = target end.
 */
export type EdgeLabelLayout = {
  pathPosition: number
}

/** Fully structured edge appearance model — replaces the legacy flat style/color fields. */
export type EdgeStyle = {
  stroke: EdgeStrokeStyle
  startMarker: EdgeMarkerKind
  endMarker: EdgeMarkerKind
  labelColor: ColorValue
}

export type ShapeStyle = FilledStrokedElementStyle

export const DEFAULT_SHAPE_STROKE_WIDTH = 1.5
export const DEFAULT_SHAPE_STROKE: StrokeStyle = {
  width: DEFAULT_SHAPE_STROKE_WIDTH,
  color: { kind: 'token', value: 'foreground' }
}

export const DEFAULT_SHAPE_FILL: FillStyle = {
  color: { kind: 'custom', value: 'transparent' }
}

export const DEFAULT_CANVAS_TEXT: TextStyle = {
  color: { kind: 'token', value: 'foreground' }
}

export const DEFAULT_SHAPE_STYLE: FilledStrokedElementStyle = {
  stroke: DEFAULT_SHAPE_STROKE,
  fill: DEFAULT_SHAPE_FILL
}

export const DEFAULT_EDGE_STROKE_WIDTH = 1.5
export const DEFAULT_EDGE_STROKE: EdgeStrokeStyle = {
  width: DEFAULT_EDGE_STROKE_WIDTH,
  color: { kind: 'token', value: 'foreground' },
  dash: 'solid'
}

export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  stroke: DEFAULT_EDGE_STROKE,
  startMarker: 'none',
  endMarker: 'arrow',
  labelColor: { kind: 'token', value: 'foreground' }
}

export const DEFAULT_EDGE_LABEL_LAYOUT: EdgeLabelLayout = {
  pathPosition: 0.5
}

/**
 * Normalize a BoardEdge into a complete EdgeStyle.
 * Handles both new boards (edgeStyle present) and legacy boards (flat style/color fields).
 */
export function normalizeEdgeStyle(
  edge: Pick<BoardEdge, 'style' | 'color' | 'edgeStyle'>
): EdgeStyle {
  if (edge.edgeStyle) {
    return mergeEdgeStyle(DEFAULT_EDGE_STYLE, edge.edgeStyle)
  }
  const stroke: EdgeStrokeStyle = { ...DEFAULT_EDGE_STROKE }
  if (edge.color) stroke.color = { kind: 'custom', value: edge.color }
  if (edge.style === 'dashed') stroke.dash = 'dashed'
  else if (edge.style === 'dotted') stroke.dash = 'dotted'
  return { ...DEFAULT_EDGE_STYLE, stroke }
}

export function normalizeEdgeLabelLayout(edge: Pick<BoardEdge, 'labelLayout'>): EdgeLabelLayout {
  const pathPosition = edge.labelLayout?.pathPosition

  if (typeof pathPosition !== 'number' || Number.isNaN(pathPosition)) {
    return DEFAULT_EDGE_LABEL_LAYOUT
  }

  return {
    pathPosition: Math.min(Math.max(pathPosition, 0), 1)
  }
}

/**
 * Merge a partial ShapeStyle patch onto a complete base style.
 * Nested stroke/fill fields are merged structurally so callers can patch
 * width or color independently without rebuilding the full style object.
 */
export function mergeShapeStyle(base: ShapeStyle, patch: Partial<ShapeStyle>): ShapeStyle {
  return {
    stroke: {
      ...base.stroke,
      ...(patch.stroke ?? {})
    },
    fill: {
      ...base.fill,
      ...(patch.fill ?? {})
    }
  }
}

/**
 * Merge a partial EdgeStyle patch onto a complete base style.
 * Nested stroke fields are merged structurally so callers can patch dash,
 * width, or color independently without rebuilding the whole object.
 */
export function mergeEdgeStyle(base: EdgeStyle, patch: Partial<EdgeStyle>): EdgeStyle {
  return {
    stroke: {
      ...base.stroke,
      ...(patch.stroke ?? {})
    },
    startMarker: patch.startMarker ?? base.startMarker,
    endMarker: patch.endMarker ?? base.endMarker,
    labelColor: patch.labelColor ?? base.labelColor
  }
}

export function tokenColor(value: VectorColorToken): TokenColorValue {
  return { kind: 'token', value }
}

export function customColor(value: string): CustomColorValue {
  return { kind: 'custom', value }
}

export type ShapeNodeData = {
  preset: ShapePreset
  style: ShapeStyle
}

export const CURRENT_WORKSPACE_CONFIG_VERSION = 1
export const CURRENT_BOARD_VERSION = 3

/**
 * Canonical workspace-local URI form is `wloc:resource/path`.
 * Other supported URI families are `file:///absolute/path` and `https://...`.
 */
export type ResourceUri = string

export type WorkspaceConfig = {
  version: number
  name?: string
  brief?: string
}

export type Workspace = {
  config: WorkspaceConfig
  rootPath: string
  boards: string[]
}

type BaseBoardNode = {
  id: string
  /** Module id for concrete-typed buds; null for void-typed buds (no handler — open with OS default). */
  position: Position
  size: Size
  created: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  label?: string
  content?: string // Lexical EditorState JSON
  plain?: string // Plain-text mirror of content for agents/LLMs
  widthMode?: WidthMode
  wrapWidth?: number | null
  resource?: string
}

export type BudNode = BaseBoardNode & {
  kind: 'bud'
  type: string | null
}

export type TextLeafNode = BaseBoardNode & {
  kind: 'leaf'
  type: 'text'
}

export type ShapeLeafNode = BaseBoardNode & {
  kind: 'leaf'
  type: 'shape'
  shape: ShapeNodeData
}

export type LeafNode = TextLeafNode | ShapeLeafNode

export type ClusterNode = BaseBoardNode & {
  kind: 'cluster'
  type: null
  brief?: string
  children: string[]
  color: ClusterColor
  autofitToContents?: boolean
}

export type BoardNode = BudNode | LeafNode | ClusterNode

export type BoardEdge = {
  id: string
  from: string
  to: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
  /** Optional persisted label placement along the rendered edge path. */
  labelLayout?: EdgeLabelLayout
  /** @deprecated Use edgeStyle.stroke.dash instead. Kept for backward compat with legacy boards. */
  style?: 'solid' | 'dashed' | 'dotted'
  /** @deprecated Use edgeStyle.stroke.color instead. Kept for backward compat with legacy boards. */
  color?: string
  /** Structured edge appearance. Takes precedence over legacy style/color when present. */
  edgeStyle?: EdgeStyle
}

export type BoardViewport = { x: number; y: number; zoom: number }

export type Board = {
  version: number
  transient?: true
  // Board-scoped display label (distinct from WorkspaceConfig.name).
  name?: string
  // Board-scoped agent context (distinct from WorkspaceConfig.brief).
  brief?: string
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport?: BoardViewport
}

export function isClusterNode(node: BoardNode): node is ClusterNode {
  return node.kind === 'cluster'
}

export function isTextLeafNode(node: BoardNode): node is LeafNode & { kind: 'leaf'; type: 'text' } {
  return node.kind === 'leaf' && node.type === 'text'
}

export function isShapeLeafNode(node: BoardNode): node is ShapeLeafNode {
  return node.kind === 'leaf' && node.type === 'shape'
}

/** Create a minimal Lexical EditorState JSON for a plain-text string. */
export function makeLexicalContent(text: string): string {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [
            { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1
        }
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1
    }
  })
}

type LexicalJsonNode = {
  type?: string
  text?: string
  children?: LexicalJsonNode[]
}

const BLOCK_NODE_TYPES = new Set(['paragraph', 'heading', 'quote', 'listitem'])

function collectLexicalText(node: LexicalJsonNode | undefined): string {
  if (!node) return ''

  if (node.type === 'text') {
    return node.text ?? ''
  }

  if (!Array.isArray(node.children)) {
    return ''
  }

  return node.children.map((child) => collectLexicalText(child)).join('')
}

function collectLexicalPlainText(node: LexicalJsonNode | undefined): string {
  if (!node) return ''

  if (node.type === 'text') {
    return node.text ?? ''
  }

  if (node.type === 'linebreak') {
    return '\n'
  }

  if (!Array.isArray(node.children)) {
    return ''
  }

  const text = node.children.map((child) => collectLexicalPlainText(child)).join('')
  if (text.length === 0) return ''

  return BLOCK_NODE_TYPES.has(node.type ?? '') ? `${text}\n` : text
}

/** Convert Lexical EditorState JSON into plain text for machine-friendly reading. */
export function lexicalContentToPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content) as { root?: LexicalJsonNode }
    return collectLexicalPlainText(parsed.root)
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()
  } catch {
    return ''
  }
}

/** Return true when a Lexical EditorState JSON has no non-whitespace text content. */
export function isLexicalContentEmpty(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { root?: LexicalJsonNode }
    const plainText = collectLexicalText(parsed.root)
    return plainText.trim().length === 0
  } catch {
    // Treat malformed content as non-empty so we do not destroy user data.
    return false
  }
}
