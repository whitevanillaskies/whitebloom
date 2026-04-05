import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  type Node as RFNode,
  type NodeChange,
  applyNodeChanges,
  Panel,
  useReactFlow,
  MiniMap
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useBoardStore } from '@renderer/stores/board'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import { TextNode } from './TextNode'
import { ImageNode } from './ImageNode'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'
import BoardTitle from '@renderer/components/board-title/BoardTitle'
import SettingsModal from '@renderer/components/settings-modal/SettingsModal'
import { PetalButton, PetalPanel } from '@renderer/components/petal'
import { absolutePathToFileUri } from '@renderer/shared/resource-url'
import type { Board } from '@renderer/shared/types'
import { makeLexicalContent } from '@renderer/shared/types'
import { lexicalContentToPlainText } from '@renderer/shared/types'
import type { Tool } from './tools'
import './Canvas.css'

const nodeTypes = { text: TextNode, image: ImageNode }
const IMAGE_DROP_MAX_VIEWPORT_FRACTION = 0.4

const WEB_RESOURCE_DROP_ERROR = 'Can\'t embed web resources — save the image to your local drive first, then drop it.'

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

export function Canvas() {
  const boardNodes = useBoardStore((s) => s.nodes)
  const boardEdges = useBoardStore((s) => s.edges)
  const version = useBoardStore((s) => s.version)
  const boardPath = useBoardStore((s) => s.path)
  const boardTransient = useBoardStore((s) => s.transient === true)
  const boardName = useBoardStore((s) => s.name)
  const boardBrief = useBoardStore((s) => s.brief)
  const isDirty = useBoardStore((s) => s.isDirty)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const addNode = useBoardStore((s) => s.addNode)
  const deleteNodes = useBoardStore((s) => s.deleteNodes)
  const clearBoard = useBoardStore((s) => s.clearBoard)
  const markSaved = useBoardStore((s) => s.markSaved)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const setBoardPersistence = useBoardStore((s) => s.setBoardPersistence)
  const updateBoardMeta = useBoardStore((s) => s.updateBoardMeta)
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
  const removeWorkspaceBoard = useWorkspaceStore((s) => s.removeBoard)
  const username = useAppSettingsStore((s) => s.user.username)
  const loadAppSettings = useAppSettingsStore((s) => s.loadAppSettings)
  const updateUsername = useAppSettingsStore((s) => s.updateUsername)

  const { screenToFlowPosition } = useReactFlow()

  const [activeTool, setActiveTool] = useState<Tool>('pointer')
  const [autoEditRequest, setAutoEditRequest] = useState<{ id: string; token: number } | null>(null)
  const [pendingDocumentAction, setPendingDocumentAction] = useState<'close' | 'exit' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [imageDropError, setImageDropError] = useState<string | null>(null)
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null)
  const [promoteInFlight, setPromoteInFlight] = useState(false)
  const [trashBoardInFlight, setTrashBoardInFlight] = useState(false)
  const [trashBoardConfirmOpen, setTrashBoardConfirmOpen] = useState(false)
  const autoEditSequenceRef = useRef(0)
  const rightPointerStateRef = useRef<{ startX: number; startY: number; dragged: boolean } | null>(null)
  const transientAutosaveRef = useRef<string | null>(null)

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
        if (n.type === 'image') {
          return {
            id: n.id,
            type: n.type,
            position: { x: n.position.x, y: n.position.y },
            data: { resource: n.resource, size: n.size }
          }
        }
        return {
          id: n.id,
          type: n.type,
          position: { x: n.position.x, y: n.position.y },
          data: {
            content: n.content ?? makeLexicalContent(n.label ?? ''),
            widthMode: n.widthMode ?? 'auto',
            wrapWidth: n.wrapWidth ?? null,
            size: n.size,
            autoEditToken: autoEditRequest?.id === n.id ? autoEditRequest.token : undefined
          }
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
    if (activeTool === 'pointer') return

    setNodes((prev) => {
      if (!prev.some((n) => n.selected)) return prev
      return prev.map((n) => ({ ...n, selected: false }))
    })
  }, [activeTool])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateNodePosition(change.id, change.position.x, change.position.y)
        }
      }
    },
    [updateNodePosition]
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
      if (node.type !== 'text') return node

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
      edges: boardEdges
    }
  }, [version, boardName, boardBrief, boardNodes, boardEdges])

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

  const handleCloseBoard = useCallback(() => {
    if (isDirty) {
      setPendingDocumentAction('close')
      return
    }

    clearBoard()
  }, [clearBoard, isDirty])

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
      setWorkspaceActionError(
        error instanceof Error ? error.message : 'Unable to promote this quickboard into a workspace.'
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
        throw new Error('Unable to move this board into wbapp:trash.')
      }

      if (workspaceRoot !== null) {
        removeWorkspaceBoard(boardPath)
      }

      setTrashBoardConfirmOpen(false)
      clearBoard()
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : 'Unable to move this board into wbapp:trash.'
      )
    } finally {
      setTrashBoardInFlight(false)
    }
  }, [boardPath, clearBoard, removeWorkspaceBoard, workspaceRoot])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditableTarget(event.target)) return
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
  }, [boardNodes, deleteNodes, handleSave, nodes, settingsOpen, setActiveTool, setNodes, updateNodeText])

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
      return
    }

    if (pendingDocumentAction === 'close') {
      clearBoard()
    }

    setPendingDocumentAction(null)
  }, [clearBoard, pendingDocumentAction])

  const handleCancelDocumentAction = useCallback(() => {
    setPendingDocumentAction(null)
  }, [])

  const confirmDialogTitle =
    pendingDocumentAction === 'exit'
        ? 'Exit without saving?'
        : workspaceRoot
          ? 'Return to workspace home?'
          : 'Close quickboard?'
  const confirmDialogBody =
    pendingDocumentAction === 'exit'
        ? 'You have unsaved changes. Do you want to discard them and exit?'
        : workspaceRoot
          ? 'You have unsaved changes. Do you want to discard them and return to the workspace home screen?'
          : 'You have unsaved changes. Do you want to discard them and close this quickboard?'
  const confirmDialogConfirmLabel =
    pendingDocumentAction === 'exit'
        ? 'Exit'
        : workspaceRoot
          ? 'Return to workspace'
          : 'Close board'

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

      const imageFiles = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.toLowerCase().startsWith('image/')
      )
      if (imageFiles.length === 0) {
        if (browserDraggedUri) {
          setImageDropError(WEB_RESOURCE_DROP_ERROR)
        }
        return
      }

      const basePosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const measuredImages = await Promise.allSettled(
        imageFiles.map(async (file) => {
          const droppedFilePath = getDroppedFilePath(file as File & { path?: string })
          if (!droppedFilePath) {
            throw new Error(WEB_RESOURCE_DROP_ERROR)
          }

          const { size } = await measureDroppedImage(file)
          if (workspaceRoot !== null) {
            const copyResult = await window.api.copyWorkspaceResource(workspaceRoot, droppedFilePath)
            if (!copyResult.ok || !copyResult.resource) {
              throw new Error(`Unable to copy ${file.name || droppedFilePath} into workspace resources.`)
            }

            return { resource: copyResult.resource, size }
          }

          return { resource: absolutePathToFileUri(droppedFilePath), size }
        })
      )

      let createdCount = 0
      let firstFailure: string | null = null

      measuredImages.forEach((result) => {
        if (result.status === 'rejected') {
          firstFailure ??= result.reason instanceof Error ? result.reason.message : 'Unable to load dropped image.'
          return
        }

        addNode({
          id: crypto.randomUUID(),
          kind: 'leaf',
          type: 'image',
          position: {
            x: basePosition.x + createdCount * 24,
            y: basePosition.y + createdCount * 24
          },
          size: result.value.size,
          resource: result.value.resource
        })
        createdCount += 1
      })

      if (firstFailure) {
        setImageDropError(firstFailure)
      }
    },
    [activeTool, addNode, screenToFlowPosition, workspaceRoot]
  )

  return (
    <>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onPaneContextMenu={onPaneContextMenu}
        className={`canvas--tool-${activeTool}`}
        elementsSelectable={activeTool === 'pointer'}
        nodesDraggable={activeTool === 'pointer'}
        nodesConnectable={activeTool === 'pointer'}
        selectionOnDrag={activeTool === 'pointer'}
        panOnDrag={panOnDragButtons}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={25} size={1} color="var(--color-secondary-fg)" />
        <MiniMap nodeStrokeWidth={1} zoomable pannable />
        <Panel position="top-left">
          <BoardTitle
            name={boardName}
            onNameChange={(name) => updateBoardMeta({ name })}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </Panel>
        <Panel position="top-right">
          <div className="canvas-shell-actions">
            {workspaceRoot === null ? (
              <button
                type="button"
                className="canvas-shell-actions__button canvas-shell-actions__button--primary"
                onClick={() => void handlePromoteToWorkspace()}
                disabled={promoteInFlight}
              >
                Promote to Workspace
              </button>
            ) : null}
            <button
              type="button"
              className="canvas-shell-actions__button"
              onClick={() => setTrashBoardConfirmOpen(true)}
              disabled={trashBoardInFlight}
            >
              Move to Trash
            </button>
            <button type="button" className="canvas-shell-actions__button" onClick={handleCloseBoard}>
              {workspaceRoot ? 'Workspace Home' : 'Close Board'}
            </button>
          </div>
        </Panel>
        <Panel position="bottom-center">
          <CanvasToolbar
            activeTool={activeTool}
            hasUnsavedChanges={isDirty}
            onToolChange={setActiveTool}
            onSave={handleSave}
          />
        </Panel>
      </ReactFlow>

      {settingsOpen && (
        <SettingsModal
          name={boardName}
          brief={boardBrief}
          username={username}
          onChange={updateBoardMeta}
          onUsernameChange={(nextUsername) => void updateUsername(nextUsername)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {imageDropError ? (
        <PetalPanel title="Image drop failed" body={imageDropError} onClose={() => setImageDropError(null)}>
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setImageDropError(null)}>Close</PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {workspaceActionError ? (
        <PetalPanel title="Workspace action failed" body={workspaceActionError} onClose={() => setWorkspaceActionError(null)}>
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setWorkspaceActionError(null)}>Close</PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {pendingDocumentAction ? (
        <PetalPanel title={confirmDialogTitle} body={confirmDialogBody} onClose={handleCancelDocumentAction}>
          <div className="petal-panel__actions">
            <PetalButton onClick={handleCancelDocumentAction}>Cancel</PetalButton>
            <PetalButton intent="destructive" onClick={handleConfirmDocumentAction}>
              {confirmDialogConfirmLabel}
            </PetalButton>
          </div>
        </PetalPanel>
      ) : null}

      {trashBoardConfirmOpen ? (
        <PetalPanel
          title="Move board to trash?"
          body="This moves the board file into wbapp:trash. Any unsaved in-memory edits will be lost."
          onClose={() => setTrashBoardConfirmOpen(false)}
        >
          <div className="petal-panel__actions">
            <PetalButton onClick={() => setTrashBoardConfirmOpen(false)}>Cancel</PetalButton>
            <PetalButton
              intent="destructive"
              onClick={() => void handleTrashBoard()}
              disabled={trashBoardInFlight}
            >
              Move to trash
            </PetalButton>
          </div>
        </PetalPanel>
      ) : null}
    </>
  )
}
