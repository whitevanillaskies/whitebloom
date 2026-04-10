import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  ConnectionMode,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  useReactFlow,
  MiniMap,
  MarkerType as RFMarkerType
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import { useBoardStore } from '@renderer/stores/board'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { TextNode } from './TextNode'
import { BudNode } from './BudNode'
import { ShapeNode } from './ShapeNode'
import { ClusterNode } from './ClusterNode'
import type { ClusterData, ClusterIndicator, ClusterSpringResize } from './ClusterNode'
import { ProximityTracker } from './ProximityTracker'
import { WbEdge } from './WbEdge'
import type { WbEdgeData } from './WbEdge'
import { EdgeToolbar } from './EdgeToolbar'
import { ShapeToolbar } from './ShapeToolbar'
import { BloomContext, type ActiveBloom } from './BloomContext'
import { BloomModal } from './BloomModal'
import '../modules/index'
import { dispatchDirectory, dispatchModule, resolveModuleById } from '../modules/registry'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'
import BoardContextBar from '@renderer/components/board-context-bar/BoardContextBar'
import SettingsModal from '@renderer/components/settings-modal/SettingsModal'
import PromoteSubboardModal from '@renderer/components/subboard/PromoteSubboardModal'
import {
  ArrowDownToLine,
  Boxes,
  Circle,
  Database,
  Diamond,
  FileText,
  FolderPlus,
  Globe,
  Link2,
  PanelsTopLeft,
  Scan,
  Settings2,
  Square,
  Trash2,
  Type
} from 'lucide-react'
import { PetalButton, PetalMenu, PetalPalette, PetalPanel } from '@renderer/components/petal'
import type {
  PaletteCommandSession,
  PaletteInputMode,
  PaletteItem,
  PaletteMode,
  PetalMenuItem
} from '@renderer/components/petal'
import { boardBloomModule } from '../modules/boardbloom'
import { focusWriterModule } from '../modules/focus-writer'
import { imageModule } from '../modules/image'
import { videoModule } from '../modules/video'
import { schemaBloomModule } from '../modules/schemabloom'
import { webPageBloomModule } from '../modules/webpagebloom'
import type { WhitebloomModule } from '../modules/types'
import {
  absolutePathToFileUri,
  resourceToImageSrc,
  resourceToMediaSrc
} from '@renderer/shared/resource-url'
import {
  isBoardResource,
  resolveWorkspaceBoardPath,
  toWorkspaceBoardResource
} from '@renderer/shared/board-resource'
import type {
  Board,
  BoardEdge,
  BoardNode,
  BoardViewport,
  ClusterNode as BoardClusterNode
} from '@renderer/shared/types'
import {
  makeLexicalContent,
  lexicalContentToPlainText,
  isClusterNode,
  isShapeLeafNode,
  isTextLeafNode,
  DEFAULT_SHAPE_STYLE,
  normalizeEdgeLabelLayout,
  normalizeEdgeStyle
} from '@renderer/shared/types'
import type { ShapePreset } from '@renderer/shared/types'
import { getShapePresetDefinition } from './shapePresets'
import { resolveCanvasMarkerColor } from './vectorStyles'
import type { Tool } from './tools'
import { planClusterPromotion } from '@renderer/stores/board'
import type { BoardNodeDraft } from '@renderer/stores/board'
import {
  WHITEBLOOM_COMMAND_IDS,
  createCommandExecutionGroupId,
  createCanvasCommandContext,
  executeCommandById,
  type WhitebloomCommandExecutionOptions
} from '@renderer/commands'
import './Canvas.css'

const nodeTypes = { text: TextNode, bud: BudNode, shape: ShapeNode, cluster: ClusterNode }
const edgeTypes = { wb: WbEdge }
const IMAGE_DROP_MAX_VIEWPORT_FRACTION = 0.4
const LARGE_IMPORT_THRESHOLD_BYTES = 50 * 1024 * 1024 // 50 MB
const MATERIAL_MIME = 'application/x-wb-material-key'
const DEFAULT_TEXT_NODE_SIZE = { w: 200, h: 40 }
const DEFAULT_CLUSTER_SIZE = { w: 320, h: 220 }
const CLUSTER_SELECTION_PADDING = 48
const CLUSTER_SPRING_MIN_RESIZE_DELTA = 14
const CLUSTER_SPRING_MAX_RESIZE_DELTA = 240
const CLUSTER_SPRING_CLEANUP_BUFFER_MS = 96
const CLUSTER_EDGE_Z_INDEX = -1
const INTERNAL_CLUSTER_EDGE_Z_INDEX = 5

const WEB_RESOURCE_DROP_ERROR =
  "Can't embed web resources — save the image to your local drive first, then drop it."

function normalizeWebPageUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalizedInput = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(normalizedInput)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

type NodeBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

type ClusterMembershipCue = 'accept' | 'release'
type FlowPosition = { x: number; y: number }
type CanvasContextMenuState = {
  anchor: { x: number; y: number }
  flowPosition: FlowPosition
}
type BudPlacement = {
  resource: string
  moduleType: string | null
  size: { w: number; h: number }
}
type ExternalResourceInput = {
  filePath: string
  fileName: string
  file?: File
  preferredBehavior?: 'link' | 'import'
}

function buildReactFlowMarker(
  markerKind: 'none' | 'arrow',
  color: string,
  strokeWidth: number
): RFEdge['markerEnd'] | undefined {
  if (markerKind === 'none') return undefined

  const markerSize = Math.max(12, Math.round(strokeWidth * 8))
  return {
    type: RFMarkerType.ArrowClosed,
    color,
    width: markerSize,
    height: markerSize,
    strokeWidth: Math.max(1, strokeWidth)
  }
}

