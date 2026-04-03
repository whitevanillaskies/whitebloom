import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  type Node as RFNode,
  type NodeChange,
  applyNodeChanges,
  Panel,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useBoardStore } from '@renderer/stores/board'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import { TextNode } from './TextNode'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'
import BoardTitle from '@renderer/components/board-title/BoardTitle'
import SettingsModal from '@renderer/components/settings-modal/SettingsModal'
import type { Board } from '@renderer/shared/types'
import { makeLexicalContent } from '@renderer/shared/types'
import { lexicalContentToPlainText } from '@renderer/shared/types'
import type { Tool } from './tools'
import './Canvas.css'

const nodeTypes = { text: TextNode }

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
  const [pendingDocumentAction, setPendingDocumentAction] = useState<'new' | 'load' | null>(null)
  const [currentBoardFilePath, setCurrentBoardFilePath] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  // Derive RF nodes from store
  const schemaNodes: RFNode[] = useMemo(
    () =>
      boardNodes.map((n) => ({
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
      })),
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
    }

    setPendingDocumentAction(null)
  }, [handleLoad, pendingDocumentAction, startNewBoard])

  const handleCancelDocumentAction = useCallback(() => {
    setPendingDocumentAction(null)
  }, [])

  const confirmDialogTitle = pendingDocumentAction === 'load' ? 'Load a document?' : 'Start a new document?'
  const confirmDialogBody =
    pendingDocumentAction === 'load'
      ? 'You have unsaved changes. Do you want to discard them and load another document?'
      : 'You have unsaved changes. Do you want to discard them and start fresh?'
  const confirmDialogConfirmLabel = pendingDocumentAction === 'load' ? 'Load document' : 'New Document'

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

  return (
    <>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
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
