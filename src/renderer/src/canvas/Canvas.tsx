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
  MiniMap
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import { useBoardStore } from '@renderer/stores/board'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { TextNode } from './TextNode'
import { BudNode } from './BudNode'
import { ClusterNode } from './ClusterNode'
import type { ClusterData } from './ClusterNode'
import { ProximityTracker } from './ProximityTracker'
import { WbEdge } from './WbEdge'
import type { WbEdgeData } from './WbEdge'
import { EdgeToolbar } from './EdgeToolbar'
import { BloomContext, type ActiveBloom } from './BloomContext'
import { BloomModal } from './BloomModal'
import '../modules/index'
import { dispatchDirectory, dispatchModule } from '../modules/registry'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'
import BoardContextBar from '@renderer/components/board-context-bar/BoardContextBar'
import SettingsModal from '@renderer/components/settings-modal/SettingsModal'
import { Boxes, Database, FileText, FolderPlus, Scan, Settings2, Trash2, Type } from 'lucide-react'
import { PetalButton, PetalMenu, PetalPalette, PetalPanel } from '@renderer/components/petal'
import type { PaletteItem, PetalMenuItem } from '@renderer/components/petal'
import { focusWriterModule } from '../modules/focus-writer'
import { schemaBloomModule } from '../modules/schemabloom'
import { absolutePathToFileUri } from '@renderer/shared/resource-url'
import type { Board } from '@renderer/shared/types'
import { makeLexicalContent } from '@renderer/shared/types'
import { lexicalContentToPlainText } from '@renderer/shared/types'
import { isClusterNode } from '@renderer/shared/types'
import { isTextLeafNode } from '@renderer/shared/types'
import type { Tool } from './tools'
import { captureBoardThumbnail } from './captureBoardThumbnail'
import './Canvas.css'

async function captureAndSaveThumbnail(boardPath: string, workspaceRoot: string): Promise<void> {
  // Defer capture by one animation frame so it doesn't block the post-save UI
  // update. toJpeg does heavy synchronous DOM work on the render thread.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  try {
    const dataUrl = await captureBoardThumbnail()
    if (!dataUrl) return
    await window.api.saveThumbnail(boardPath, workspaceRoot, dataUrl)
  } catch (error) {
    console.error('[thumbnail] capture or save failed:', error)
  }
}

const nodeTypes = { text: TextNode, bud: BudNode, cluster: ClusterNode }
const edgeTypes = { wb: WbEdge }
const IMAGE_DROP_MAX_VIEWPORT_FRACTION = 0.4
const LARGE_IMPORT_THRESHOLD_BYTES = 50 * 1024 * 1024 // 50 MB
const DEFAULT_CLUSTER_SIZE = { w: 320, h: 220 }
const CLUSTER_SELECTION_PADDING = 48

const WEB_RESOURCE_DROP_ERROR = 'Can\'t embed web resources — save the image to your local drive first, then drop it.'

type NodeBounds = {
  left: number
  top: number
  right: number
  bottom: number
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, [contenteditable="true"]') !== null
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

function blurToolbarButtonIfFocused(): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return
  if (active.closest('.canvas-toolbar__button') === null) return
  active.blur()
}

type CanvasProps = {
  onGoHome: () => void
  onGoToWorkspaceHome: () => void
  onNewBoard: () => void
}

