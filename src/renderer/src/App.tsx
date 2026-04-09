import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { Canvas } from './canvas/Canvas'
import ArrangementsView from './components/arrangements/ArrangementsView'
import ProjectFinderWindow, {
  type ProjectFinderMode
} from './components/project-finder/ProjectFinderWindow'
import StartScreen from './components/start-screen/StartScreen'
import CreateBoardModal from './components/workspace-home/CreateBoardModal'
import ConfirmTrashModal from './components/workspace-home/ConfirmTrashModal'
import WorkspaceHome from './components/workspace-home/WorkspaceHome'
import { PetalButton, PetalPanel } from './components/petal'
import { useBoardStore } from './stores/board'
import { useWorkspaceStore } from './stores/workspace'
import {
  isTextLeafNode,
  lexicalContentToPlainText,
  makeLexicalContent,
  type Board
} from './shared/types'

type RecentBoardItem = {
  path: string
  openedAt: number
  workspaceRoot?: string
  thumbnailUri?: string
}

type AppView = 'arrangements' | 'board' | 'workspace-home' | 'start'
type ReturnView = 'board' | 'workspace-home'

type BusyAction =
  | 'open'
  | 'create-workspace'
  | 'create-quickboard'
  | 'create-board'
  | 'open-board'
  | 'trash-board'
  | null

type PendingTrashBoard = {
  boardPath: string
  removeFromWorkspace?: boolean
  clearWorkspace?: boolean
}

type PendingNavigationTarget = 'arrangements' | 'start' | 'workspace-home'

type PendingViewTransition = {
  target: PendingNavigationTarget
  returnView?: ReturnView
}

type PendingBoardOpen = {
  boardPath: string
}

type PendingNavigation = PendingViewTransition | PendingBoardOpen

async function captureAndSaveThumbnail(boardPath: string, workspaceRoot: string): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  try {
    const module = await import('./canvas/captureBoardThumbnail')
    const dataUrl = await module.captureBoardThumbnail()
    if (!dataUrl) return
    await window.api.saveThumbnail(boardPath, workspaceRoot, dataUrl)
  } catch (error) {
    console.error('[thumbnail] capture or save failed:', error)
  }
}