function getRenderedNodeBounds(
  nodeId: string,
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }
): NodeBounds | null {
  const nodeElement = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`)
  if (!nodeElement) return null

  const rect = nodeElement.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top })
  const bottomRight = screenToFlowPosition({ x: rect.right, y: rect.bottom })

  return {
    left: topLeft.x,
    top: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y
  }
}

function getDroppedFilePath(file: File & { path?: string }): string {
  try {
    const resolvedPath = window.electron.webUtils.getPathForFile(file)
    if (resolvedPath) return resolvedPath
  } catch {
    // Fall back for Electron versions or environments that still expose File.path.
  }

  return typeof file.path === 'string' ? file.path : ''
}

function hasNativeFileDragPayload(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.files.length > 0) return true
  return Array.from(dataTransfer.types).includes('Files')
}

function getNodeBounds(
  node: Pick<RFNode, 'position' | 'width' | 'height'>,
  fallbackSize?: { w: number; h: number }
): NodeBounds | null {
  const width = typeof node.width === 'number' && node.width > 0 ? node.width : fallbackSize?.w
  const height = typeof node.height === 'number' && node.height > 0 ? node.height : fallbackSize?.h
  if (typeof width !== 'number' || typeof height !== 'number') return null

  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + width,
    bottom: node.position.y + height
  }
}

function getStoredNodeBounds(node: Pick<BoardNode, 'position' | 'size'>): NodeBounds {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + node.size.w,
    bottom: node.position.y + node.size.h
  }
}

function getClusterFrameFromChildBounds(
  childBounds: NodeBounds[],
  padding: number = CLUSTER_SELECTION_PADDING
): { position: FlowPosition; size: { w: number; h: number }; bounds: NodeBounds } | null {
  if (childBounds.length === 0) return null

  const minX = Math.min(...childBounds.map((bounds) => bounds.left))
  const minY = Math.min(...childBounds.map((bounds) => bounds.top))
  const maxX = Math.max(...childBounds.map((bounds) => bounds.right))
  const maxY = Math.max(...childBounds.map((bounds) => bounds.bottom))

  const position = {
    x: Math.round(minX - padding),
    y: Math.round(minY - padding)
  }
  const size = {
    w: Math.round(maxX - minX + padding * 2),
    h: Math.round(maxY - minY + padding * 2)
  }

  return {
    position,
    size,
    bounds: {
      left: position.x,
      top: position.y,
      right: position.x + size.w,
      bottom: position.y + size.h
    }
  }
}

type ClusterFrame = NonNullable<ReturnType<typeof getClusterFrameFromChildBounds>>

function areBoundsEqual(left: NodeBounds, right: NodeBounds): boolean {
  return (
    left.left === right.left &&
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom
  )
}

function buildClusterSpringResize(
  currentBounds: NodeBounds,
  nextBounds: NodeBounds
): Omit<ClusterSpringResize, 'token'> | null {
  const currentWidth = currentBounds.right - currentBounds.left
  const currentHeight = currentBounds.bottom - currentBounds.top
  const nextWidth = nextBounds.right - nextBounds.left
  const nextHeight = nextBounds.bottom - nextBounds.top
  const widthDelta = nextWidth - currentWidth
  const heightDelta = nextHeight - currentHeight
  const maxResizeDelta = Math.max(Math.abs(widthDelta), Math.abs(heightDelta))

  if (maxResizeDelta === 0) return null

  const minDelta = CLUSTER_SPRING_MIN_RESIZE_DELTA
  if (maxResizeDelta < minDelta) return null

  const denominator = Math.max(1, CLUSTER_SPRING_MAX_RESIZE_DELTA - minDelta)
  const normalized = Math.min(1, Math.max(0, (maxResizeDelta - minDelta) / denominator))

  return {
    strength: Number((0.008 + normalized * 0.016).toFixed(4)),
    durationMs: Math.round(170 + normalized * 90)
  }
}

function isBoundsFullyInside(bounds: NodeBounds, clusterBounds: NodeBounds): boolean {
  return (
    bounds.left >= clusterBounds.left &&
    bounds.top >= clusterBounds.top &&
    bounds.right <= clusterBounds.right &&
    bounds.bottom <= clusterBounds.bottom
  )
}

function isBoundsFullyOutside(bounds: NodeBounds, clusterBounds: NodeBounds): boolean {
  return (
    bounds.right < clusterBounds.left ||
    bounds.left > clusterBounds.right ||
    bounds.bottom < clusterBounds.top ||
    bounds.top > clusterBounds.bottom
  )
}

function measureDroppedImage(file: File): Promise<{ size: { w: number; h: number } }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    image.onload = () => {
      const naturalWidth = image.naturalWidth
      const naturalHeight = image.naturalHeight

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        cleanup()
        reject(new Error(`Unable to read image dimensions for ${file.name || 'dropped image'}.`))
        return
      }

      const viewportLongestSide = Math.max(window.innerWidth, window.innerHeight)
      const maxLongestSide = Math.max(80, viewportLongestSide * IMAGE_DROP_MAX_VIEWPORT_FRACTION)
      const imageLongestSide = Math.max(naturalWidth, naturalHeight)
      const scale = imageLongestSide > maxLongestSide ? maxLongestSide / imageLongestSide : 1

      cleanup()
      resolve({
        size: {
          w: Math.max(1, Math.round(naturalWidth * scale)),
          h: Math.max(1, Math.round(naturalHeight * scale))
        }
      })
    }

    image.onerror = () => {
      cleanup()
      reject(new Error(`Unable to load image ${file.name || 'dropped image'}.`))
    }

    image.decoding = 'async'
    image.src = objectUrl
  })
}

function measureImageFromSrc(
  src: string,
  fallbackLabel: string
): Promise<{ size: { w: number; h: number } }> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const naturalWidth = image.naturalWidth
      const naturalHeight = image.naturalHeight

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        reject(new Error(`Unable to read image dimensions for ${fallbackLabel}.`))
        return
      }

      const viewportLongestSide = Math.max(window.innerWidth, window.innerHeight)
      const maxLongestSide = Math.max(80, viewportLongestSide * IMAGE_DROP_MAX_VIEWPORT_FRACTION)
      const imageLongestSide = Math.max(naturalWidth, naturalHeight)
      const scale = imageLongestSide > maxLongestSide ? maxLongestSide / imageLongestSide : 1

      resolve({
        size: {
          w: Math.max(1, Math.round(naturalWidth * scale)),
          h: Math.max(1, Math.round(naturalHeight * scale))
        }
      })
    }

    image.onerror = () => {
      reject(new Error(`Unable to load image ${fallbackLabel}.`))
    }

    image.decoding = 'async'
    image.src = src
  })
}

function scaleNaturalMediaSize(
  naturalWidth: number,
  naturalHeight: number
): { w: number; h: number } {
  const viewportLongestSide = Math.max(window.innerWidth, window.innerHeight)
  const maxLongestSide = Math.max(80, viewportLongestSide * IMAGE_DROP_MAX_VIEWPORT_FRACTION)
  const mediaLongestSide = Math.max(naturalWidth, naturalHeight)
  const scale = mediaLongestSide > maxLongestSide ? maxLongestSide / mediaLongestSide : 1

  return {
    w: Math.max(1, Math.round(naturalWidth * scale)),
    h: Math.max(1, Math.round(naturalHeight * scale))
  }
}

function measureDroppedVideo(file: File): Promise<{ size: { w: number; h: number } }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(objectUrl)
    }

    video.preload = 'metadata'
    video.playsInline = true
    video.muted = true

    video.onloadedmetadata = () => {
      const naturalWidth = video.videoWidth
      const naturalHeight = video.videoHeight

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        cleanup()
        reject(new Error(`Unable to read video dimensions for ${file.name || 'dropped video'}.`))
        return
      }

      const size = scaleNaturalMediaSize(naturalWidth, naturalHeight)
      cleanup()
      resolve({ size })
    }

    video.onerror = () => {
      cleanup()
      reject(new Error(`Unable to load video ${file.name || 'dropped video'}.`))
    }

    video.src = objectUrl
  })
}

function measureVideoFromSrc(
  src: string,
  fallbackLabel: string
): Promise<{ size: { w: number; h: number } }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.preload = 'metadata'
    video.playsInline = true
    video.muted = true

    video.onloadedmetadata = () => {
      const naturalWidth = video.videoWidth
      const naturalHeight = video.videoHeight

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        cleanup()
        reject(new Error(`Unable to read video dimensions for ${fallbackLabel}.`))
        return
      }

      const size = scaleNaturalMediaSize(naturalWidth, naturalHeight)
      cleanup()
      resolve({ size })
    }

    video.onerror = () => {
      cleanup()
      reject(new Error(`Unable to load video ${fallbackLabel}.`))
    }

    video.src = src
  })
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable || target.closest('input, textarea, [contenteditable="true"]') !== null
  )
}

function isPaneTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.react-flow__pane') !== null
}

function getBoardNameFromPath(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || 'Board'
}

function getSuggestedBoardFileName(boardPath: string, boardName?: string): string {
  const trimmedName = boardName?.trim()
  return trimmedName && trimmedName.length > 0 ? trimmedName : getBoardNameFromPath(boardPath)
}

function getWorkspaceRelativeBoardPath(boardPath: string, workspaceRoot: string): string {
  const normalizedBoardPath = boardPath.replace(/\\/g, '/')
  const normalizedWorkspaceRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  const prefix = `${normalizedWorkspaceRoot}/`

  if (normalizedBoardPath.startsWith(prefix)) {
    return normalizedBoardPath.slice(prefix.length)
  }

  return normalizedBoardPath
}

function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || filePath
}

function normalizeBoardNodesForSave(nodes: BoardNode[]): BoardNode[] {
  return nodes.map((node) => {
    if (!isTextLeafNode(node)) return node

    const content = node.content ?? makeLexicalContent(node.label ?? '')
    return {
      ...node,
      content,
      plain: lexicalContentToPlainText(content)
    }
  })
}

function buildBoardSnapshotFromGraph(input: {
  version: number
  name?: string
  brief?: string
  nodes: BoardNode[]
  edges: BoardEdge[]
  viewport?: BoardViewport
  transient?: boolean
}): Board {
  return {
    version: input.version,
    ...(input.transient ? { transient: true as const } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(input.brief?.trim() ? { brief: input.brief.trim() } : {}),
    nodes: normalizeBoardNodesForSave(input.nodes),
    edges: input.edges,
    ...(input.viewport ? { viewport: input.viewport } : {})
  }
}

function blurToolbarButtonIfFocused(): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return
  if (active.closest('.canvas-toolbar__button') === null) return
  active.blur()
}

type CanvasProps = {
  onGoHome: () => void
  onGoToWorkspaceHome: () => void
  onOpenArrangements: () => void
  onNewBoard: () => void
  onOpenBoard: (boardPath: string) => void
}

export function Canvas({
  onGoHome,
  onGoToWorkspaceHome,
  onOpenArrangements,
  onNewBoard,
  onOpenBoard
}: CanvasProps) {
  const { t } = useTranslation()

  const boardNodes = useBoardStore((s) => s.nodes)
  const boardEdges = useBoardStore((s) => s.edges)
  const version = useBoardStore((s) => s.version)
  const boardPath = useBoardStore((s) => s.path)
  const boardTransient = useBoardStore((s) => s.transient === true)
  const boardName = useBoardStore((s) => s.name)
  const boardBrief = useBoardStore((s) => s.brief)
  const boardViewport = useBoardStore((s) => s.viewport)
  const isDirty = useBoardStore((s) => s.isDirty)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateClusterFrame = useBoardStore((s) => s.updateClusterFrame)
  const translateCluster = useBoardStore((s) => s.translateCluster)
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const updateViewport = useBoardStore((s) => s.updateViewport)
  const updateCluster = useBoardStore((s) => s.updateCluster)
  const addNode = useBoardStore((s) => s.addNode)
  const addNodeToCluster = useBoardStore((s) => s.addNodeToCluster)
  const addCluster = useBoardStore((s) => s.addCluster)
  const createClusterFromNodes = useBoardStore((s) => s.createClusterFromNodes)
  const reconcileNodeClusterMembership = useBoardStore((s) => s.reconcileNodeClusterMembership)
  const deleteNodes = useBoardStore((s) => s.deleteNodes)
  const storeAddEdge = useBoardStore((s) => s.addEdge)
  const storeDeleteEdge = useBoardStore((s) => s.deleteEdge)
  const clearBoard = useBoardStore((s) => s.clearBoard)
  const markSaved = useBoardStore((s) => s.markSaved)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const setBoardPersistence = useBoardStore((s) => s.setBoardPersistence)
  const updateBoardMeta = useBoardStore((s) => s.updateBoardMeta)
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const workspaceConfig = useWorkspaceStore((s) => s.config)
  const workspaceBoards = useWorkspaceStore((s) => s.boards)
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
  const addWorkspaceBoard = useWorkspaceStore((s) => s.addBoard)
  const removeWorkspaceBoard = useWorkspaceStore((s) => s.removeBoard)
  const unhandledDropSetting = useAppSettingsStore((s) => s.files.unhandledDrop)
  const warnLargeImport = useAppSettingsStore((s) => s.files.warnLargeImport)
  const loadAppSettings = useAppSettingsStore((s) => s.loadAppSettings)

  const { screenToFlowPosition } = useReactFlow()

  const [activeTool, setActiveTool] = useState<Tool>('pointer')
  const [activeBloom, setActiveBloom] = useState<ActiveBloom | null>(null)
  const [paletteSession, setPaletteSession] = useState<PaletteCommandSession | null>(null)
  const [autoEditRequest, setAutoEditRequest] = useState<{ id: string; token: number } | null>(null)
  const [pendingDocumentAction, setPendingDocumentAction] = useState<'exit' | 'newBoard' | null>(
    null
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [imageDropError, setImageDropError] = useState<string | null>(null)
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null)
  const [pendingNodeSelectionId, setPendingNodeSelectionId] = useState<string | null>(null)
  const [promoteInFlight, setPromoteInFlight] = useState(false)
  const [promoteSubboardModalOpen, setPromoteSubboardModalOpen] = useState(false)
  const [promoteSubboardName, setPromoteSubboardName] = useState('Subboard')
  const [promoteSubboardInFlight, setPromoteSubboardInFlight] = useState(false)
  const [trashBoardInFlight, setTrashBoardInFlight] = useState(false)
  const [trashBoardConfirmOpen, setTrashBoardConfirmOpen] = useState(false)
  const [canvasContextMenu, setCanvasContextMenu] = useState<CanvasContextMenuState | null>(null)
  const [shapeMenuAnchor, setShapeMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const [overflowAnchor, setOverflowAnchor] = useState<{ x: number; y: number } | null>(null)
  const autoEditSequenceRef = useRef(0)
  const rightPointerStateRef = useRef<{ startX: number; startY: number; dragged: boolean } | null>(
    null
  )
  const transientAutosaveRef = useRef<string | null>(null)

  const closeCanvasContextMenu = useCallback(() => {
    setCanvasContextMenu(null)
  }, [])

  const getDefaultCanvasInsertionPoint = useCallback((): FlowPosition => {
    if (canvasContextMenu) return canvasContextMenu.flowPosition
    return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  }, [canvasContextMenu, screenToFlowPosition])

  const createBudAtPoint = useCallback(
    (input: {
      position: FlowPosition
      resource: string
      moduleType: string | null
      size: { w: number; h: number }
      label?: string
    }) => {
      const id = crypto.randomUUID()
      addNode({
        id,
        kind: 'bud',
        type: input.moduleType,
        position: input.position,
        size: input.size,
        resource: input.resource,
        ...(input.label ? { label: input.label } : {})
      })
      return id
    },
    [addNode]
  )

  const handleBloom = useCallback(
    (bloom: ActiveBloom) => {
      if (bloom.module.id === 'com.whitebloom.boardbloom') {
        const nestedBoardPath = resolveWorkspaceBoardPath(bloom.resource, workspaceRoot)
        if (!nestedBoardPath) {
          setWorkspaceActionError(t('canvas.workspaceActionFailedBody'))
          return
        }
        onOpenBoard(nestedBoardPath)
        return
      }

      if (bloom.module.defaultRenderer === 'external') {
        void window.api.openFile(bloom.resource)
        return
      }
      setActiveBloom(bloom)
    },
    [onOpenBoard, setActiveBloom, t, workspaceRoot]
  )

  const createFocusWriterBud = useCallback(async () => {
    if (!workspaceRoot) return
    const resource = `wloc:blossoms/note-${Date.now()}.blt`
    const position = getDefaultCanvasInsertionPoint()
    await window.api.writeBlossom(workspaceRoot, resource, '')
    const id = createBudAtPoint({
      position,
      resource,
      moduleType: focusWriterModule.id,
      size: { w: 220, h: 160 }
    })
    setActiveBloom({ nodeId: id, module: focusWriterModule, resource })
  }, [workspaceRoot, getDefaultCanvasInsertionPoint, createBudAtPoint])

  const createSchemaBloomBud = useCallback(async () => {
    if (!workspaceRoot) return
    const resource = `wloc:blossoms/schema-${Date.now()}.bdb`
    const position = getDefaultCanvasInsertionPoint()
    await window.api.writeBlossom(workspaceRoot, resource, schemaBloomModule.createDefault!())
    const id = createBudAtPoint({
      position,
      resource,
      moduleType: schemaBloomModule.id,
      size: { w: 88, h: 88 }
    })
    setActiveBloom({ nodeId: id, module: schemaBloomModule, resource })
  }, [workspaceRoot, getDefaultCanvasInsertionPoint, createBudAtPoint])

  const insertTextNodeAtPosition = useCallback(
    (
      position: FlowPosition,
      options?: {
        clusterId?: string
        select?: boolean
        switchToPointer?: boolean
      }
    ) => {
      const id = crypto.randomUUID()
      const nextToken = autoEditSequenceRef.current + 1
      autoEditSequenceRef.current = nextToken
      setAutoEditRequest({ id, token: nextToken })
      addNode({
        id,
        kind: 'leaf',
        type: 'text',
        position,
        size: { ...DEFAULT_TEXT_NODE_SIZE },
        content: makeLexicalContent(''),
        widthMode: 'auto',
        wrapWidth: null
      })
      if (options?.clusterId) {
        addNodeToCluster(options.clusterId, id)
      }

      if (options?.select) {
        setNodes((prev) => {
          const clearedSelection = prev.map((node) => ({ ...node, selected: false }))
          return [
            ...clearedSelection,
            {
              id,
              type: 'text',
              position,
              data: {
                content: makeLexicalContent(''),
                widthMode: 'auto',
                wrapWidth: null,
                size: { ...DEFAULT_TEXT_NODE_SIZE },
                autoEditToken: nextToken
              },
              selected: true,
              zIndex: options?.clusterId ? 10 : 1
            }
          ]
        })
      }

      if (options?.switchToPointer) {
        setActiveTool('pointer')
      }
    },
    [addNode, addNodeToCluster]
  )

  const createEmptyCluster = useCallback(() => {
    const position = getDefaultCanvasInsertionPoint()
    const id = crypto.randomUUID()
    addCluster({
      id,
      kind: 'cluster',
      type: null,
      label: 'Cluster',
      color: 'blue',
      autofitToContents: false,
      children: [],
      position: {
        x: Math.round(position.x - DEFAULT_CLUSTER_SIZE.w / 2),
        y: Math.round(position.y - DEFAULT_CLUSTER_SIZE.h / 2)
      },
      size: DEFAULT_CLUSTER_SIZE
    })
    setPendingNodeSelectionId(id)
  }, [addCluster, getDefaultCanvasInsertionPoint])

  const activeToolRef = useRef(activeTool)
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  const spacebarModeRef = useRef<'idle' | 'pressing' | 'tap-held'>('idle')
  const spacebarPreviousToolRef = useRef<Tool>('pointer')
  const spacebarPressTimeRef = useRef(0)
  const hadPendingAcceptRef = useRef(false)

  useEffect(() => {
    void loadAppSettings()
  }, [loadAppSettings])

  const boardNodesById = useMemo(() => {
    return new Map(boardNodes.map((node) => [node.id, node] as const))
  }, [boardNodes])

  const clusterIndicatorsById = useMemo(() => {
    const mapping = new Map<string, ClusterIndicator[]>()

    for (const node of boardNodes) {
      if (!isClusterNode(node) || node.autofitToContents !== true) continue

      mapping.set(node.id, [
        {
          id: 'autofit-to-contents',
          tone: node.color,
          title: t('canvas.clusterAutofitIndicatorTitle')
        }
      ])
    }

    return mapping
  }, [boardNodes, t])

  const springResizeSequenceRef = useRef(0)
  const springResizeTimeoutsRef = useRef(new Map<string, number>())
  const [springResizeById, setSpringResizeById] = useState(
    () => new Map<string, ClusterSpringResize>()
  )

  const triggerClusterSpringResize = useCallback(
    (id: string, animation: Omit<ClusterSpringResize, 'token'>) => {
      const token = springResizeSequenceRef.current + 1
      springResizeSequenceRef.current = token

      setSpringResizeById((prev) => {
        const next = new Map(prev)
        next.set(id, { ...animation, token })
        return next
      })

      const existingTimeout = springResizeTimeoutsRef.current.get(id)
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout)
      }

      const timeoutId = window.setTimeout(() => {
        setSpringResizeById((prev) => {
          const current = prev.get(id)
          if (!current || current.token !== token) return prev

          const next = new Map(prev)
          next.delete(id)
          return next
        })

        if (springResizeTimeoutsRef.current.get(id) === timeoutId) {
          springResizeTimeoutsRef.current.delete(id)
        }
      }, animation.durationMs + CLUSTER_SPRING_CLEANUP_BUFFER_MS)

      springResizeTimeoutsRef.current.set(id, timeoutId)
    },
    []
  )

  useEffect(() => {
    return () => {
      for (const timeoutId of springResizeTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId)
      }
      springResizeTimeoutsRef.current.clear()
    }
  }, [])

  const fitClusterToFrame = useCallback(
    (
      cluster: BoardClusterNode,
      nextFrame: ClusterFrame,
      options?: {
        animationFromBounds?: NodeBounds | null
      }
    ) => {
      const currentBounds = getStoredNodeBounds(cluster)
      if (areBoundsEqual(currentBounds, nextFrame.bounds)) return false

      const animationFromBounds = options?.animationFromBounds ?? currentBounds
      const springResize = buildClusterSpringResize(animationFromBounds, nextFrame.bounds)
      if (springResize) {
        triggerClusterSpringResize(cluster.id, springResize)
      }

      updateClusterFrame(cluster.id, nextFrame.position, nextFrame.size)
      return true
    },
    [triggerClusterSpringResize, updateClusterFrame]
  )

  useEffect(() => {
    for (const cluster of boardNodes) {
      if (
        !isClusterNode(cluster) ||
        cluster.autofitToContents !== true ||
        cluster.children.length === 0
      ) {
        continue
      }

      const childBounds = cluster.children
        .map((childId) => {
          const child = boardNodesById.get(childId)
          if (!child || isClusterNode(child)) return null
          return getStoredNodeBounds(child)
        })
        .filter((bounds): bounds is NodeBounds => bounds !== null)
      const nextFrame = getClusterFrameFromChildBounds(childBounds, CLUSTER_SELECTION_PADDING)
      if (!nextFrame) continue

      const currentBounds = getStoredNodeBounds(cluster)
      if (areBoundsEqual(nextFrame.bounds, currentBounds)) continue

      fitClusterToFrame(cluster, nextFrame, {
        animationFromBounds: getRenderedNodeBounds(cluster.id, screenToFlowPosition)
      })
    }
  }, [boardNodes, boardNodesById, fitClusterToFrame, screenToFlowPosition])

  useEffect(() => {
    return window.api.onCloseRequested(() => {
      if (isDirty) {
        setPendingDocumentAction('exit')
      }
    })
  }, [isDirty])

  // Derive RF nodes from store
  const schemaNodes: RFNode[] = useMemo(() => {
    const clusteredIds = new Set(boardNodes.filter(isClusterNode).flatMap((n) => n.children))
    return boardNodes.map((n) => {
      if (n.kind === 'cluster') {
        return {
          id: n.id,
          type: 'cluster',
          position: { x: n.position.x, y: n.position.y },
          data: {
            label: n.label,
            color: n.color,
            size: n.size,
            indicators: clusterIndicatorsById.get(n.id) ?? [],
            springResize: springResizeById.get(n.id) ?? null
          } satisfies ClusterData,
          zIndex: 2,
          draggable: true
        }
      }

      const isClustered = clusteredIds.has(n.id)

      if (n.kind === 'leaf' && n.type === 'text') {
        return {
          id: n.id,
          type: 'text',
          position: { x: n.position.x, y: n.position.y },
          data: {
            content: n.content ?? makeLexicalContent(n.label ?? ''),
            widthMode: n.widthMode ?? 'auto',
            wrapWidth: n.wrapWidth ?? null,
            size: n.size,
            autoEditToken: autoEditRequest?.id === n.id ? autoEditRequest.token : undefined
          },
          zIndex: isClustered ? 10 : 1
        }
      }

      if (isShapeLeafNode(n)) {
        return {
          id: n.id,
          type: 'shape',
          position: { x: n.position.x, y: n.position.y },
          data: {
            shape: n.shape,
            size: n.size,
            label: n.label
          },
          zIndex: isClustered ? 10 : 1
        }
      }

      // Bud node — moduleType carries the module id; unknown types show UnknownBudNode
      return {
        id: n.id,
        type: 'bud',
        position: { x: n.position.x, y: n.position.y },
        data: {
          moduleType: n.type,
          resource: n.resource ?? '',
          size: n.size,
          label: n.label
        },
        zIndex: isClustered ? 10 : 1
      }
    })
  }, [autoEditRequest, boardNodes, clusterIndicatorsById, springResizeById])

  // Local state so RF can update positions during drag
  const [nodes, setNodes] = useState<RFNode[]>(schemaNodes)
  useEffect(() => {
    setNodes((prev) => {
      const selectedIds = new Set(prev.filter((n) => n.selected).map((n) => n.id))
      return schemaNodes.map((n) => ({ ...n, selected: selectedIds.has(n.id) }))
    })
  }, [schemaNodes])

  useEffect(() => {
    if (!pendingNodeSelectionId) return
    if (!schemaNodes.some((node) => node.id === pendingNodeSelectionId)) return

    setNodes(schemaNodes.map((node) => ({ ...node, selected: node.id === pendingNodeSelectionId })))
    setPendingNodeSelectionId(null)
  }, [pendingNodeSelectionId, schemaNodes])

  useEffect(() => {
    if (activeTool === 'pointer') return

    setNodes((prev) => {
      if (!prev.some((n) => n.selected)) return prev
      return prev.map((n) => ({ ...n, selected: false }))
    })
  }, [activeTool])

  const selectedClusterableNodes = useMemo(() => {
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id))
    return boardNodes.filter((node) => selectedIds.has(node.id) && node.kind !== 'cluster')
  }, [boardNodes, nodes])

  const createClusterFromSelection = useCallback(() => {
    if (selectedClusterableNodes.length === 0) {
      createEmptyCluster()
      return
    }

    const selectedBounds = selectedClusterableNodes.map((node) => {
      return (
        getRenderedNodeBounds(node.id, screenToFlowPosition) ?? {
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + node.size.w,
          bottom: node.position.y + node.size.h
        }
      )
    })
    const minX = Math.min(...selectedBounds.map((bounds) => bounds.left))
    const minY = Math.min(...selectedBounds.map((bounds) => bounds.top))
    const maxX = Math.max(...selectedBounds.map((bounds) => bounds.right))
    const maxY = Math.max(...selectedBounds.map((bounds) => bounds.bottom))
    const id = crypto.randomUUID()

    createClusterFromNodes({
      id,
      label: 'Cluster',
      color: 'blue',
      childIds: selectedClusterableNodes.map((node) => node.id),
      position: {
        x: Math.round(minX - CLUSTER_SELECTION_PADDING),
        y: Math.round(minY - CLUSTER_SELECTION_PADDING)
      },
      size: {
        w: Math.round(maxX - minX + CLUSTER_SELECTION_PADDING * 2),
        h: Math.round(maxY - minY + CLUSTER_SELECTION_PADDING * 2)
      }
    })
    setPendingNodeSelectionId(id)
  }, [createClusterFromNodes, createEmptyCluster, screenToFlowPosition, selectedClusterableNodes])

  const owningClusterByNodeId = useMemo(() => {
    const clusterByChildId = new Map<string, string>()

    for (const node of boardNodes) {
      if (!isClusterNode(node)) continue

      for (const childId of node.children) {
        clusterByChildId.set(childId, node.id)
      }
    }

    return clusterByChildId
  }, [boardNodes])

  // Derive RF edges from store
  const schemaEdges: RFEdge[] = useMemo(
    () =>
      boardEdges.map((e) => {
        const sourceClusterId = owningClusterByNodeId.get(e.from) ?? null
        const targetClusterId = owningClusterByNodeId.get(e.to) ?? null
        const isFullyInternal =
          sourceClusterId !== null &&
          targetClusterId !== null &&
          sourceClusterId === targetClusterId
        const edgeZIndex = isFullyInternal ? INTERNAL_CLUSTER_EDGE_Z_INDEX : CLUSTER_EDGE_Z_INDEX

        const edgeStyle = normalizeEdgeStyle(e)
        const markerColor = resolveCanvasMarkerColor(edgeStyle.stroke.color)

        return {
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
          type: 'wb',
          label: e.label,
          zIndex: edgeZIndex,
          markerEnd: buildReactFlowMarker(edgeStyle.endMarker, markerColor, edgeStyle.stroke.width),
          markerStart: buildReactFlowMarker(
            edgeStyle.startMarker,
            markerColor,
            edgeStyle.stroke.width
          ),
          data: {
            edgeZIndex,
            normalizedStyle: edgeStyle,
            normalizedLabelLayout: normalizeEdgeLabelLayout(e)
          } satisfies WbEdgeData
        }
      }),
    [boardEdges, owningClusterByNodeId]
  )

  const [edges, setEdges] = useState<RFEdge[]>(schemaEdges)
  useEffect(() => {
    setEdges((prev) => {
      const selectedIds = new Set(prev.filter((e) => e.selected).map((e) => e.id))
      return schemaEdges.map((e) => ({ ...e, selected: selectedIds.has(e.id) }))
    })
  }, [schemaEdges])

  const singleSelectedNodeId = useMemo(() => {
    const selected = nodes.filter((n) => n.selected)
    return selected.length === 1 ? selected[0].id : null
  }, [nodes])

  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes]
  )

  const selectedEdgeIds = useMemo(
    () => edges.filter((edge) => edge.selected).map((edge) => edge.id),
    [edges]
  )

  const selectedCluster = useMemo(() => {
    if (!singleSelectedNodeId) return null
    const node = boardNodes.find((candidate) => candidate.id === singleSelectedNodeId)
    return node && isClusterNode(node) ? node : null
  }, [boardNodes, singleSelectedNodeId])

  const selectedBudNode = useMemo(() => {
    if (!singleSelectedNodeId) return null
    const node = boardNodes.find((candidate) => candidate.id === singleSelectedNodeId)
    return node?.kind === 'bud' ? node : null
  }, [boardNodes, singleSelectedNodeId])

  const selectedBudModule = useMemo(
    () => resolveModuleById(selectedBudNode?.type ?? null),
    [selectedBudNode]
  )

  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      deleteNodes(selectedNodeIds)
    }

    for (const edgeId of selectedEdgeIds) {
      storeDeleteEdge(edgeId)
    }
  }, [deleteNodes, selectedEdgeIds, selectedNodeIds, storeDeleteEdge])

  const bloomSelection = useCallback(async () => {
    if (!selectedBudNode || !selectedBudModule) return
    if (typeof selectedBudNode.resource !== 'string') return

    if (selectedBudModule.id === webPageBloomModule.id) {
      await window.api.openUrl(selectedBudNode.resource)
      return
    }

    handleBloom({
      nodeId: selectedBudNode.id,
      module: selectedBudModule,
      resource: selectedBudNode.resource
    })
  }, [handleBloom, selectedBudModule, selectedBudNode])

  const openSelectionInNativeEditor = useCallback(async () => {
    if (!selectedBudNode || selectedBudNode.type === webPageBloomModule.id) return
    if (typeof selectedBudNode.resource !== 'string') return
    await window.api.openFile(selectedBudNode.resource)
  }, [selectedBudNode])

  const canvasCommandContext = useMemo(
    () =>
      createCanvasCommandContext({
        selection: {
          nodeIds: selectedNodeIds,
          edgeIds: selectedEdgeIds
        },
        capabilities: {
          canBloomSelection: selectedBudNode !== null && selectedBudModule !== undefined,
          canOpenSelectionInNativeEditor:
            selectedBudNode !== null && selectedBudNode.type !== webPageBloomModule.id
        },
        actions: {
          createBud: createBudAtPoint,
          deleteSelection,
          bloomSelection,
          openSelectionInNativeEditor
        }
      }),
    [
      bloomSelection,
      createBudAtPoint,
      deleteSelection,
      openSelectionInNativeEditor,
      selectedBudModule,
      selectedBudNode,
      selectedEdgeIds,
      selectedNodeIds
    ]
  )

  const openPalette = useCallback(
    (initialMode: PaletteCommandSession['initialMode'] = 'visual') => {
      setPaletteSession({
        context: canvasCommandContext,
        initialMode,
        source: 'palette'
      })
    },
    [canvasCommandContext]
  )

  const closePalette = useCallback(() => {
    setPaletteSession(null)
  }, [])

  const runCanvasCommand = useCallback(
    async (id: string, args: unknown, options?: WhitebloomCommandExecutionOptions) => {
      const result = await executeCommandById(id, args, canvasCommandContext, options)
      if (!result.ok) {
        console.warn(`[commands] ${result.commandId} failed`, result)
        return null
      }

      return result.result
    },
    [canvasCommandContext]
  )

  const fitSelectedClusterToChildren = useCallback(() => {
    if (!selectedCluster || selectedCluster.children.length === 0) return

    const liveNodesById = new Map(nodes.map((node) => [node.id, node] as const))
    const childBounds = selectedCluster.children
      .map((childId) => {
        const boardNode = boardNodes.find((node) => node.id === childId)
        if (!boardNode || isClusterNode(boardNode)) return null

        const renderedBounds = getRenderedNodeBounds(childId, screenToFlowPosition)
        if (renderedBounds) return renderedBounds

        const liveNode = liveNodesById.get(childId)
        const width =
          typeof liveNode?.width === 'number' && liveNode.width > 0
            ? liveNode.width
            : boardNode.size.w
        const height =
          typeof liveNode?.height === 'number' && liveNode.height > 0
            ? liveNode.height
            : boardNode.size.h
        const position = liveNode?.position ?? boardNode.position

        return {
          left: position.x,
          top: position.y,
          right: position.x + width,
          bottom: position.y + height
        }
      })
      .filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== null)

    const nextFrame = getClusterFrameFromChildBounds(childBounds, CLUSTER_SELECTION_PADDING)
    if (!nextFrame) return

    const liveClusterNode = liveNodesById.get(selectedCluster.id)
    const liveClusterBounds =
      getRenderedNodeBounds(selectedCluster.id, screenToFlowPosition) ??
      (liveClusterNode
        ? getNodeBounds(
            {
              position: liveClusterNode.position,
              width: liveClusterNode.width,
              height: liveClusterNode.height
            },
            liveClusterNode.type === 'cluster'
              ? (liveClusterNode.data as ClusterData).size
              : undefined
          )
        : null)

    fitClusterToFrame(selectedCluster, nextFrame, {
      animationFromBounds: liveClusterBounds
    })
  }, [boardNodes, fitClusterToFrame, nodes, screenToFlowPosition, selectedCluster])

  const toggleSelectedClusterAutofit = useCallback(() => {
    if (!selectedCluster) return

    const nextEnabled = selectedCluster.autofitToContents !== true
    updateCluster(selectedCluster.id, { autofitToContents: nextEnabled })

    if (nextEnabled && selectedCluster.children.length > 0) {
      fitSelectedClusterToChildren()
    }
  }, [fitSelectedClusterToChildren, selectedCluster, updateCluster])

  const clusterChildrenById = useMemo(() => {
    const mapping = new Map<string, string[]>()
    for (const node of boardNodes) {
      if (!isClusterNode(node)) continue
      mapping.set(node.id, node.children)
    }
    return mapping
  }, [boardNodes])

  const clusterNodesById = useMemo(() => {
    const mapping = new Map<string, BoardClusterNode>()
    for (const node of boardNodes) {
      if (!isClusterNode(node)) continue
      mapping.set(node.id, node)
    }
    return mapping
  }, [boardNodes])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const isClusterPositionChange = (
        change: NodeChange
      ): change is Extract<NodeChange, { type: 'position' }> =>
        change.type === 'position' &&
        'id' in change &&
        Boolean(change.position) &&
        clusterChildrenById.has(change.id)

      const clusterPositionChanges = changes.filter(isClusterPositionChange)
      const childIdsMovedByClusters = new Set<string>()
      for (const change of clusterPositionChanges) {
        for (const childId of clusterChildrenById.get(change.id) ?? []) {
          childIdsMovedByClusters.add(childId)
        }
      }

      const draggingNodeChanges = changes.filter(
        (change): change is Extract<NodeChange, { type: 'position' }> =>
          change.type === 'position' &&
          'id' in change &&
          Boolean(change.position) &&
          change.dragging === true &&
          !clusterChildrenById.has(change.id)
      )

      // Compute which unclustered dragging nodes are fully inside a cluster.
      // Used to elevate edge z-index so connections to already-clustered nodes
      // surface above the cluster pane alongside the dragging node.
      const pendingAcceptClusterByNodeId = new Map<string, string>()
      for (const change of draggingNodeChanges) {
        const draggedBoardNode = boardNodes.find((n) => n.id === change.id && !isClusterNode(n))
        if (!draggedBoardNode || !change.position) continue
        const isAlreadyClustered = Array.from(clusterChildrenById.values()).some((ids) =>
          ids.includes(change.id)
        )
        if (isAlreadyClustered) continue
        const draggedBounds = getNodeBounds({ position: change.position }, draggedBoardNode.size)
        if (!draggedBounds) continue
        const containingCluster = boardNodes
          .filter(isClusterNode)
          .filter((c) => {
            const b = getNodeBounds({ position: c.position }, c.size)
            return b ? isBoundsFullyInside(draggedBounds, b) : false
          })
          .sort((a, b) => a.size.w * a.size.h - b.size.w * b.size.h)[0]
        if (containingCluster) {
          pendingAcceptClusterByNodeId.set(change.id, containingCluster.id)
        }
      }

      setNodes((currentNodes) => {
        const otherChanges = changes.filter(
          (change) =>
            change.type !== 'position' ||
            !('id' in change) ||
            !change.position ||
            (!clusterChildrenById.has(change.id) && !childIdsMovedByClusters.has(change.id))
        )

        let nextNodes =
          otherChanges.length > 0 ? applyNodeChanges(otherChanges, currentNodes) : currentNodes

        for (const change of clusterPositionChanges) {
          if (change.type !== 'position' || !change.position) continue

          const clusterNode = nextNodes.find((node) => node.id === change.id)
          if (!clusterNode) continue

          const dx = change.position.x - clusterNode.position.x
          const dy = change.position.y - clusterNode.position.y
          if (dx === 0 && dy === 0) continue

          const childIds = new Set(clusterChildrenById.get(change.id) ?? [])
          nextNodes = nextNodes.map((node) => {
            if (node.id !== change.id && !childIds.has(node.id)) return node
            return {
              ...node,
              position: {
                x: node.position.x + dx,
                y: node.position.y + dy
              }
            }
          })
        }

        const owningDraggedClusterIds = new Set<string>()

        for (const change of draggingNodeChanges) {
          const owningClusterId = Array.from(clusterChildrenById.entries()).find(([, childIds]) =>
            childIds.includes(change.id)
          )?.[0]
          if (owningClusterId) owningDraggedClusterIds.add(owningClusterId)
        }

        for (const clusterId of owningDraggedClusterIds) {
          const cluster = clusterNodesById.get(clusterId)
          if (!cluster || cluster.autofitToContents !== true) continue

          const childBounds = cluster.children
            .map((childId) => {
              const child = boardNodesById.get(childId)
              if (!child || isClusterNode(child)) return null

              const childLocalNode = nextNodes.find((node) => node.id === childId)
              return getNodeBounds(
                {
                  position: childLocalNode?.position ?? child.position,
                  width: childLocalNode?.width,
                  height: childLocalNode?.height
                },
                child.size
              )
            })
            .filter((bounds): bounds is NodeBounds => bounds !== null)

          const nextFrame = getClusterFrameFromChildBounds(childBounds, CLUSTER_SELECTION_PADDING)
          if (!nextFrame) continue

          nextNodes = nextNodes.map((node) => {
            if (node.id !== clusterId) return node

            const clusterData = node.data as ClusterData
            const currentBounds = {
              left: node.position.x,
              top: node.position.y,
              right: node.position.x + clusterData.size.w,
              bottom: node.position.y + clusterData.size.h
            }

            if (isBoundsFullyInside(nextFrame.bounds, currentBounds)) return node

            const expandedBounds = {
              left: Math.min(currentBounds.left, nextFrame.bounds.left),
              top: Math.min(currentBounds.top, nextFrame.bounds.top),
              right: Math.max(currentBounds.right, nextFrame.bounds.right),
              bottom: Math.max(currentBounds.bottom, nextFrame.bounds.bottom)
            }
            const size = {
              w: Math.round(expandedBounds.right - expandedBounds.left),
              h: Math.round(expandedBounds.bottom - expandedBounds.top)
            }

            return {
              ...node,
              position: {
                x: expandedBounds.left,
                y: expandedBounds.top
              },
              data: { ...clusterData, size, springResize: null } satisfies ClusterData
            }
          })
        }

        const nextCues: Record<string, ClusterMembershipCue> = {}
        const pendingAcceptNodeIds = new Set<string>()

        for (const change of draggingNodeChanges) {
          const draggedBoardNode = boardNodes.find(
            (node) => node.id === change.id && !isClusterNode(node)
          )
          if (!draggedBoardNode || !change.position) continue

          const owningClusterId = Array.from(clusterChildrenById.entries()).find(([, childIds]) =>
            childIds.includes(change.id)
          )?.[0]

          const draggedLocalNode = nextNodes.find((node) => node.id === change.id)
          const draggedBounds = getNodeBounds(
            {
              position: change.position,
              width: draggedLocalNode?.width,
              height: draggedLocalNode?.height
            },
            draggedBoardNode.size
          )
          if (!draggedBounds) continue

          const containingClusters = boardNodes
            .filter((node): node is BoardClusterNode => isClusterNode(node))
            .filter((cluster) => {
              const clusterLocalNode = nextNodes.find((node) => node.id === cluster.id)
              const clusterBounds = getNodeBounds(
                {
                  position: clusterLocalNode?.position ?? {
                    x: cluster.position.x,
                    y: cluster.position.y
                  },
                  width: clusterLocalNode?.width,
                  height: clusterLocalNode?.height
                },
                cluster.size
              )
              return clusterBounds ? isBoundsFullyInside(draggedBounds, clusterBounds) : false
            })
            .sort((left, right) => left.size.w * left.size.h - right.size.w * right.size.h)

          if (!owningClusterId && containingClusters.length > 0) {
            nextCues[containingClusters[0].id] = 'accept'
            pendingAcceptNodeIds.add(change.id)
          }

          if (owningClusterId) {
            const owningCluster = clusterNodesById.get(owningClusterId)
            if (owningCluster) {
              const owningLocalNode = nextNodes.find((node) => node.id === owningCluster.id)
              const owningBounds = getNodeBounds(
                {
                  position: owningLocalNode?.position ?? owningCluster.position,
                  width: owningLocalNode?.width,
                  height: owningLocalNode?.height
                },
                owningCluster.size
              )

              if (
                owningBounds &&
                isBoundsFullyOutside(draggedBounds, owningBounds) &&
                nextCues[owningClusterId] !== 'accept'
              ) {
                nextCues[owningClusterId] = 'release'
              }
            }
          }
        }

        return nextNodes.map((node) => {
          if (node.type === 'cluster') {
            const currentData = node.data as ClusterData
            const membershipCue = nextCues[node.id] ?? null
            if ((currentData.membershipCue ?? null) === membershipCue) return node
            return {
              ...node,
              data: { ...currentData, membershipCue } satisfies ClusterData
            }
          }

          // Unclustered node dragged fully inside a cluster: surface it above the cluster pane
          const isPendingAccept = pendingAcceptNodeIds.has(node.id)
          const isUnclustered = node.zIndex === 1 || isPendingAccept
          if (!isUnclustered) return node
          const targetZIndex = isPendingAccept ? 10 : 1
          if (node.zIndex === targetZIndex) return node
          return { ...node, zIndex: targetZIndex }
        })
      })

      const hasPendingAccept = pendingAcceptClusterByNodeId.size > 0
      if (hasPendingAccept || hadPendingAcceptRef.current) {
        setEdges((currentEdges) =>
          currentEdges.map((edge) => {
            const sourceCluster = owningClusterByNodeId.get(edge.source) ?? null
            const targetCluster = owningClusterByNodeId.get(edge.target) ?? null
            const isAlreadyInternal =
              sourceCluster !== null && targetCluster !== null && sourceCluster === targetCluster
            const sourcePendingCluster = pendingAcceptClusterByNodeId.get(edge.source)
            const targetPendingCluster = pendingAcceptClusterByNodeId.get(edge.target)
            const isPendingInternal =
              (sourcePendingCluster !== undefined && targetCluster === sourcePendingCluster) ||
              (targetPendingCluster !== undefined && sourceCluster === targetPendingCluster)
            const targetZIndex =
              isAlreadyInternal || isPendingInternal
                ? INTERNAL_CLUSTER_EDGE_Z_INDEX
                : CLUSTER_EDGE_Z_INDEX
            if (edge.zIndex === targetZIndex && edge.data?.edgeZIndex === targetZIndex) return edge
            return {
              ...edge,
              zIndex: targetZIndex,
              data: edge.data ? { ...edge.data, edgeZIndex: targetZIndex } : edge.data
            }
          })
        )
      }
      hadPendingAcceptRef.current = hasPendingAccept

      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          if (clusterChildrenById.has(change.id)) {
            const cluster = boardNodes.find((node) => node.id === change.id && isClusterNode(node))
            if (!cluster) continue

            const dx = change.position.x - cluster.position.x
            const dy = change.position.y - cluster.position.y
            if (dx !== 0 || dy !== 0) {
              translateCluster(change.id, dx, dy)
            }
            continue
          }

          if (childIdsMovedByClusters.has(change.id)) continue

          updateNodePosition(change.id, change.position.x, change.position.y)
          reconcileNodeClusterMembership(change.id)
        }
      }
    },
    [
      boardNodes,
      boardNodesById,
      clusterChildrenById,
      clusterNodesById,
      owningClusterByNodeId,
      reconcileNodeClusterMembership,
      translateCluster,
      updateNodePosition
    ]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds))
      for (const change of changes) {
        if (change.type === 'remove') storeDeleteEdge(change.id)
      }
    },
    [storeDeleteEdge]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      storeAddEdge({
        id: crypto.randomUUID(),
        from: connection.source,
        to: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null
      })
    },
    [storeAddEdge]
  )

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'text') return
      insertTextNodeAtPosition(screenToFlowPosition({ x: e.clientX, y: e.clientY }), {
        select: true,
        switchToPointer: true
      })
    },
    [activeTool, insertTextNodeAtPosition, screenToFlowPosition]
  )

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      if (activeTool !== 'text' || node.type !== 'cluster') return
      event.preventDefault()
      event.stopPropagation()
      insertTextNodeAtPosition(screenToFlowPosition({ x: event.clientX, y: event.clientY }), {
        clusterId: node.id,
        select: true,
        switchToPointer: true
      })
    },
    [activeTool, insertTextNodeAtPosition, screenToFlowPosition]
  )

  const buildBoardSnapshot = useCallback(
    (options?: { transient?: boolean }): Board => {
      return buildBoardSnapshotFromGraph({
        version,
        transient: options?.transient,
        name: boardName,
        brief: boardBrief,
        nodes: boardNodes,
        edges: boardEdges,
        viewport: boardViewport
      })
    },
    [version, boardName, boardBrief, boardNodes, boardEdges, boardViewport]
  )

  useEffect(() => {
    if (!boardTransient || !boardPath) {
      transientAutosaveRef.current = null
      return
    }

    const serializedBoard = JSON.stringify(buildBoardSnapshot({ transient: true }), null, 2)
    if (transientAutosaveRef.current === serializedBoard) return

    transientAutosaveRef.current = serializedBoard
    void window.api.saveBoard(boardPath, serializedBoard)
  }, [boardPath, boardTransient, buildBoardSnapshot])

  const handleSave = useCallback(async () => {
    if (!boardPath) {
      console.error('Cannot save board without an explicit board path.')
      return
    }

    if (boardTransient) {
      const saveDialogResult = await window.api.showBoardSaveDialog(
        getSuggestedBoardFileName(boardPath, boardName)
      )
      if (!saveDialogResult.ok || !saveDialogResult.boardPath) return

      const promotedSnapshot = buildBoardSnapshot({ transient: false })
      const promotionResult = await window.api.promoteBoard(
        boardPath,
        saveDialogResult.boardPath,
        JSON.stringify(promotedSnapshot, null, 2)
      )

      if (promotionResult.ok && promotionResult.boardPath) {
        setBoardPersistence(promotionResult.boardPath, false)
        markSaved()
      }
      return
    }

    const result = await window.api.saveBoard(
      boardPath,
      JSON.stringify(buildBoardSnapshot({ transient: false }), null, 2)
    )

    if (result.ok) {
      markSaved()
    }
  }, [boardName, boardPath, boardTransient, buildBoardSnapshot, markSaved, setBoardPersistence])

  const handlePromoteToWorkspace = useCallback(async () => {
    if (!boardPath || workspaceRoot !== null) return

    setPromoteInFlight(true)
    setWorkspaceActionError(null)

    try {
      const createWorkspaceResult = await window.api.createWorkspaceDialog()
      if (!createWorkspaceResult.ok || !createWorkspaceResult.workspaceRoot) return

      const snapshot = buildBoardSnapshot({ transient: false })
      const suggestedName = snapshot.name?.trim() || getBoardNameFromPath(boardPath)
      const createBoardResult = await window.api.createBoard(
        createWorkspaceResult.workspaceRoot,
        suggestedName
      )

      if (!createBoardResult.ok || !createBoardResult.boardPath) {
        throw new Error('Unable to create a workspace board.')
      }

      const saveResult = boardTransient
        ? await window.api.promoteBoard(
            boardPath,
            createBoardResult.boardPath,
            JSON.stringify(snapshot, null, 2)
          )
        : await window.api.saveBoard(createBoardResult.boardPath, JSON.stringify(snapshot, null, 2))

      if (!saveResult.ok) {
        throw new Error('Unable to write the promoted board into the new workspace.')
      }

      const workspace = await window.api.readWorkspace(createWorkspaceResult.workspaceRoot)
      loadWorkspace(workspace)
      loadBoard(snapshot, createBoardResult.boardPath)
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : t('canvas.promoteError'))
    } finally {
      setPromoteInFlight(false)
    }
  }, [boardPath, boardTransient, buildBoardSnapshot, loadBoard, loadWorkspace, workspaceRoot])

  const openPromoteSubboardModal = useCallback(() => {
    if (!selectedCluster || workspaceRoot === null) return
    setWorkspaceActionError(null)
    setPromoteSubboardName(selectedCluster.label?.trim() || 'Subboard')
    setPromoteSubboardModalOpen(true)
  }, [selectedCluster, workspaceRoot])

  const closePromoteSubboardModal = useCallback(() => {
    if (promoteSubboardInFlight) return
    setPromoteSubboardModalOpen(false)
  }, [promoteSubboardInFlight])

  const handlePromoteClusterToSubboard = useCallback(async () => {
    if (!selectedCluster || !workspaceRoot || !boardPath) return

    const trimmedName = promoteSubboardName.trim() || selectedCluster.label?.trim() || 'Subboard'
    const budSize = boardBloomModule.defaultSize ?? { w: 196, h: 128 }

    const plan = planClusterPromotion({
      clusterId: selectedCluster.id,
      boardName: trimmedName,
      boardResource: '',
      budType: boardBloomModule.id,
      budSize,
      nodes: boardNodes,
      edges: boardEdges,
      username: useBoardStore.getState().activeUsername
    })

    if (!plan) return

    setPromoteSubboardInFlight(true)
    setWorkspaceActionError(null)

    try {
      const createBoardResult = await window.api.createBoard(workspaceRoot, trimmedName)
      if (!createBoardResult.ok || !createBoardResult.boardPath) {
        throw new Error(t('canvas.promoteSubboardError'))
      }

      const boardResource = toWorkspaceBoardResource(createBoardResult.boardPath, workspaceRoot)
      if (!boardResource) {
        throw new Error(t('canvas.promoteSubboardError'))
      }

      const finalizedPlan = planClusterPromotion({
        clusterId: selectedCluster.id,
        boardName: trimmedName,
        boardResource,
        budType: boardBloomModule.id,
        budSize,
        nodes: boardNodes,
        edges: boardEdges,
        username: useBoardStore.getState().activeUsername
      })

      if (!finalizedPlan) {
        throw new Error(t('canvas.promoteSubboardError'))
      }

      const childSaveResult = await window.api.saveBoard(
        createBoardResult.boardPath,
        JSON.stringify(finalizedPlan.childBoard, null, 2)
      )
      if (!childSaveResult.ok) {
        throw new Error(t('canvas.promoteSubboardError'))
      }

      useBoardStore.getState().commitClusterPromotion(finalizedPlan)
      const parentState = useBoardStore.getState()
      const parentSnapshot = buildBoardSnapshotFromGraph({
        version: parentState.version,
        name: parentState.name,
        brief: parentState.brief,
        nodes: parentState.nodes,
        edges: parentState.edges,
        viewport: parentState.viewport
      })

      const parentSaveResult = await window.api.saveBoard(
        boardPath,
        JSON.stringify(parentSnapshot, null, 2)
      )
      if (!parentSaveResult.ok) {
        throw new Error(t('canvas.promoteSubboardError'))
      }

      addWorkspaceBoard(createBoardResult.boardPath)
      markSaved()
      setPendingNodeSelectionId(selectedCluster.id)
      setPromoteSubboardModalOpen(false)
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : t('canvas.promoteSubboardError')
      )
    } finally {
      setPromoteSubboardInFlight(false)
    }
  }, [
    addWorkspaceBoard,
    boardEdges,
    boardNodes,
    boardPath,
    markSaved,
    promoteSubboardName,
    selectedCluster,
    t,
    workspaceRoot
  ])

  const handleTrashBoard = useCallback(async () => {
    if (!boardPath) return

    setTrashBoardInFlight(true)
    setWorkspaceActionError(null)

    try {
      const result = await window.api.trashBoard(boardPath)
      if (!result.ok) {
        throw new Error(t('canvas.trashError'))
      }

      if (workspaceRoot !== null) {
        removeWorkspaceBoard(boardPath)
      }

      setTrashBoardConfirmOpen(false)
      clearBoard()
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : t('canvas.trashError'))
    } finally {
      setTrashBoardInFlight(false)
    }
  }, [boardPath, clearBoard, removeWorkspaceBoard, workspaceRoot])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'x' &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        if (isEditableTarget(event.target)) return
        if (activeBloom !== null) return
        event.preventDefault()
        openPalette('meta')
        return
      }

      if (
        event.key === 'Tab' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (isEditableTarget(event.target)) return
        if (activeBloom !== null) return
        event.preventDefault()
        openPalette('visual')
        return
      }

      if (event.key === 'Escape') {
        if (isEditableTarget(event.target)) return
        if (activeBloom !== null) {
          event.preventDefault()
          setActiveBloom(null)
          return
        }
        if (paletteSession) {
          event.preventDefault()
          closePalette()
          return
        }
        if (settingsOpen) {
          event.preventDefault()
          setSettingsOpen(false)
          return
        }
        // Let PetalPanel handle Escape when any panel is open
        if (
          imageDropError ||
          workspaceActionError ||
          pendingDocumentAction ||
          trashBoardConfirmOpen
        )
          return
        event.preventDefault()
        setActiveTool('pointer')
        blurToolbarButtonIfFocused()
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
        return
      }

      // All remaining shortcuts are canvas-only — skip them while any bloom is open
      if (activeBloom !== null) return

      if (
        event.key.toLowerCase() === 't' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        setActiveTool('text')
        blurToolbarButtonIfFocused()
        return
      }

      if (event.key === 't' && (event.ctrlKey || event.metaKey)) {
        if (isEditableTarget(event.target)) return
        const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
        const toSnug = boardNodes.filter(
          (n) => selectedIds.has(n.id) && n.type === 'text' && n.widthMode === 'fixed'
        )
        if (toSnug.length === 0) return
        event.preventDefault()
        for (const node of toSnug) {
          updateNodeText(node.id, {
            content: node.content ?? makeLexicalContent(''),
            widthMode: 'auto',
            wrapWidth: null
          })
        }
        return
      }

      if (event.key.toLowerCase() === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        void handleSave()
        return
      }

      const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'
      if (!isDeleteKey) return
      if (isEditableTarget(event.target)) return

      const hasSelection =
        nodes.some((node) => node.selected) || edges.some((edge) => edge.selected)
      if (!hasSelection) return

      event.preventDefault()
      void runCanvasCommand(WHITEBLOOM_COMMAND_IDS.canvas.deleteSelection, undefined, {
        source: 'shortcut',
        metadata: {
          key: event.key
        }
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    activeBloom,
    boardNodes,
    closePalette,
    edges,
    handleSave,
    imageDropError,
    nodes,
    openPalette,
    paletteSession,
    pendingDocumentAction,
    runCanvasCommand,
    settingsOpen,
    setActiveTool,
    setNodes,
    trashBoardConfirmOpen,
    updateNodeText,
    workspaceActionError
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ') return
      if (event.repeat) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()

      blurToolbarButtonIfFocused()

      const mode = spacebarModeRef.current
      if (mode === 'tap-held') {
        setActiveTool(spacebarPreviousToolRef.current)
        spacebarModeRef.current = 'idle'
      } else if (mode === 'idle') {
        spacebarPreviousToolRef.current = activeToolRef.current
        spacebarPressTimeRef.current = Date.now()
        spacebarModeRef.current = 'pressing'
        setActiveTool('hand')
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ') return
      if (spacebarModeRef.current !== 'pressing') return

      const held = Date.now() - spacebarPressTimeRef.current
      if (held >= 200) {
        setActiveTool(spacebarPreviousToolRef.current)
        spacebarModeRef.current = 'idle'
      } else {
        spacebarModeRef.current = 'tap-held'
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleConfirmDocumentAction = useCallback(() => {
    if (pendingDocumentAction === 'exit') {
      window.api.confirmClose()
    } else if (pendingDocumentAction === 'newBoard') {
      onNewBoard()
    }
    setPendingDocumentAction(null)
  }, [onNewBoard, pendingDocumentAction])

  const handleCancelDocumentAction = useCallback(() => {
    setPendingDocumentAction(null)
  }, [])

  const handleNewBoard = useCallback(() => {
    if (isDirty) {
      setPendingDocumentAction('newBoard')
    } else {
      onNewBoard()
    }
  }, [isDirty, onNewBoard])

  const confirmDialogTitle =
    pendingDocumentAction === 'newBoard'
      ? t('canvas.discardChangestitle')
      : t('canvas.exitWithoutSavingTitle')
  const confirmDialogBody =
    pendingDocumentAction === 'newBoard'
      ? t('canvas.discardChangesBody')
      : t('canvas.exitWithoutSavingBody')
  const confirmDialogConfirmLabel =
    pendingDocumentAction === 'newBoard' ? t('canvas.discardButton') : t('canvas.exitButton')

  const panOnDragButtons = useMemo(() => {
    if (activeTool === 'hand') return [0, 1, 2]
    if (activeTool === 'pointer') return [1, 2]
    return false
  }, [activeTool])

  useEffect(() => {
    if (activeTool !== 'pointer' && canvasContextMenu !== null) {
      setCanvasContextMenu(null)
    }
  }, [activeTool, canvasContextMenu])

  const importWorkspaceResource = useCallback(
    async (input: {
      filePath: string
      fileName: string
      fileSize: number
    }): Promise<string | null> => {
      if (!workspaceRoot) {
        throw new Error('Workspace root is required to import resources.')
      }

      if (warnLargeImport && input.fileSize > LARGE_IMPORT_THRESHOLD_BYTES) {
        const sizeMb = Math.round(input.fileSize / (1024 * 1024))
        const proceed = await window.api.confirmLargeImport(input.fileName, sizeMb)
        if (!proceed) return null
      }

      const copyResult = await window.api.copyWorkspaceResource(workspaceRoot, input.filePath)
      if (!copyResult.ok || !copyResult.resource) {
        throw new Error(`Unable to copy ${input.fileName} into workspace resources.`)
      }

      return copyResult.resource
    },
    [warnLargeImport, workspaceRoot]
  )

  const resolveDroppedModule = useCallback(
    async (filePath: string, isDirectory: boolean): Promise<WhitebloomModule | undefined> => {
      if (isDirectory) return dispatchDirectory(filePath)
      return dispatchModule(filePath)
    },
    []
  )

  const decideExternalResourceBehavior = useCallback(
    async (input: {
      filePath: string
      fileName: string
      module: WhitebloomModule | undefined
      preferredBehavior?: 'link' | 'import'
    }): Promise<'link' | 'import'> => {
      if (workspaceRoot === null) return 'link'
      if (input.preferredBehavior === 'link') return 'link'
      if (input.module?.id === boardBloomModule.id) return 'link'
      if (input.preferredBehavior === 'import') {
        return input.module?.importable === false ? 'link' : 'import'
      }
      if (input.module) return input.module.importable === false ? 'link' : 'import'

      return unhandledDropSetting === 'ask'
        ? await window.api.askImportOrLink(input.fileName)
        : unhandledDropSetting
    },
    [unhandledDropSetting, workspaceRoot]
  )

  const computeDroppedBudSize = useCallback(
    async (input: {
      file?: File
      filePath: string
      module: WhitebloomModule | undefined
    }): Promise<{ w: number; h: number }> => {
      const isImageModule = input.module?.id === imageModule.id
      const isVideoModule = input.module?.id === videoModule.id
      const isImageFile = input.file?.type.toLowerCase().startsWith('image/') ?? false
      const isVideoFile = input.file?.type.toLowerCase().startsWith('video/') ?? false

      if (input.file && isImageFile) {
        return (await measureDroppedImage(input.file)).size
      }

      if (input.file && isVideoFile) {
        return (await measureDroppedVideo(input.file)).size
      }

      if (isImageModule) {
        const fileUri = absolutePathToFileUri(input.filePath)
        return (
          await measureImageFromSrc(
            resourceToImageSrc(fileUri),
            input.file?.name || getFileNameFromPath(input.filePath)
          )
        ).size
      }

      if (isVideoModule) {
        const fileUri = absolutePathToFileUri(input.filePath)
        return (
          await measureVideoFromSrc(
            resourceToMediaSrc(fileUri),
            input.file?.name || getFileNameFromPath(input.filePath)
          )
        ).size
      }

      if (input.module) return input.module.defaultSize ?? { w: 220, h: 160 }
      return { w: 88, h: 88 }
    },
    []
  )

  const resolveExternalResourcePlacement = useCallback(
    async (input: ExternalResourceInput): Promise<BudPlacement | null> => {
      const isDirectory = await window.api.isDirectory(input.filePath)
      const module = await resolveDroppedModule(input.filePath, isDirectory)
      const moduleType = module?.id ?? null

      if (isDirectory) {
        return {
          resource: absolutePathToFileUri(input.filePath),
          moduleType,
          size: module?.defaultSize ?? { w: 88, h: 88 }
        }
      }

      if (moduleType === boardBloomModule.id) {
        const localBoardResource = toWorkspaceBoardResource(input.filePath, workspaceRoot)
        if (!localBoardResource) {
          throw new Error(t('canvas.invalidSubboardLinkBody'))
        }

        return {
          resource: localBoardResource,
          moduleType,
          size: boardBloomModule.defaultSize ?? { w: 196, h: 128 }
        }
      }

      const behavior =
        input.preferredBehavior ??
        (await decideExternalResourceBehavior({
          filePath: input.filePath,
          fileName: input.fileName,
          module,
          preferredBehavior: input.preferredBehavior
        }))

      const resource =
        behavior === 'import'
          ? await importWorkspaceResource({
              filePath: input.filePath,
              fileName: input.fileName,
              fileSize: input.file?.size ?? 0
            })
          : absolutePathToFileUri(input.filePath)

      if (resource === null) return null

      return {
        resource,
        moduleType,
        size: await computeDroppedBudSize({
          file: input.file,
          filePath: input.filePath,
          module
        })
      }
    },
    [
      computeDroppedBudSize,
      decideExternalResourceBehavior,
      importWorkspaceResource,
      resolveDroppedModule,
      t,
      workspaceRoot
    ]
  )

  const placePickedResources = useCallback(
    async (filePaths: string[], preferredBehavior: 'link' | 'import'): Promise<void> => {
      const basePosition = getDefaultCanvasInsertionPoint()
      const groupId = createCommandExecutionGroupId()
      const settled = await Promise.allSettled(
        filePaths.map((filePath) =>
          resolveExternalResourcePlacement({
            filePath,
            fileName: getFileNameFromPath(filePath),
            preferredBehavior
          })
        )
      )

      let createdCount = 0
      let firstFailure: string | null = null

      for (const placement of settled) {
        if (placement.status === 'rejected') {
          const message =
            placement.reason instanceof Error ? placement.reason.message : t('canvas.dropError')
          if (message === t('canvas.invalidSubboardLinkBody')) {
            setWorkspaceActionError(message)
            continue
          }
          firstFailure ??= message
          continue
        }

        if (!placement.value) continue

        const createdBudId = await runCanvasCommand(WHITEBLOOM_COMMAND_IDS.canvas.addBud, {
          position: {
            x: basePosition.x + createdCount * 24,
            y: basePosition.y + createdCount * 24
          },
          moduleType: placement.value.moduleType,
          size: placement.value.size,
          resource: placement.value.resource
        }, {
          source: 'file-picker',
          groupId,
          metadata: {
            preferredBehavior
          }
        })
        if (createdBudId === null) continue
        createdCount += 1
      }

      if (firstFailure) {
        setImageDropError(firstFailure)
      }
    },
    [getDefaultCanvasInsertionPoint, resolveExternalResourcePlacement, runCanvasCommand, t]
  )

  const handleLinkResources = useCallback(async () => {
    const result = await window.api.showLinkFileDialog()
    if (!result.ok || result.filePaths.length === 0) return

    await placePickedResources(result.filePaths, 'link')
  }, [placePickedResources])

  const handleImportResources = useCallback(async () => {
    if (!workspaceRoot) return

    const result = await window.api.showImportFileDialog()
    if (!result.ok || result.filePaths.length === 0) return

    await placePickedResources(result.filePaths, 'import')
  }, [placePickedResources, workspaceRoot])

  const paletteItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = [
      {
        id: 'create-text',
        label: t('canvas.paletteTextLabel'),
        icon: <Type size={14} strokeWidth={1.8} />,
        hint: 'T',
        onActivate: () => {
          const position = screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          })
          insertTextNodeAtPosition(position)
        }
      },
      {
        id: 'create-cluster',
        label: t('canvas.paletteClusterLabel'),
        icon: <Boxes size={14} strokeWidth={1.8} />,
        onActivate: () => {
          createClusterFromSelection()
        }
      }
    ]

    if (workspaceRoot !== null && selectedCluster && selectedCluster.children.length > 0) {
      items.unshift({
        id: 'promote-cluster-to-subboard',
        label: t('canvas.palettePromoteSubboardLabel'),
        icon: <PanelsTopLeft size={14} strokeWidth={1.8} />,
        onActivate: () => {
          openPromoteSubboardModal()
        }
      })
    }

    if (selectedCluster) {
      const clusterItems: PaletteItem[] = [
        {
          id: 'toggle-cluster-autofit',
          label:
            selectedCluster.autofitToContents === true
              ? t('canvas.paletteDisableClusterAutofitLabel')
              : t('canvas.paletteEnableClusterAutofitLabel'),
          subtitle:
            selectedCluster.autofitToContents === true
              ? t('canvas.paletteDisableClusterAutofitSubtitle')
              : t('canvas.paletteEnableClusterAutofitSubtitle'),
          icon: <Scan size={14} strokeWidth={1.8} />,
          onActivate: () => {
            toggleSelectedClusterAutofit()
          }
        }
      ]

      if (selectedCluster.children.length > 0) {
        clusterItems.unshift({
          id: 'fit-cluster-to-nodes',
          label: t('canvas.paletteFitClusterLabel'),
          subtitle: t('canvas.paletteFitClusterSubtitle'),
          icon: <Scan size={14} strokeWidth={1.8} />,
          onActivate: () => {
            fitSelectedClusterToChildren()
          }
        })
      }

      items.unshift(...clusterItems)
    }

    const addUrlPageMode: PaletteInputMode = {
      id: 'add-url-page',
      type: 'input',
      placeholder: t('canvas.addUrlPagePalettePlaceholder'),
      submitLabel: t('canvas.addUrlPageSubmitLabel'),
      onSubmit: (value) => {
        const resource = normalizeWebPageUrl(value)
        if (!resource) return { type: 'keep-open' as const }

        createBudAtPoint({
          position: getDefaultCanvasInsertionPoint(),
          moduleType: webPageBloomModule.id,
          size: webPageBloomModule.defaultSize ?? { w: 88, h: 88 },
          resource
        })

        return { type: 'close' as const }
      }
    }

    items.push({
      id: 'add-url-page',
      label: t('canvas.paletteAddUrlPageLabel'),
      icon: <Globe size={14} strokeWidth={1.8} />,
      onActivate: () => ({
        type: 'set-mode',
        mode: addUrlPageMode
      })
    })

    if (workspaceRoot !== null) {
      const linkableBoards = workspaceBoards.filter((path) => path !== boardPath)
      const linkBoardMode: PaletteMode = {
        id: 'link-board',
        items: linkableBoards.map((linkableBoardPath) => ({
          id: `link-board:${linkableBoardPath}`,
          label: getBoardNameFromPath(linkableBoardPath),
          subtitle: getWorkspaceRelativeBoardPath(linkableBoardPath, workspaceRoot),
          icon: <PanelsTopLeft size={14} strokeWidth={1.8} />,
          onActivate: () => {
            const resource = toWorkspaceBoardResource(linkableBoardPath, workspaceRoot)
            if (!resource) {
              setWorkspaceActionError(t('canvas.invalidSubboardLinkBody'))
              return { type: 'close' as const }
            }

            createBudAtPoint({
              position: getDefaultCanvasInsertionPoint(),
              moduleType: boardBloomModule.id,
              size: boardBloomModule.defaultSize ?? { w: 196, h: 128 },
              label: getBoardNameFromPath(linkableBoardPath),
              resource
            })
            return { type: 'close' as const }
          }
        })),
        placeholder: t('canvas.linkBoardPalettePlaceholder'),
        emptyLabel: t('canvas.linkBoardPaletteEmpty')
      }

      items.push({
        id: 'open-arrangements',
        label: t('canvas.paletteArrangementsLabel'),
        icon: <PanelsTopLeft size={14} strokeWidth={1.8} />,
        hint: 'Arr',
        onActivate: onOpenArrangements
      })
      items.push({
        id: 'link-file',
        label: t('canvas.paletteLinkFileLabel'),
        icon: <Link2 size={14} strokeWidth={1.8} />,
        onActivate: () => {
          void handleLinkResources()
        }
      })
      items.push({
        id: 'import-file',
        label: t('canvas.paletteImportFileLabel'),
        icon: <ArrowDownToLine size={14} strokeWidth={1.8} />,
        onActivate: () => {
          void handleImportResources()
        }
      })
      items.push({
        id: 'link-board',
        label: t('canvas.paletteLinkBoardLabel'),
        icon: <PanelsTopLeft size={14} strokeWidth={1.8} />,
        onActivate: () => ({
          type: 'set-mode',
          mode: linkBoardMode
        })
      })
      items.push({
        id: 'create-focus-writer',
        label: t('canvas.paletteFocusWriterLabel'),
        icon: <FileText size={14} strokeWidth={1.8} />,
        onActivate: () => {
          void createFocusWriterBud()
        }
      })
      items.push({
        id: 'create-schema-bloom',
        label: t('canvas.paletteSchemaBloomLabel'),
        icon: <Database size={14} strokeWidth={1.8} />,
        onActivate: () => {
          void createSchemaBloomBud()
        }
      })
    } else {
      items.push({
        id: 'link-file',
        label: t('canvas.paletteLinkFileLabel'),
        icon: <Link2 size={14} strokeWidth={1.8} />,
        onActivate: () => {
          void handleLinkResources()
        }
      })
    }

    return items
  }, [
    fitSelectedClusterToChildren,
    toggleSelectedClusterAutofit,
    workspaceRoot,
    getDefaultCanvasInsertionPoint,
    createBudAtPoint,
    createClusterFromSelection,
    createFocusWriterBud,
    handleImportResources,
    handleLinkResources,
    createSchemaBloomBud,
    openPromoteSubboardModal,
    onOpenArrangements,
    boardPath,
    selectedCluster,
    setWorkspaceActionError,
    t,
    workspaceBoards,
    screenToFlowPosition,
    addNode
  ])

  const createShapeAtPoint = useCallback(
    (preset: ShapePreset, position: FlowPosition) => {
      const definition = getShapePresetDefinition(preset)
      const id = crypto.randomUUID()
      addNode({
        id,
        kind: 'leaf',
        type: 'shape',
        position,
        size: definition.defaultSize,
        shape: { preset, style: DEFAULT_SHAPE_STYLE }
      } as BoardNodeDraft)
    },
    [addNode]
  )

  const shapeMenuItems = useMemo<PetalMenuItem[]>(
    () => [
      {
        id: 'shape-rectangle',
        label: 'Rectangle',
        icon: <Square size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('rectangle', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-slanted-rectangle',
        label: 'Slanted Rectangle',
        icon: <Square size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('slanted-rectangle', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-diamond',
        label: 'Diamond',
        icon: <Diamond size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('diamond', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-ellipse',
        label: 'Ellipse',
        icon: <Circle size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('ellipse', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-terminator',
        label: 'Terminator',
        icon: <Circle size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('terminator', getDefaultCanvasInsertionPoint())
      }
    ],
    [createShapeAtPoint, getDefaultCanvasInsertionPoint]
  )

  const canvasContextMenuItems = useMemo<PetalMenuItem[]>(
    () => [
      {
        id: 'shape-rectangle',
        label: 'Rectangle',
        icon: <Square size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('rectangle', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-slanted-rectangle',
        label: 'Slanted Rectangle',
        icon: <Square size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('slanted-rectangle', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-diamond',
        label: 'Diamond',
        icon: <Diamond size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('diamond', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-ellipse',
        label: 'Ellipse',
        icon: <Circle size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('ellipse', getDefaultCanvasInsertionPoint())
      },
      {
        id: 'shape-terminator',
        label: 'Terminator',
        icon: <Circle size={14} strokeWidth={1.8} />,
        onActivate: () => createShapeAtPoint('terminator', getDefaultCanvasInsertionPoint())
      },
      { id: 'shapes-sep', type: 'separator' as const },
      {
        id: 'link',
        label: 'Link',
        icon: <Link2 size={14} strokeWidth={1.8} />,
        onActivate: () => {
          void handleLinkResources()
        }
      },
      {
        id: 'import',
        label: 'Import',
        icon: <ArrowDownToLine size={14} strokeWidth={1.8} />,
        subtitle: workspaceRoot === null ? t('canvas.importRequiresWorkspace') : undefined,
        onActivate: () => {
          void handleImportResources()
        },
        disabled: workspaceRoot === null
      }
    ],
    [
      createShapeAtPoint,
      getDefaultCanvasInsertionPoint,
      handleImportResources,
      handleLinkResources,
      t,
      workspaceRoot
    ]
  )

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== 'pointer') return
      if (!isPaneTarget(event.target)) return
      if (event.button !== 2) return

      rightPointerStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        dragged: false
      }
    },
    [activeTool]
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== 'pointer') return
      if (!isPaneTarget(event.target)) return

      const state = rightPointerStateRef.current
      if (!state) return

      const movedFarEnough =
        Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 4
      if (movedFarEnough && !state.dragged) {
        rightPointerStateRef.current = { ...state, dragged: true }
      }
    },
    [activeTool]
  )

  const onMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool !== 'pointer') return
      if (!isPaneTarget(event.target)) return
      if (event.button !== 2) return

      const state = rightPointerStateRef.current
      if (!state) return

      if (!state.dragged) {
        // Reserved for a future custom context-menu trigger.
      }

      rightPointerStateRef.current = null
    },
    [activeTool]
  )

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()

      if (activeTool !== 'pointer') return
      if (!isPaneTarget(event.target)) return

      const state = rightPointerStateRef.current
      if (state?.dragged) return

      setCanvasContextMenu({
        anchor: {
          x: event.clientX,
          y: event.clientY
        },
        flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY })
      })
    },
    [activeTool, screenToFlowPosition]
  )

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (activeTool !== 'pointer' && activeTool !== 'hand') return
      const materialKey = event.dataTransfer.getData(MATERIAL_MIME).trim()
      const hasBoardMaterial = materialKey.length > 0 && isBoardResource(materialKey)
      if (!hasBoardMaterial && !hasNativeFileDragPayload(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [activeTool]
  )

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      if (activeTool !== 'pointer' && activeTool !== 'hand') return

      event.preventDefault()

      const materialKey = event.dataTransfer.getData(MATERIAL_MIME).trim()
      const browserDraggedUri = event.dataTransfer.getData('text/uri-list').trim()
      const droppedFiles = Array.from(event.dataTransfer.files)

      if (materialKey) {
        if (!isBoardResource(materialKey)) return
        if (!workspaceRoot) {
          setWorkspaceActionError(t('canvas.invalidSubboardLinkBody'))
          return
        }

        await runCanvasCommand(WHITEBLOOM_COMMAND_IDS.canvas.addBud, {
          position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          moduleType: boardBloomModule.id,
          size: boardBloomModule.defaultSize ?? { w: 196, h: 128 },
          resource: materialKey
        }, {
          source: 'drag-drop',
          metadata: {
            payloadKind: 'board-resource'
          }
        })
        return
      }

      if (droppedFiles.length === 0) {
        if (browserDraggedUri) {
          setImageDropError(WEB_RESOURCE_DROP_ERROR)
        }
        return
      }

      const basePosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const groupId = createCommandExecutionGroupId()

      const settled = await Promise.allSettled(
        droppedFiles.map(async (file) => {
          const filePath = getDroppedFilePath(file as File & { path?: string })
          if (!filePath) {
            throw new Error(WEB_RESOURCE_DROP_ERROR)
          }

          return resolveExternalResourcePlacement({
            filePath,
            fileName: file.name || filePath,
            file
          })
          /*
          const fileName = file.name || filePath
          const isDir = await window.api.isDirectory(filePath)

          // Shared helper: warn if large, then copy. Returns null if user cancels.
          const importFile = async (): Promise<string | null> => {
            if (warnLargeImport && file.size > LARGE_IMPORT_THRESHOLD_BYTES) {
              const sizeMb = Math.round(file.size / (1024 * 1024))
              const proceed = await window.api.confirmLargeImport(fileName, sizeMb)
              if (!proceed) return null
            }
            const copyResult = await window.api.copyWorkspaceResource(workspaceRoot!, filePath)
            if (!copyResult.ok || !copyResult.resource) {
              throw new Error(`Unable to copy ${fileName} into workspace resources.`)
            }
            return copyResult.resource
          }

          let resource: string
          let moduleType: string | null

          if (isDir) {
            // Directory drop — only directory-aware modules can claim it; always link.
            const module = await dispatchDirectory(filePath)
            moduleType = module?.id ?? null
            resource = absolutePathToFileUri(filePath)
            return { resource, moduleType, size: module?.defaultSize ?? { w: 88, h: 88 } }
          }

          // File drop — dispatch by extension / recognizes()
          const module = dispatchModule(filePath)
          moduleType = module?.id ?? null

          if (moduleType === boardBloomModule.id) {
            const localBoardResource = toWorkspaceBoardResource(filePath, workspaceRoot)
            if (!localBoardResource) {
              throw new Error(t('canvas.invalidSubboardLinkBody'))
            }

            return {
              resource: localBoardResource,
              moduleType,
              size: boardBloomModule.defaultSize ?? { w: 196, h: 128 }
            }
          }

          if (workspaceRoot === null) {
            // Quickboard — always link, no workspace to copy into
            resource = absolutePathToFileUri(filePath)
          } else if (module && module.importable !== false) {
            // Known importable module — copy so the module can read via wloc:
            const imported = await importFile()
            if (imported === null) return // user cancelled the large-file warning
            resource = imported
          } else if (module) {
            // Known module with importable: false — always link
            resource = absolutePathToFileUri(filePath)
          } else {
            // No handler — respect the unhandled drop setting
            const behavior = unhandledDropSetting === 'ask'
              ? await window.api.askImportOrLink(fileName)
              : unhandledDropSetting
            if (behavior === 'import') {
              const imported = await importFile()
              if (imported === null) return // user cancelled the large-file warning
              resource = imported
            } else {
              resource = absolutePathToFileUri(filePath)
            }
          }

          // Images: measure natural dimensions. Known modules: use their default.
          // No handler (null): icon-node dimensions.
          const isImage = file.type.toLowerCase().startsWith('image/')
          const size = isImage
            ? (await measureDroppedImage(file)).size
            : module
              ? (module.defaultSize ?? { w: 220, h: 160 })
              : { w: 88, h: 88 }

          return { resource, moduleType, size }
          */
        })
      )

      let createdCount = 0
      let firstFailure: string | null = null

      for (const result of settled) {
        if (result.status === 'rejected') {
          const message =
            result.reason instanceof Error ? result.reason.message : t('canvas.dropError')
          if (message === t('canvas.invalidSubboardLinkBody')) {
            setWorkspaceActionError(message)
            continue
          }
          firstFailure ??= message
          continue
        }

        if (!result.value) continue

        const { resource, moduleType, size } = result.value
        const createdBudId = await runCanvasCommand(WHITEBLOOM_COMMAND_IDS.canvas.addBud, {
          position: {
            x: basePosition.x + createdCount * 24,
            y: basePosition.y + createdCount * 24
          },
          moduleType,
          size,
          resource
        }, {
          source: 'drag-drop',
          groupId,
          metadata: {
            payloadKind: 'native-files'
          }
        })
        if (createdBudId === null) continue
        createdCount += 1
      }

      if (firstFailure) {
        setImageDropError(firstFailure)
      }
    },
    [
      activeTool,
      runCanvasCommand,
      screenToFlowPosition,
      workspaceRoot,
      t
    ]
  )

  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      updateViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
    },
    [updateViewport]
  )

  return (
    <BloomContext.Provider value={handleBloom}>
      {activeBloom === null && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          zIndexMode="manual"
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onNodeClick={onNodeClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onPaneContextMenu={onPaneContextMenu}
          onMoveEnd={onMoveEnd}
          className={`canvas--tool-${activeTool}${singleSelectedNodeId !== null ? ' canvas--single-select' : ''}`}
          elementsSelectable={activeTool === 'pointer'}
          nodesDraggable={activeTool === 'pointer'}
          nodesConnectable={activeTool === 'pointer'}
          selectNodesOnDrag={false}
          selectionOnDrag={activeTool === 'pointer'}
          elevateNodesOnSelect={false}
          panOnDrag={panOnDragButtons}
          connectionMode={ConnectionMode.Loose}
          connectionLineStyle={{ stroke: 'var(--color-secondary-fg)', strokeWidth: 1.5 }}
          {...(boardViewport
            ? { defaultViewport: boardViewport }
            : { fitView: true, fitViewOptions: { padding: 0.25, maxZoom: 0.75 } })}
          proOptions={{ hideAttribution: true }}
          data-board-capture="root"
        >
          <ProximityTracker boardNodes={boardNodes} setNodes={setNodes} />
          <Background gap={25} size={1} color="var(--color-secondary-fg)" />
          <div data-board-capture="exclude">
            <MiniMap nodeStrokeWidth={1} zoomable pannable />
          </div>
          <Panel position="top-left">
            <div data-board-capture="exclude">
              <BoardContextBar
                name={boardName}
                workspaceRoot={workspaceRoot}
                workspaceName={workspaceConfig?.name}
                isDirty={isDirty}
                onNameChange={(name) => updateBoardMeta({ name })}
                onSave={() => void handleSave()}
                onGoHome={onGoHome}
                onGoToWorkspaceHome={onGoToWorkspaceHome}
                onNewBoard={handleNewBoard}
                onOverflow={setOverflowAnchor}
              />
            </div>
          </Panel>

          <Panel position="bottom-center">
            <div data-board-capture="exclude">
              <CanvasToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onShapesClick={(anchor) => setShapeMenuAnchor(anchor)}
              />
            </div>
          </Panel>
        </ReactFlow>
      )}

      {activeBloom === null && <EdgeToolbar />}

      {activeBloom === null && <ShapeToolbar />}

      {settingsOpen && (
        <SettingsModal
          name={boardName}
          brief={boardBrief}
          onChange={updateBoardMeta}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {promoteSubboardModalOpen ? (
        <PromoteSubboardModal
          boardName={promoteSubboardName}
          busy={promoteSubboardInFlight}
          onBoardNameChange={setPromoteSubboardName}
          onClose={closePromoteSubboardModal}
          onSubmit={() => void handlePromoteClusterToSubboard()}
        />
      ) : null}

      {imageDropError ? (
        <PetalPanel
          title={t('canvas.dropFailedTitle')}
          body={imageDropError}
          onClose={() => setImageDropError(null)}
        >
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setImageDropError(null)}>Close</PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {workspaceActionError ? (
        <PetalPanel
          title={t('canvas.workspaceActionFailedTitle')}
          body={workspaceActionError}
          onClose={() => setWorkspaceActionError(null)}
        >
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setWorkspaceActionError(null)}>
              {t('canvas.closeButton')}
            </PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {pendingDocumentAction ? (
        <PetalPanel
          title={confirmDialogTitle}
          body={confirmDialogBody}
          onClose={handleCancelDocumentAction}
        >
          <div className="petal-panel__actions">
            <PetalButton onClick={handleCancelDocumentAction}>
              {t('canvas.cancelButton')}
            </PetalButton>
            <PetalButton intent="destructive" onClick={handleConfirmDocumentAction}>
              {confirmDialogConfirmLabel}
            </PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {trashBoardConfirmOpen ? (
        <PetalPanel
          title={t('canvas.moveToTrashTitle')}
          body={t('canvas.moveToTrashBody')}
          onClose={() => setTrashBoardConfirmOpen(false)}
        >
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setTrashBoardConfirmOpen(false)}>
              {t('canvas.cancelButton')}
            </PetalButton>
            <PetalButton
              intent="destructive"
              onClick={() => void handleTrashBoard()}
              disabled={trashBoardInFlight}
            >
              {t('canvas.moveToTrashButton')}
            </PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {activeBloom !== null && workspaceRoot !== null && (
        <BloomModal
          bloom={activeBloom}
          workspaceRoot={workspaceRoot}
          onClose={() => setActiveBloom(null)}
        />
      )}

      {paletteSession && (
        <PetalPalette
          items={paletteItems}
          onClose={closePalette}
          placeholder={t('canvas.searchPalettePlaceholder')}
          commandSession={paletteSession}
        />
      )}

      {overflowAnchor
        ? (() => {
            const items: PetalMenuItem[] = [
              {
                id: 'settings',
                label: t('canvas.boardSettingsMenuItem'),
                icon: <Settings2 size={14} strokeWidth={1.8} />,
                onActivate: () => setSettingsOpen(true)
              },
              ...(workspaceRoot === null
                ? [
                    {
                      id: 'promote',
                      label: t('canvas.promoteToWorkspaceMenuItem'),
                      icon: <FolderPlus size={14} strokeWidth={1.8} />,
                      onActivate: () => void handlePromoteToWorkspace(),
                      disabled: promoteInFlight
                    }
                  ]
                : []),
              {
                id: 'trash',
                label: t('canvas.moveToTrashMenuItem'),
                icon: <Trash2 size={14} strokeWidth={1.8} />,
                intent: 'destructive' as const,
                onActivate: () => setTrashBoardConfirmOpen(true),
                disabled: trashBoardInFlight
              }
            ]
            return (
              <PetalMenu
                items={items}
                anchor={overflowAnchor}
                onClose={() => setOverflowAnchor(null)}
              />
            )
          })()
        : null}

      {canvasContextMenu ? (
        <PetalMenu
          items={canvasContextMenuItems}
          anchor={canvasContextMenu.anchor}
          onClose={closeCanvasContextMenu}
        />
      ) : null}

      {shapeMenuAnchor ? (
        <PetalMenu
          items={shapeMenuItems}
          anchor={shapeMenuAnchor}
          onClose={() => setShapeMenuAnchor(null)}
        />
      ) : null}
    </BloomContext.Provider>
  )
}
