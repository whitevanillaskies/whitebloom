/**
 * Shared Whitebloom ink contract.
 *
 * This file defines the persisted/source-of-truth data model for ink:
 * - workspace catalog (`.ink`)
 * - persistent overlay objects ("Acetates")
 * - surface bindings
 * - coordinate-space-specific stroke samples
 *
 * The Glass Buffer is deliberately absent here because it is transient editor
 * state, not a persisted artifact.
 */

export const CURRENT_INK_VERSION = 1
export const INK_WORKSPACE_INDEX_FILENAME = '.ink'
export const INK_ACETATE_DIRECTORY = 'ink'
export const INK_ACETATE_FILE_EXTENSION = '.inklay'

export type InkAcetateId = string
export type InkTargetId = string
export type InkStrokeId = string

export type InkSurfaceType = 'board' | 'pdf' | 'image' | 'video'
export type InkCoordinateSpace = 'board-world' | 'uv' | 'paged-uv' | 'ranged-uv'

export type InkToolKind = 'pen' | 'highlighter' | 'eraser' | 'shape' | 'text'

export type InkBlendMode = 'normal' | 'multiply'
export type InkLineCap = 'round' | 'square'
export type InkLineJoin = 'round' | 'bevel' | 'miter'

/**
 * Resource URI or board file path used to reopen the authored surface.
 *
 * Examples:
 * - `D:/workspace/boards/Board.wb.json`
 * - `wloc:res/lecture/chapter-02.pdf`
 * - `file:///D:/workspace/res/photo.png`
 */
export type InkSurfaceResource = string

export type InkStrokeStyle = {
  color: string
  width: number
  opacity: number
  blendMode: InkBlendMode
  lineCap: InkLineCap
  lineJoin: InkLineJoin
}

export type InkStrokeDynamics = {
  /**
   * Strength of stroke stabilization in the canonical saved representation.
   * 0 = raw-ish, 1 = heavily stabilized.
   */
  smoothing: number
  /**
   * Capture-time spacing threshold in surface space.
   * Used to avoid storing excessively dense duplicate samples.
   */
  sampleSpacing: number
}

export type InkBoardWorldSample = {
  x: number
  y: number
  pressure: number
  t: number
}

export type InkUvSample = {
  u: number
  v: number
  pressure: number
  t: number
}

export type InkPagedUvSample = {
  pageIndex: number
  u: number
  v: number
  pressure: number
  t: number
}

export type InkRangedUvSample = {
  start: number
  end: number
  u: number
  v: number
  pressure: number
  t: number
}

export type InkStrokeSample =
  | InkBoardWorldSample
  | InkUvSample
  | InkPagedUvSample
  | InkRangedUvSample

export type InkStroke = {
  id: InkStrokeId
  tool: InkToolKind
  style: InkStrokeStyle
  dynamics: InkStrokeDynamics
  samples: InkStrokeSample[]
  createdAt: string
}

/**
 * Surface binding stored inside each Acetate. Acetates are self-describing:
 * they know which kind of surface they target and which coordinate space their
 * strokes are stored in.
 */
export type InkBoardSurfaceBinding = {
  surfaceType: 'board'
  coordinateSpace: 'board-world'
  targetId: InkTargetId
  resource: InkSurfaceResource
}

export type InkPdfSurfaceBinding = {
  surfaceType: 'pdf'
  coordinateSpace: 'paged-uv'
  targetId: InkTargetId
  resource: InkSurfaceResource
}

export type InkImageSurfaceBinding = {
  surfaceType: 'image'
  coordinateSpace: 'uv'
  targetId: InkTargetId
  resource: InkSurfaceResource
}

export type InkVideoSurfaceBinding = {
  surfaceType: 'video'
  coordinateSpace: 'ranged-uv'
  targetId: InkTargetId
  resource: InkSurfaceResource
}

export type InkSurfaceBinding =
  | InkBoardSurfaceBinding
  | InkPdfSurfaceBinding
  | InkImageSurfaceBinding
  | InkVideoSurfaceBinding

export type InkAcetate = {
  version: number
  id: InkAcetateId
  /**
   * Optional user-provided layer name.
   * When absent, the UI can present a generated fallback label.
   */
  name?: string
  target: InkSurfaceBinding
  strokes: InkStroke[]
  createdAt: string
  updatedAt: string
}

/**
 * Catalog summary written to the workspace `.ink` file for quick lookup.
 * The Acetate file remains the source of truth; this is a registry/index.
 */
export type InkAcetateIndexEntry = {
  id: InkAcetateId
  name?: string
  targetId: InkTargetId
  surfaceType: InkSurfaceType
  coordinateSpace: InkCoordinateSpace
  relativePath: string
  createdAt: string
  updatedAt: string
}

export type InkTargetIndexEntry = {
  id: InkTargetId
  surfaceType: InkSurfaceType
  resource: InkSurfaceResource
  acetateIds: InkAcetateId[]
}

export type InkWorkspaceIndex = {
  version: number
  acetates: InkAcetateIndexEntry[]
  targets: InkTargetIndexEntry[]
}

export function createInkTargetId(
  surfaceType: InkSurfaceType,
  resource: InkSurfaceResource
): InkTargetId {
  return `${surfaceType}:${resource.trim()}`
}

export const DEFAULT_INK_STROKE_STYLE: InkStrokeStyle = {
  color: '#111111',
  width: 2,
  opacity: 1,
  blendMode: 'normal',
  lineCap: 'round',
  lineJoin: 'round'
}

export const DEFAULT_INK_STROKE_DYNAMICS: InkStrokeDynamics = {
  smoothing: 0.35,
  sampleSpacing: 0.75
}

export function isBoardWorldStrokeSample(sample: InkStrokeSample): sample is InkBoardWorldSample {
  return 'x' in sample && 'y' in sample
}

export function isUvStrokeSample(sample: InkStrokeSample): sample is InkUvSample {
  return !('pageIndex' in sample) && !('start' in sample) && 'u' in sample && 'v' in sample
}

export function isPagedUvStrokeSample(sample: InkStrokeSample): sample is InkPagedUvSample {
  return 'pageIndex' in sample
}

export function isRangedUvStrokeSample(sample: InkStrokeSample): sample is InkRangedUvSample {
  return 'start' in sample && 'end' in sample
}

export function createEmptyInkWorkspaceIndex(): InkWorkspaceIndex {
  return {
    version: CURRENT_INK_VERSION,
    acetates: [],
    targets: []
  }
}

export function createEmptyInkAcetate(
  id: InkAcetateId,
  target: InkSurfaceBinding,
  nowIso: string
): InkAcetate {
  return {
    version: CURRENT_INK_VERSION,
    id,
    target,
    strokes: [],
    createdAt: nowIso,
    updatedAt: nowIso
  }
}