function App(): React.JSX.Element {
  const { t } = useTranslation()
  const boardPath = useBoardStore((s) => s.path)
  const boardName = useBoardStore((s) => s.name)
  const boardBrief = useBoardStore((s) => s.brief)
  const boardTransient = useBoardStore((s) => s.transient === true)
  const boardNodes = useBoardStore((s) => s.nodes)
  const boardEdges = useBoardStore((s) => s.edges)
  const boardViewport = useBoardStore((s) => s.viewport)
  const boardVersion = useBoardStore((s) => s.version)
  const isDirty = useBoardStore((s) => s.isDirty)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const clearBoard = useBoardStore((s) => s.clearBoard)
  const markSaved = useBoardStore((s) => s.markSaved)
  const setBoardPersistence = useBoardStore((s) => s.setBoardPersistence)

  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const workspaceConfig = useWorkspaceStore((s) => s.config)
  const workspaceBoards = useWorkspaceStore((s) => s.boards)
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
  const addBoard = useWorkspaceStore((s) => s.addBoard)
  const removeBoard = useWorkspaceStore((s) => s.removeBoard)
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace)

  const [view, setView] = useState<AppView>('start')
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [shellError, setShellError] = useState<string | null>(null)
  const [transientBoards, setTransientBoards] = useState<string[]>([])
  const [recentBoards, setRecentBoards] = useState<RecentBoardItem[]>([])
  const [boardThumbnails, setBoardThumbnails] = useState<Record<string, string>>({})
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('Board')
  const [pendingTrashBoard, setPendingTrashBoard] = useState<PendingTrashBoard | null>(null)
  const [arrangementsReturnView, setArrangementsReturnView] = useState<ReturnView>('workspace-home')
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null)
  const [projectFinderMode, setProjectFinderMode] = useState<ProjectFinderMode | null>(null)

  const currentBoardName = boardName?.trim() || (boardPath ? 'Untitled' : null)

  const buildBoardSnapshot = useCallback(
    (options?: { transient?: boolean }): Board => {
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
        version: boardVersion,
        ...(options?.transient ? { transient: true as const } : {}),
        ...(boardName?.trim() ? { name: boardName.trim() } : {}),
        ...(boardBrief?.trim() ? { brief: boardBrief.trim() } : {}),
        nodes,
        edges: boardEdges,
        ...(boardViewport ? { viewport: boardViewport } : {})
      }
    },
    [boardBrief, boardEdges, boardName, boardNodes, boardVersion, boardViewport]
  )

  const saveCurrentBoard = useCallback(async (): Promise<boolean> => {
    if (!boardPath) return false

    if (boardTransient) {
      const normalizedPath = boardPath.replace(/\\/g, '/')
      const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)
      const suggestedName = boardName?.trim() || fileName.replace(/\.wb\.json$/i, '') || 'Board'
      const saveDialogResult = await window.api.showBoardSaveDialog(suggestedName)
      if (!saveDialogResult.ok || !saveDialogResult.boardPath) return false

      const promotedSnapshot = buildBoardSnapshot({ transient: false })
      const promotionResult = await window.api.promoteBoard(
        boardPath,
        saveDialogResult.boardPath,
        JSON.stringify(promotedSnapshot, null, 2)
      )

      if (!promotionResult.ok || !promotionResult.boardPath) return false

      setBoardPersistence(promotionResult.boardPath, false)
      markSaved()
      return true
    }

    const result = await window.api.saveBoard(
      boardPath,
      JSON.stringify(buildBoardSnapshot({ transient: false }), null, 2)
    )
    if (!result.ok) return false

    markSaved()
    return true
  }, [
    boardName,
    boardPath,
    boardTransient,
    buildBoardSnapshot,
    markSaved,
    setBoardPersistence
  ])

  const captureCurrentBoardThumbnailOnClose = useCallback(async (): Promise<void> => {
    if (boardPath === null || workspaceRoot === null || boardTransient || isDirty) return
    await captureAndSaveThumbnail(boardPath, workspaceRoot)
  }, [boardPath, boardTransient, isDirty, workspaceRoot])

  const applyViewTransition = useCallback((transition: PendingViewTransition) => {
    if (transition.target === 'arrangements') {
      setArrangementsReturnView(transition.returnView ?? 'workspace-home')
      setView('arrangements')
      return
    }

    setView(transition.target)
  }, [])

  const requestViewTransition = useCallback(
    (transition: PendingViewTransition) => {
      if (boardPath !== null && isDirty) {
        setPendingNavigation(transition)
        return
      }

      applyViewTransition(transition)
    },
    [applyViewTransition, boardPath, isDirty]
  )

  useEffect(() => {
    if (view !== 'start') return

    let cancelled = false

    void (async () => {
      const result = await window.api.listTransientBoards()
      if (cancelled) return

      setTransientBoards(result.ok ? result.boardPaths : [])
    })()

    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (view !== 'start') return

    let cancelled = false

    void (async () => {
      const result = await window.api.listRecentBoards()
      if (cancelled) return

      setRecentBoards(result.ok ? result.boards : [])
    })()

    return () => {
      cancelled = true
    }
  }, [view])

  useEffect(() => {
    if (view !== 'workspace-home' || !workspaceRoot || workspaceBoards.length === 0) {
      setBoardThumbnails({})
      return
    }

    let cancelled = false

    void (async () => {
      const entries = await Promise.all(
        workspaceBoards.map(async (boardPath) => {
          const result = await window.api.getThumbnailUri(boardPath, workspaceRoot)
          return [boardPath, result.ok && result.uri ? result.uri : null] as const
        })
      )
      if (cancelled) return

      const thumbnails: Record<string, string> = {}
      for (const [path, uri] of entries) {
        if (uri) thumbnails[path] = uri
      }
      setBoardThumbnails(thumbnails)
    })()

    return () => {
      cancelled = true
    }
  }, [view, workspaceBoards, workspaceRoot])

  useEffect(() => {
    return window.api.onCloseRequested(() => {
      if (boardPath !== null && isDirty) return

      void (async () => {
        await captureCurrentBoardThumbnailOnClose()
        window.api.confirmClose()
      })()
    })
  }, [boardPath, captureCurrentBoardThumbnailOnClose, isDirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (workspaceRoot === null) return
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return
      if (event.key.toLowerCase() !== 'a') return

      event.preventDefault()

      if (view === 'board') {
        requestViewTransition({ target: 'arrangements', returnView: 'board' })
        return
      }

      if (view === 'workspace-home') {
        requestViewTransition({ target: 'arrangements', returnView: 'workspace-home' })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestViewTransition, view, workspaceRoot])

  const openBoardByPath = useCallback(
    async (nextBoardPath: string) => {
      const json = await window.api.openBoard(nextBoardPath)
      const board = JSON.parse(json) as Board
      loadBoard(board, nextBoardPath)
      setView('board')
    },
    [loadBoard]
  )

  const performBoardOpen = useCallback(
    async (nextBoardPath: string) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
        if (boardPath !== null && boardPath !== nextBoardPath) {
          await captureCurrentBoardThumbnailOnClose()
        }
        await openBoardByPath(nextBoardPath)
      } catch (error) {
        setShellError(error instanceof Error ? error.message : 'Unable to open that board.')
      } finally {
        setBusyAction(null)
      }
    },
    [boardPath, captureCurrentBoardThumbnailOnClose, openBoardByPath]
  )

  const requestBoardOpen = useCallback(
    (nextBoardPath: string) => {
      if (boardPath !== null && isDirty) {
        setPendingNavigation({ boardPath: nextBoardPath })
        return
      }

      void performBoardOpen(nextBoardPath)
    },
    [boardPath, isDirty, performBoardOpen]
  )

  const handleOpenWorkspace = useCallback(() => {
    setShellError(null)
    setProjectFinderMode('open')
  }, [])

  const handleCreateWorkspace = useCallback(() => {
    setShellError(null)
    setProjectFinderMode('new-workspace')
  }, [])

  const handleCloseProjectFinder = useCallback(() => {
    setProjectFinderMode(null)
  }, [])

  const handleOpenWorkspaceFromFinder = useCallback(
    async (nextWorkspaceRoot: string) => {
      setBusyAction('open')
      setShellError(null)

      try {
        await captureCurrentBoardThumbnailOnClose()
        const workspace = await window.api.readWorkspace(nextWorkspaceRoot)
        loadWorkspace(workspace)
        clearBoard()
        setProjectFinderMode(null)
        setView('workspace-home')
      } catch (error) {
        setShellError(error instanceof Error ? error.message : 'Unable to open that workspace.')
      } finally {
        setBusyAction(null)
      }
    },
    [captureCurrentBoardThumbnailOnClose, clearBoard, loadWorkspace]
  )

  const handleOpenBoardFromFinder = useCallback(
    async (nextBoardPath: string, nextWorkspaceRoot?: string) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
        if (boardPath !== null && boardPath !== nextBoardPath) {
          await captureCurrentBoardThumbnailOnClose()
        }
        if (nextWorkspaceRoot) {
          const workspace = await window.api.readWorkspace(nextWorkspaceRoot)
          loadWorkspace(workspace)
        } else {
          clearWorkspace()
        }
        await openBoardByPath(nextBoardPath)
        setProjectFinderMode(null)
      } catch (error) {
        clearBoard()
        setShellError(error instanceof Error ? error.message : 'Unable to open that board.')
      } finally {
        setBusyAction(null)
      }
    },
    [boardPath, captureCurrentBoardThumbnailOnClose, clearBoard, clearWorkspace, loadWorkspace, openBoardByPath]
  )

  const handleCreateWorkspaceAtPath = useCallback(
    async (nextWorkspaceRoot: string) => {
      setBusyAction('create-workspace')
      setShellError(null)

      try {
        await captureCurrentBoardThumbnailOnClose()
        const result = await window.api.createWorkspaceAtPath(nextWorkspaceRoot)
        if (!result.ok || !result.workspaceRoot) {
          throw new Error('Unable to create a workspace in that folder.')
        }

        const workspace = await window.api.readWorkspace(result.workspaceRoot)
        loadWorkspace(workspace)
        clearBoard()
        setProjectFinderMode(null)
        setView('workspace-home')
      } catch (error) {
        setShellError(error instanceof Error ? error.message : 'Unable to create a workspace.')
      } finally {
        setBusyAction(null)
      }
    },
    [captureCurrentBoardThumbnailOnClose, clearBoard, loadWorkspace]
  )

  const handleCreateQuickboard = useCallback(async () => {
    setBusyAction('create-quickboard')
    setShellError(null)

    try {
      await captureCurrentBoardThumbnailOnClose()
      const result = await window.api.createQuickboard()
      if (!result.ok || !result.boardPath) return

      clearWorkspace()
      await openBoardByPath(result.boardPath)
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to create a quickboard.')
    } finally {
      setBusyAction(null)
    }
  }, [captureCurrentBoardThumbnailOnClose, clearWorkspace, openBoardByPath])

  const handleOpenTransientBoard = useCallback(
    async (nextBoardPath: string) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
        if (boardPath !== null && boardPath !== nextBoardPath) {
          await captureCurrentBoardThumbnailOnClose()
        }
        clearWorkspace()
        await openBoardByPath(nextBoardPath)
      } catch (error) {
        setShellError(error instanceof Error ? error.message : 'Unable to open that quickboard.')
      } finally {
        setBusyAction(null)
      }
    },
    [boardPath, captureCurrentBoardThumbnailOnClose, clearWorkspace, openBoardByPath]
  )

  const handleOpenRecentBoard = useCallback(
    async (item: RecentBoardItem) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
        if (boardPath !== null && boardPath !== item.path) {
          await captureCurrentBoardThumbnailOnClose()
        }
        if (item.workspaceRoot) {
          const workspace = await window.api.readWorkspace(item.workspaceRoot)
          loadWorkspace(workspace)
        } else {
          clearWorkspace()
        }
        await openBoardByPath(item.path)
      } catch (error) {
        clearBoard()
        setShellError(error instanceof Error ? error.message : 'Unable to open that board.')
      } finally {
        setBusyAction(null)
      }
    },
    [boardPath, captureCurrentBoardThumbnailOnClose, clearBoard, clearWorkspace, loadWorkspace, openBoardByPath]
  )

  const handleRequestTrashBoard = useCallback(
    (nextBoardPath: string, options?: { removeFromWorkspace?: boolean; clearWorkspace?: boolean }) => {
      setShellError(null)

      setPendingTrashBoard({
        boardPath: nextBoardPath,
        removeFromWorkspace: options?.removeFromWorkspace,
        clearWorkspace: options?.clearWorkspace
      })
    },
    []
  )

  const handleCloseTrashModal = useCallback(() => {
    if (busyAction === 'trash-board') return
    setPendingTrashBoard(null)
  }, [busyAction])

  const handleConfirmTrashBoard = useCallback(async () => {
    if (!pendingTrashBoard) return

    setBusyAction('trash-board')
    setShellError(null)

    try {
      const trashedBoardPath = pendingTrashBoard.boardPath
      const result = await window.api.trashBoard(trashedBoardPath)
      if (!result.ok) {
        throw new Error('Unable to move that board into trash.')
      }

      if (pendingTrashBoard.removeFromWorkspace) {
        removeBoard(trashedBoardPath)
      } else {
        setTransientBoards((current) =>
          current.filter((boardPath) => boardPath !== trashedBoardPath)
        )
      }

      setRecentBoards((current) =>
        current.filter((item) => item.path !== trashedBoardPath)
      )

      if (boardPath === trashedBoardPath) {
        clearBoard()
      }

      if (pendingTrashBoard.clearWorkspace) {
        clearWorkspace()
      }

      setPendingTrashBoard(null)
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to move that board into trash.')
    } finally {
      setBusyAction(null)
    }
  }, [boardPath, clearBoard, clearWorkspace, pendingTrashBoard, removeBoard])

  const handleOpenWorkspaceBoard = useCallback(
    (nextBoardPath: string) => {
      requestBoardOpen(nextBoardPath)
    },
    [requestBoardOpen]
  )

  const handleOpenCreateBoardModal = useCallback(() => {
    setShellError(null)
    setNewBoardName('Board')
    setIsCreateBoardModalOpen(true)
  }, [])

  const handleCloseCreateBoardModal = useCallback(() => {
    if (busyAction === 'create-board') return
    setIsCreateBoardModalOpen(false)
  }, [busyAction])

  const handleCreateWorkspaceBoard = useCallback(async () => {
    if (!workspaceRoot) return

    setBusyAction('create-board')
    setShellError(null)

    try {
      const result = await window.api.createBoard(workspaceRoot, newBoardName)
      if (!result.ok || !result.boardPath) {
        throw new Error('Unable to create a board in this workspace.')
      }

      setIsCreateBoardModalOpen(false)
      addBoard(result.boardPath)
      await openBoardByPath(result.boardPath)
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to create a board.')
    } finally {
      setBusyAction(null)
    }
  }, [addBoard, newBoardName, openBoardByPath, workspaceRoot])

  const handleCloseWorkspace = useCallback(() => {
    void (async () => {
      await captureCurrentBoardThumbnailOnClose()
      clearBoard()
      clearWorkspace()
      setShellError(null)
      setView('start')
    })()
  }, [captureCurrentBoardThumbnailOnClose, clearBoard, clearWorkspace])

  const handleNewBoardFromCanvas = useCallback(() => {
    if (workspaceRoot !== null) {
      handleOpenCreateBoardModal()
    } else {
      void handleCreateQuickboard()
    }
  }, [workspaceRoot, handleOpenCreateBoardModal, handleCreateQuickboard])

  const handleGoHome = useCallback(
    () => requestViewTransition({ target: 'start' }),
    [requestViewTransition]
  )
  const handleGoToWorkspaceHome = useCallback(
    () => requestViewTransition({ target: 'workspace-home' }),
    [requestViewTransition]
  )
  const handleOpenArrangementsFromWorkspace = useCallback(
    () => requestViewTransition({ target: 'arrangements', returnView: 'workspace-home' }),
    [requestViewTransition]
  )
  const handleOpenArrangementsFromBoard = useCallback(
    () => requestViewTransition({ target: 'arrangements', returnView: 'board' }),
    [requestViewTransition]
  )
  const handleReturnToBoard = useCallback(() => setView('board'), [])
  const handleReturnFromArrangements = useCallback(
    () => setView(arrangementsReturnView),
    [arrangementsReturnView]
  )
  const handleConfirmViewTransition = useCallback(async () => {
    if (!pendingNavigation) return

    const saved = await saveCurrentBoard()
    if (!saved) return

    if ('target' in pendingNavigation) {
      applyViewTransition(pendingNavigation)
    } else {
      await performBoardOpen(pendingNavigation.boardPath)
    }

    setPendingNavigation(null)
  }, [applyViewTransition, pendingNavigation, performBoardOpen, saveCurrentBoard])
  const handleDiscardViewTransition = useCallback(() => {
    if (!pendingNavigation) return

    if ('target' in pendingNavigation) {
      applyViewTransition(pendingNavigation)
    } else {
      void performBoardOpen(pendingNavigation.boardPath)
    }

    setPendingNavigation(null)
  }, [applyViewTransition, pendingNavigation, performBoardOpen])
  const handleCancelViewTransition = useCallback(() => {
    setPendingNavigation(null)
  }, [])

  const canReturnToBoard = boardPath !== null && view !== 'board'
  const pendingNavigationDialog = pendingNavigation ? (
    <PetalPanel
      title={t('navigation.saveBeforeLeavingTitle')}
      body={t('navigation.saveBeforeLeavingBody')}
      onClose={handleCancelViewTransition}
    >
      <div className="petal-panel__actions">
        <PetalButton onClick={handleCancelViewTransition}>
          {t('navigation.cancelButton')}
        </PetalButton>
        <PetalButton onClick={() => void handleConfirmViewTransition()}>
          {t('navigation.saveButton')}
        </PetalButton>
        <PetalButton intent="destructive" onClick={handleDiscardViewTransition}>
          {t('navigation.discardButton')}
        </PetalButton>
      </div>
    </PetalPanel>
  ) : null

  if (view === 'board' && boardPath !== null) {
    return (
      <>
        <ReactFlowProvider>
          <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas
              onGoHome={handleGoHome}
              onGoToWorkspaceHome={handleGoToWorkspaceHome}
              onOpenArrangements={handleOpenArrangementsFromBoard}
              onNewBoard={handleNewBoardFromCanvas}
              onOpenBoard={(nextBoardPath) => void handleOpenWorkspaceBoard(nextBoardPath)}
            />
          </div>
        </ReactFlowProvider>
        {isCreateBoardModalOpen ? (
          <CreateBoardModal
            boardName={newBoardName}
            busy={busyAction === 'create-board'}
            onBoardNameChange={setNewBoardName}
            onClose={handleCloseCreateBoardModal}
            onSubmit={() => void handleCreateWorkspaceBoard()}
          />
        ) : null}
        {pendingNavigationDialog}
      </>
    )
  }

  if (view === 'arrangements' && workspaceRoot !== null) {
    return (
      <>
        <ArrangementsView
          workspaceName={workspaceConfig?.name}
          onBack={handleReturnFromArrangements}
          onOpenBoard={handleOpenWorkspaceBoard}
        />
        {pendingNavigationDialog}
      </>
    )
  }

  if (
    view === 'workspace-home' ||
    (workspaceRoot !== null && view !== 'start' && view !== 'arrangements')
  ) {
    return (
      <>
        <WorkspaceHome
          busy={busyAction !== null}
          errorMessage={shellError}
          workspaceName={workspaceConfig?.name}
          workspaceBrief={workspaceConfig?.brief}
          boards={workspaceBoards.map((path) => ({ path, thumbnailUri: boardThumbnails[path] }))}
          currentBoardName={canReturnToBoard ? currentBoardName : null}
          onReturnToBoard={canReturnToBoard ? handleReturnToBoard : null}
          onOpenArrangements={workspaceRoot !== null ? handleOpenArrangementsFromWorkspace : null}
          onCreateBoard={handleOpenCreateBoardModal}
          onOpenBoard={(nextBoardPath) => void handleOpenWorkspaceBoard(nextBoardPath)}
          onTrashBoard={(nextBoardPath) =>
            void handleRequestTrashBoard(nextBoardPath, { removeFromWorkspace: true })
          }
          onCloseWorkspace={handleCloseWorkspace}
        />
        {isCreateBoardModalOpen ? (
          <CreateBoardModal
            boardName={newBoardName}
            busy={busyAction === 'create-board'}
            onBoardNameChange={setNewBoardName}
            onClose={handleCloseCreateBoardModal}
            onSubmit={() => void handleCreateWorkspaceBoard()}
          />
        ) : null}
        {pendingTrashBoard ? (
          <ConfirmTrashModal
            busy={busyAction === 'trash-board'}
            onClose={handleCloseTrashModal}
            onConfirm={() => void handleConfirmTrashBoard()}
          />
        ) : null}
        {pendingNavigationDialog}
      </>
    )
  }

  return (
    <>
      <StartScreen
        busy={busyAction !== null}
        errorMessage={shellError}
        transientBoards={transientBoards}
        recentBoards={recentBoards}
        currentBoardName={canReturnToBoard ? currentBoardName : null}
        onReturnToBoard={canReturnToBoard ? handleReturnToBoard : null}
        onOpenWorkspace={() => void handleOpenWorkspace()}
        onCreateWorkspace={() => void handleCreateWorkspace()}
        onCreateQuickboard={() => void handleCreateQuickboard()}
        onOpenTransientBoard={(nextBoardPath) => void handleOpenTransientBoard(nextBoardPath)}
        onOpenRecentBoard={(item) => void handleOpenRecentBoard(item)}
        onTrashBoard={(nextBoardPath) => void handleRequestTrashBoard(nextBoardPath)}
      />
      {projectFinderMode ? (
        <ProjectFinderWindow
          mode={projectFinderMode}
          busy={busyAction !== null}
          preferredPath={workspaceRoot}
          onOpenWorkspace={(nextWorkspaceRoot) => void handleOpenWorkspaceFromFinder(nextWorkspaceRoot)}
          onOpenBoard={(nextBoardPath, nextWorkspaceRoot) =>
            void handleOpenBoardFromFinder(nextBoardPath, nextWorkspaceRoot)
          }
          onCreateWorkspaceAtPath={(nextWorkspaceRoot) =>
            void handleCreateWorkspaceAtPath(nextWorkspaceRoot)
          }
          onClose={handleCloseProjectFinder}
        />
      ) : null}
      {pendingTrashBoard ? (
        <ConfirmTrashModal
          busy={busyAction === 'trash-board'}
          onClose={handleCloseTrashModal}
          onConfirm={() => void handleConfirmTrashBoard()}
        />
      ) : null}
      {pendingNavigationDialog}
    </>
  )
}

export default App