export function Canvas({ onGoHome, onGoToWorkspaceHome, onNewBoard }: CanvasProps) {
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
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const translateCluster = useBoardStore((s) => s.translateCluster)
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const updateViewport = useBoardStore((s) => s.updateViewport)
  const addNode = useBoardStore((s) => s.addNode)
  const addCluster = useBoardStore((s) => s.addCluster)
  const createClusterFromNodes = useBoardStore((s) => s.createClusterFromNodes)
  const reconcileNodeClusterMembership = useBoardStore((s) => s.reconcileNodeClusterMembership)
  const reconcileClusterMembershipsForCluster = useBoardStore((s) => s.reconcileClusterMembershipsForCluster)
  const deleteNodes = useBoardStore((s) => s.deleteNodes)
  const storeAddEdge = useBoardStore((s) => s.addEdge)
  const storeDeleteEdge = useBoardStore((s) => s.deleteEdge)
  const clearBoard = useBoardStore((s) => s.clearBoard)
  const markSaved = useBoardStore((s) => s.markSaved)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const setBoardPersistence = useBoardStore((s) => s.setBoardPersistence)
  const updateBoardMeta = useBoardStore((s) => s.updateBoardMeta)
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
  const removeWorkspaceBoard = useWorkspaceStore((s) => s.removeBoard)
  const unhandledDropSetting = useAppSettingsStore((s) => s.files.unhandledDrop)
  const warnLargeImport = useAppSettingsStore((s) => s.files.warnLargeImport)
  const loadAppSettings = useAppSettingsStore((s) => s.loadAppSettings)

  const { screenToFlowPosition } = useReactFlow()

  const [activeTool, setActiveTool] = useState<Tool>('pointer')
  const [activeBloom, setActiveBloom] = useState<ActiveBloom | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [autoEditRequest, setAutoEditRequest] = useState<{ id: string; token: number } | null>(null)
  const [pendingDocumentAction, setPendingDocumentAction] = useState<'exit' | 'newBoard' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [imageDropError, setImageDropError] = useState<string | null>(null)
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null)
  const [pendingNodeSelectionId, setPendingNodeSelectionId] = useState<string | null>(null)
  const [promoteInFlight, setPromoteInFlight] = useState(false)
  const [trashBoardInFlight, setTrashBoardInFlight] = useState(false)
  const [trashBoardConfirmOpen, setTrashBoardConfirmOpen] = useState(false)
  const [overflowAnchor, setOverflowAnchor] = useState<{ x: number; y: number } | null>(null)
  const autoEditSequenceRef = useRef(0)
  const rightPointerStateRef = useRef<{ startX: number; startY: number; dragged: boolean } | null>(null)
  const transientAutosaveRef = useRef<string | null>(null)

  const handleBloom = useCallback((bloom: ActiveBloom) => {
    if (bloom.module.defaultRenderer === 'external') {
      void window.api.openFile(bloom.resource)
      return
    }
    setActiveBloom(bloom)
  }, [setActiveBloom])

  const createFocusWriterBud = useCallback(async () => {
    if (!workspaceRoot) return
    const resource = `wloc:blossoms/note-${Date.now()}.blt`
    const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    await window.api.writeBlossom(workspaceRoot, resource, '')
    const id = crypto.randomUUID()
    addNode({ id, kind: 'bud', type: focusWriterModule.id, position, size: { w: 220, h: 160 }, resource })
    setActiveBloom({ nodeId: id, module: focusWriterModule, resource })
  }, [workspaceRoot, screenToFlowPosition, addNode])

  const createSchemaBloomBud = useCallback(async () => {
    if (!workspaceRoot) return
    const resource = `wloc:blossoms/schema-${Date.now()}.bdb`
    const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    await window.api.writeBlossom(workspaceRoot, resource, schemaBloomModule.createDefault!())
    const id = crypto.randomUUID()
    addNode({ id, kind: 'bud', type: schemaBloomModule.id, position, size: { w: 88, h: 88 }, resource })
    setActiveBloom({ nodeId: id, module: schemaBloomModule, resource })
  }, [workspaceRoot, screenToFlowPosition, addNode])

  const createEmptyCluster = useCallback(() => {
    const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const id = crypto.randomUUID()
    addCluster({
      id,
      kind: 'cluster',
      type: null,
      label: 'Cluster',
      color: 'blue',
      children: [],
      position: {
        x: Math.round(position.x - DEFAULT_CLUSTER_SIZE.w / 2),
        y: Math.round(position.y - DEFAULT_CLUSTER_SIZE.h / 2)
      },
      size: DEFAULT_CLUSTER_SIZE
    })
    setPendingNodeSelectionId(id)
  }, [addCluster, screenToFlowPosition])

  const activeToolRef = useRef(activeTool)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])

  const spacebarModeRef = useRef<'idle' | 'pressing' | 'tap-held'>('idle')
  const spacebarPreviousToolRef = useRef<Tool>('pointer')
  const spacebarPressTimeRef = useRef(0)

  useEffect(() => {
    void loadAppSettings()
  }, [loadAppSettings])

  useEffect(() => {
    return window.api.onCloseRequested(() => {
      if (isDirty) {
        setPendingDocumentAction('exit')
      } else {
        window.api.confirmClose()
      }
    })
  }, [isDirty])

  // Derive RF nodes from store
  const schemaNodes: RFNode[] = useMemo(
    () =>
      boardNodes.map((n) => {
        if (n.kind === 'cluster') {
          return {
            id: n.id,
            type: 'cluster',
            position: { x: n.position.x, y: n.position.y },
            data: {
              label: n.label,
              color: n.color,
              size: n.size
            } satisfies ClusterData,
            zIndex: 0,
            draggable: true
          }
        }

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
            zIndex: 10
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
          zIndex: 10
        }
      }),
    [autoEditRequest, boardNodes]
  )

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

  // Derive RF edges from store
  const schemaEdges: RFEdge[] = useMemo(
    () =>
      boardEdges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        type: 'wb',
        label: e.label,
        data: { style: e.style, color: e.color } satisfies WbEdgeData,
      })),
    [boardEdges]
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

  const selectedCluster = useMemo(() => {
    if (!singleSelectedNodeId) return null
    const node = boardNodes.find((candidate) => candidate.id === singleSelectedNodeId)
    return node && isClusterNode(node) ? node : null
  }, [boardNodes, singleSelectedNodeId])

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
          typeof liveNode?.width === 'number' && liveNode.width > 0 ? liveNode.width : boardNode.size.w
        const height =
          typeof liveNode?.height === 'number' && liveNode.height > 0 ? liveNode.height : boardNode.size.h
        const position = liveNode?.position ?? boardNode.position

        return {
          left: position.x,
          top: position.y,
          right: position.x + width,
          bottom: position.y + height
        }
      })
      .filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== null)

    if (childBounds.length === 0) return

    const minX = Math.min(...childBounds.map((bounds) => bounds.left))
    const minY = Math.min(...childBounds.map((bounds) => bounds.top))
    const maxX = Math.max(...childBounds.map((bounds) => bounds.right))
    const maxY = Math.max(...childBounds.map((bounds) => bounds.bottom))

    const nextPosition = {
      x: Math.round(minX - CLUSTER_SELECTION_PADDING),
      y: Math.round(minY - CLUSTER_SELECTION_PADDING)
    }
    const nextSize = {
      w: Math.round(maxX - minX + CLUSTER_SELECTION_PADDING * 2),
      h: Math.round(maxY - minY + CLUSTER_SELECTION_PADDING * 2)
    }

    updateNodePosition(selectedCluster.id, nextPosition.x, nextPosition.y)
    updateNodeSize(selectedCluster.id, nextSize.w, nextSize.h)
    reconcileClusterMembershipsForCluster(selectedCluster.id)
  }, [
    boardNodes,
    nodes,
    screenToFlowPosition,
    reconcileClusterMembershipsForCluster,
    selectedCluster,
    updateNodePosition,
    updateNodeSize
  ])

  const clusterChildrenById = useMemo(() => {
    const mapping = new Map<string, string[]>()
    for (const node of boardNodes) {
      if (!isClusterNode(node)) continue
      mapping.set(node.id, node.children)
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

      const clusterPositionChanges = changes.filter(
        isClusterPositionChange
      )
      const childIdsMovedByClusters = new Set<string>()
      for (const change of clusterPositionChanges) {
        for (const childId of clusterChildrenById.get(change.id) ?? []) {
          childIdsMovedByClusters.add(childId)
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

        let nextNodes = otherChanges.length > 0 ? applyNodeChanges(otherChanges, currentNodes) : currentNodes

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

        return nextNodes
      })

      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          if (clusterChildrenById.has(change.id)) {
            const cluster = boardNodes.find(
              (node) => node.id === change.id && isClusterNode(node)
            )
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
    [boardNodes, clusterChildrenById, reconcileNodeClusterMembership, translateCluster, updateNodePosition]
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
        targetHandle: connection.targetHandle ?? null,
      })
    },
    [storeAddEdge]
  )

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'text') return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = crypto.randomUUID()
      const nextToken = autoEditSequenceRef.current + 1
      autoEditSequenceRef.current = nextToken
      setAutoEditRequest({ id, token: nextToken })
      addNode({
        id,
        kind: 'leaf',
        type: 'text',
        position,
        size: { w: 200, h: 40 },
        content: makeLexicalContent(''),
        widthMode: 'auto',
        wrapWidth: null
      })
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
              size: { w: 200, h: 40 },
              autoEditToken: nextToken
            },
            selected: true
          }
        ]
      })
      setActiveTool('pointer')
    },
    [activeTool, screenToFlowPosition, addNode]
  )

  const buildBoardSnapshot = useCallback((options?: { transient?: boolean }): Board => {
    const nodes = boardNodes.map((node) => {
      if (!isTextLeafNode(node)) return node

      const content = node.content ?? makeLexicalContent(node.label ?? '')
      return {
        ...node,
        content,
        plain: lexicalContentToPlainText(content)
      }
    })

    return {
      version,
      ...(options?.transient ? { transient: true as const } : {}),
      ...(boardName?.trim() ? { name: boardName.trim() } : {}),
      ...(boardBrief?.trim() ? { brief: boardBrief.trim() } : {}),
      nodes,
      edges: boardEdges,
      ...(boardViewport ? { viewport: boardViewport } : {})
    }
  }, [version, boardName, boardBrief, boardNodes, boardEdges, boardViewport])

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
        if (workspaceRoot !== null) {
          void captureAndSaveThumbnail(promotionResult.boardPath, workspaceRoot)
        }
      }
      return
    }

    const result = await window.api.saveBoard(
      boardPath,
      JSON.stringify(buildBoardSnapshot({ transient: false }), null, 2)
    )

    if (result.ok) {
      markSaved()
      if (workspaceRoot !== null) {
        void captureAndSaveThumbnail(boardPath, workspaceRoot)
      }
    }
  }, [boardName, boardPath, boardTransient, buildBoardSnapshot, markSaved, setBoardPersistence, workspaceRoot])


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

      void captureAndSaveThumbnail(createBoardResult.boardPath, createWorkspaceResult.workspaceRoot)

      const workspace = await window.api.readWorkspace(createWorkspaceResult.workspaceRoot)
      loadWorkspace(workspace)
      loadBoard(snapshot, createBoardResult.boardPath)
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : t('canvas.promoteError')
      )
    } finally {
      setPromoteInFlight(false)
    }
  }, [boardPath, boardTransient, buildBoardSnapshot, loadBoard, loadWorkspace, workspaceRoot])

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
      setWorkspaceActionError(
        error instanceof Error ? error.message : t('canvas.trashError')
      )
    } finally {
      setTrashBoardInFlight(false)
    }
  }, [boardPath, clearBoard, removeWorkspaceBoard, workspaceRoot])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (isEditableTarget(event.target)) return
        if (activeBloom !== null) return
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }

      if (event.key === 'Escape') {
        if (isEditableTarget(event.target)) return
        if (activeBloom !== null) {
          event.preventDefault()
          setActiveBloom(null)
          return
        }
        if (paletteOpen) {
          event.preventDefault()
          setPaletteOpen(false)
          return
        }
        if (settingsOpen) {
          event.preventDefault()
          setSettingsOpen(false)
          return
        }
        // Let PetalPanel handle Escape when any panel is open
        if (imageDropError || workspaceActionError || pendingDocumentAction || trashBoardConfirmOpen) return
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
          updateNodeText(node.id, { content: node.content ?? makeLexicalContent(''), widthMode: 'auto', wrapWidth: null })
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

      const selectedIds = nodes.filter((node) => node.selected).map((node) => node.id)
      if (selectedIds.length === 0) return

      event.preventDefault()
      deleteNodes(selectedIds)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeBloom, boardNodes, deleteNodes, handleSave, nodes, paletteOpen, settingsOpen, setActiveTool, setNodes, updateNodeText])

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

  const confirmDialogTitle = pendingDocumentAction === 'newBoard'
    ? t('canvas.discardChangestitle')
    : t('canvas.exitWithoutSavingTitle')
  const confirmDialogBody = pendingDocumentAction === 'newBoard'
    ? t('canvas.discardChangesBody')
    : t('canvas.exitWithoutSavingBody')
  const confirmDialogConfirmLabel = pendingDocumentAction === 'newBoard' ? t('canvas.discardButton') : t('canvas.exitButton')

  const paletteItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = [
      {
        id: 'create-text',
        label: t('canvas.paletteTextLabel'),
        icon: <Type size={14} strokeWidth={1.8} />,
        hint: 'T',
        onActivate: () => {
          const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
          const id = crypto.randomUUID()
          const nextToken = autoEditSequenceRef.current + 1
          autoEditSequenceRef.current = nextToken
          setAutoEditRequest({ id, token: nextToken })
          addNode({ id, kind: 'leaf', type: 'text', position, size: { w: 200, h: 40 }, content: makeLexicalContent(''), widthMode: 'auto', wrapWidth: null })
        }
      },
      {
        id: 'create-cluster',
        label: t('canvas.paletteClusterLabel'),
        icon: <Boxes size={14} strokeWidth={1.8} />,
        onActivate: () => {
          createEmptyCluster()
        }
      }
    ]

    if (selectedCluster) {
      items.unshift({
        id: 'fit-cluster-to-children',
        label: t('canvas.paletteFitClusterLabel'),
        icon: <Scan size={14} strokeWidth={1.8} />,
        onActivate: () => {
          fitSelectedClusterToChildren()
        }
      })
    }

    if (selectedClusterableNodes.length > 0) {
      items.unshift({
        id: 'create-cluster-from-selection',
        label: t('canvas.paletteClusterSelectionLabel'),
        icon: <Boxes size={14} strokeWidth={1.8} />,
        onActivate: () => {
          createClusterFromSelection()
        }
      })
    }

    if (workspaceRoot !== null) {
      items.push({
        id: 'create-focus-writer',
        label: t('canvas.paletteFocusWriterLabel'),
        icon: <FileText size={14} strokeWidth={1.8} />,
        onActivate: () => { void createFocusWriterBud() }
      })
      items.push({
        id: 'create-schema-bloom',
        label: t('canvas.paletteSchemaBloomLabel'),
        icon: <Database size={14} strokeWidth={1.8} />,
        onActivate: () => { void createSchemaBloomBud() }
      })
    }

    return items
  }, [
    fitSelectedClusterToChildren,
    workspaceRoot,
    screenToFlowPosition,
    addNode,
    createClusterFromSelection,
    createEmptyCluster,
    createFocusWriterBud,
    createSchemaBloomBud,
    selectedCluster,
    selectedClusterableNodes.length,
    t
  ])

  const panOnDragButtons = useMemo(() => {
    if (activeTool === 'hand') return [0, 1, 2]
    if (activeTool === 'pointer') return [1, 2]
    return false
  }, [activeTool])

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

      const movedFarEnough = Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 4
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
      if (activeTool !== 'pointer') return
      event.preventDefault()
    },
    [activeTool]
  )

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (activeTool !== 'pointer' && activeTool !== 'hand') return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [activeTool]
  )

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      if (activeTool !== 'pointer' && activeTool !== 'hand') return

      event.preventDefault()

      const browserDraggedUri = event.dataTransfer.getData('text/uri-list').trim()
      const droppedFiles = Array.from(event.dataTransfer.files)

      if (droppedFiles.length === 0) {
        if (browserDraggedUri) {
          setImageDropError(WEB_RESOURCE_DROP_ERROR)
        }
        return
      }

      const basePosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const settled = await Promise.allSettled(
        droppedFiles.map(async (file) => {
          const filePath = getDroppedFilePath(file as File & { path?: string })
          if (!filePath) {
            throw new Error(WEB_RESOURCE_DROP_ERROR)
          }

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
        })
      )

      let createdCount = 0
      let firstFailure: string | null = null

      settled.forEach((result) => {
        if (result.status === 'rejected') {
          firstFailure ??= result.reason instanceof Error ? result.reason.message : t('canvas.dropError')
          return
        }

        if (!result.value) return

        const { resource, moduleType, size } = result.value
        addNode({
          id: crypto.randomUUID(),
          kind: 'bud',
          type: moduleType,
          position: {
            x: basePosition.x + createdCount * 24,
            y: basePosition.y + createdCount * 24
          },
          size,
          resource
        })
        createdCount += 1
      })

      if (firstFailure) {
        setImageDropError(firstFailure)
      }
    },
    [activeTool, addNode, screenToFlowPosition, workspaceRoot, unhandledDropSetting, warnLargeImport]
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
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
            />
          </div>
        </Panel>
      </ReactFlow>
      )}

      {activeBloom === null && (
        <EdgeToolbar edges={edges} />
      )}

      {settingsOpen && (
        <SettingsModal
          name={boardName}
          brief={boardBrief}
          onChange={updateBoardMeta}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {imageDropError ? (
        <PetalPanel title={t('canvas.dropFailedTitle')} body={imageDropError} onClose={() => setImageDropError(null)}>
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setImageDropError(null)}>Close</PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {workspaceActionError ? (
        <PetalPanel title={t('canvas.workspaceActionFailedTitle')} body={workspaceActionError} onClose={() => setWorkspaceActionError(null)}>
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setWorkspaceActionError(null)}>{t('canvas.closeButton')}</PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {pendingDocumentAction ? (
        <PetalPanel title={confirmDialogTitle} body={confirmDialogBody} onClose={handleCancelDocumentAction}>
          <div className="petal-panel__actions">
            <PetalButton onClick={handleCancelDocumentAction}>{t('canvas.cancelButton')}</PetalButton>
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
            <PetalButton onClick={() => setTrashBoardConfirmOpen(false)}>{t('canvas.cancelButton')}</PetalButton>
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

      {paletteOpen && (
        <PetalPalette
          items={paletteItems}
          onClose={() => setPaletteOpen(false)}
          placeholder={t('canvas.searchPalettePlaceholder')}
        />
      )}

      {overflowAnchor ? (() => {
        const items: PetalMenuItem[] = [
          {
            id: 'settings',
            label: t('canvas.boardSettingsMenuItem'),
            icon: <Settings2 size={14} strokeWidth={1.8} />,
            onActivate: () => setSettingsOpen(true)
          },
          ...(workspaceRoot === null
            ? [{
                id: 'promote',
                label: t('canvas.promoteToWorkspaceMenuItem'),
                icon: <FolderPlus size={14} strokeWidth={1.8} />,
                onActivate: () => void handlePromoteToWorkspace(),
                disabled: promoteInFlight
              }]
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
      })() : null}
    </BloomContext.Provider>
  )
}
