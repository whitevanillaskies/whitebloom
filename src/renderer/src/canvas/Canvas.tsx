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
import { TextNode } from './TextNode'
import { ImageNode } from './ImageNode'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'
import BoardTitle from '@renderer/components/board-title/BoardTitle'
import SettingsModal from '@renderer/components/settings-modal/SettingsModal'
import type { Board } from '@renderer/shared/types'
import { makeLexicalContent } from '@renderer/shared/types'
import { lexicalContentToPlainText } from '@renderer/shared/types'
import type { Tool } from './tools'
import './Canvas.css'

const nodeTypes = { text: TextNode, image: ImageNode }
const IMAGE_DROP_MAX_VIEWPORT_FRACTION = 0.4

function toFileUrl(resourcePath: string): string {
  return `wb-file://local?p=${encodeURIComponent(resourcePath)}`
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

function measureDroppedImage(file: File & { path?: string }): Promise<{ resource: string; size: { w: number; h: number } }> {
  const resource = getDroppedFilePath(file)
  if (!resource) {
    return Promise.reject(new Error('Dropped image is missing a file path.'))
  }

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const naturalWidth = image.naturalWidth
      const naturalHeight = image.naturalHeight

      if (naturalWidth <= 0 || naturalHeight <= 0) {
        reject(new Error(`Unable to read image dimensions for ${file.name || resource}.`))
        return
      }

      const viewportLongestSide = Math.max(window.innerWidth, window.innerHeight)
      const maxLongestSide = Math.max(80, viewportLongestSide * IMAGE_DROP_MAX_VIEWPORT_FRACTION)
      const imageLongestSide = Math.max(naturalWidth, naturalHeight)
      const scale = imageLongestSide > maxLongestSide ? maxLongestSide / imageLongestSide : 1

      resolve({
        resource,
        size: {
          w: Math.max(1, Math.round(naturalWidth * scale)),
          h: Math.max(1, Math.round(naturalHeight * scale))
        }
      })
    }

    image.onerror = () => {
      reject(new Error(`Unable to load image ${file.name || resource} from ${resource}.`))
    }

    image.decoding = 'async'
    image.src = toFileUrl(resource)
  })
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, [contenteditable="true"]') !== null
}

function isPaneTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.react-flow__pane') !== null
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
  const updateBoardMeta = useBoardStore((s) => s.updateBoardMeta)
  const username = useAppSettingsStore((s) => s.user.username)
  const loadAppSettings = useAppSettingsStore((s) => s.loadAppSettings)
  const updateUsername = useAppSettingsStore((s) => s.updateUsername)

  const { screenToFlowPosition } = useReactFlow()

  const [activeTool, setActiveTool] = useState<Tool>('pointer')
  const [autoEditRequest, setAutoEditRequest] = useState<{ id: string; token: number } | null>(null)
  const [pendingDocumentAction, setPendingDocumentAction] = useState<'new' | 'load' | 'exit' | null>(null)
  const [currentBoardFilePath, setCurrentBoardFilePath] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [imageDropError, setImageDropError] = useState<string | null>(null)
  const autoEditSequenceRef = useRef(0)
  const rightPointerStateRef = useRef<{ startX: number; startY: number; dragged: boolean } | null>(null)

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

  const startNewBoard = useCallback(() => {
    clearBoard()
    setCurrentBoardFilePath(null)
  }, [clearBoard])

  const handleSave = useCallback(async () => {
    const nodes = boardNodes.map((node) => {
      if (node.type !== 'text') return node

      const content = node.content ?? makeLexicalContent(node.label ?? '')
      return {
        ...node,
        content,
        plain: lexicalContentToPlainText(content)
      }
    })

    const board: Board = {
      version,
      ...(boardName?.trim() ? { name: boardName.trim() } : {}),
      ...(boardBrief?.trim() ? { brief: boardBrief.trim() } : {}),
      nodes,
      edges: boardEdges
    }
    const payload = JSON.stringify(board, null, 2)

    const result = currentBoardFilePath
      ? await window.api.saveBoardToPath(currentBoardFilePath, payload)
      : await window.api.saveBoardAs(payload)

    if (result.ok) {
      setCurrentBoardFilePath(result.filePath ?? currentBoardFilePath)
      markSaved()
    }
  }, [version, boardName, boardBrief, boardNodes, boardEdges, currentBoardFilePath, markSaved])

  const handleLoad = useCallback(async () => {
    const result = await window.api.loadBoard()
    if (!result.ok || !result.json) return
    try {
      const board: Board = JSON.parse(result.json)
      loadBoard(board)
      setCurrentBoardFilePath(result.filePath ?? null)
    } catch {
      console.error('Failed to parse board file')
    }
  }, [loadBoard])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        if (settingsOpen) {
          setSettingsOpen(false)
          return
        }
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

      if (event.key.toLowerCase() === 'n' && (event.ctrlKey || event.metaKey)) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        if (isDirty) {
          setPendingDocumentAction('new')
          return
        }

        startNewBoard()
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
  }, [boardNodes, deleteNodes, handleSave, isDirty, nodes, settingsOpen, setActiveTool, setNodes, startNewBoard, updateNodeText])

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

  const handleNewBoardClick = useCallback(() => {
    if (isDirty) {
      setPendingDocumentAction('new')
      return
    }

    startNewBoard()
  }, [isDirty, startNewBoard])

  const handleLoadClick = useCallback(() => {
    if (isDirty) {
      setPendingDocumentAction('load')
      return
    }

    void handleLoad()
  }, [handleLoad, isDirty])

  const handleConfirmDocumentAction = useCallback(() => {
    if (pendingDocumentAction === 'new') {
      startNewBoard()
    } else if (pendingDocumentAction === 'load') {
      void handleLoad()
    } else if (pendingDocumentAction === 'exit') {
      window.api.confirmClose()
      return
    }

    setPendingDocumentAction(null)
  }, [handleLoad, pendingDocumentAction, startNewBoard])

  const handleCancelDocumentAction = useCallback(() => {
    setPendingDocumentAction(null)
  }, [])

  const confirmDialogTitle =
    pendingDocumentAction === 'load'
      ? 'Load a document?'
      : pendingDocumentAction === 'exit'
        ? 'Exit without saving?'
        : 'Start a new document?'
  const confirmDialogBody =
    pendingDocumentAction === 'load'
      ? 'You have unsaved changes. Do you want to discard them and load another document?'
      : pendingDocumentAction === 'exit'
        ? 'You have unsaved changes. Do you want to discard them and exit?'
        : 'You have unsaved changes. Do you want to discard them and start fresh?'
  const confirmDialogConfirmLabel =
    pendingDocumentAction === 'load'
      ? 'Load document'
      : pendingDocumentAction === 'exit'
        ? 'Exit'
        : 'New Document'

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

      const imageFiles = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.toLowerCase().startsWith('image/')
      )
      if (imageFiles.length === 0) return

      const basePosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const measuredImages = await Promise.allSettled(
        imageFiles.map((file) => measureDroppedImage(file as File & { path?: string }))
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
    [activeTool, addNode, screenToFlowPosition]
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
        <Panel position="bottom-center">
          <CanvasToolbar
            activeTool={activeTool}
            hasUnsavedChanges={isDirty}
            onToolChange={setActiveTool}
            onNewBoard={handleNewBoardClick}
            onSave={handleSave}
            onLoad={handleLoadClick}
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
        <div className="canvas-modal__overlay" role="presentation" onClick={() => setImageDropError(null)}>
          <div
            className="canvas-modal"
            role="alertdialog"
            aria-modal="true"
            aria-label="Image drop failed"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="canvas-modal__title">Image drop failed</h2>
            <p className="canvas-modal__body">{imageDropError}</p>
            <div className="canvas-modal__actions">
              <button type="button" className="canvas-modal__button" onClick={() => setImageDropError(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDocumentAction ? (
        <div className="canvas-modal__overlay" role="presentation" onClick={handleCancelDocumentAction}>
          <div
            className="canvas-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="canvas-modal__title">{confirmDialogTitle}</h2>
            <p className="canvas-modal__body">{confirmDialogBody}</p>
            <div className="canvas-modal__actions">
              <button type="button" className="canvas-modal__button" onClick={handleCancelDocumentAction}>
                Cancel
              </button>
              <button
                type="button"
                className="canvas-modal__button canvas-modal__button--danger"
                onClick={handleConfirmDocumentAction}
              >
                {confirmDialogConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
