import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './canvas/Canvas'
import StartScreen from './components/start-screen/StartScreen'
import CreateBoardModal from './components/workspace-home/CreateBoardModal'
import ConfirmTrashModal from './components/workspace-home/ConfirmTrashModal'
import WorkspaceHome from './components/workspace-home/WorkspaceHome'
import { useBoardStore } from './stores/board'
import { useWorkspaceStore } from './stores/workspace'
import type { Board } from './shared/types'

type RecentBoardItem = {
  path: string
  openedAt: number
  workspaceRoot?: string
  thumbnailUri?: string
}

type AppView = 'board' | 'workspace-home' | 'start'

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

function App(): React.JSX.Element {
  const boardPath = useBoardStore((s) => s.path)
  const boardName = useBoardStore((s) => s.name)
  const isDirty = useBoardStore((s) => s.isDirty)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const clearBoard = useBoardStore((s) => s.clearBoard)

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

  const currentBoardName = boardName?.trim() || (boardPath ? 'Untitled' : null)

  useEffect(() => {
    if (boardPath !== null || workspaceRoot !== null) return

    let cancelled = false

    void (async () => {
      const result = await window.api.listTransientBoards()
      if (cancelled) return

      setTransientBoards(result.ok ? result.boardPaths : [])
    })()

    return () => {
      cancelled = true
    }
  }, [boardPath, workspaceRoot])

  useEffect(() => {
    if (boardPath !== null || workspaceRoot !== null) return

    let cancelled = false

    void (async () => {
      const result = await window.api.listRecentBoards()
      if (cancelled) return

      setRecentBoards(result.ok ? result.boards : [])
    })()

    return () => {
      cancelled = true
    }
  }, [boardPath, workspaceRoot])

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
      window.api.confirmClose()
    })
  }, [boardPath, isDirty])

  const openBoardByPath = useCallback(
    async (nextBoardPath: string) => {
      const json = await window.api.openBoard(nextBoardPath)
      const board = JSON.parse(json) as Board
      loadBoard(board, nextBoardPath)
      setView('board')
    },
    [loadBoard]
  )

  const handleOpenWorkspace = useCallback(async () => {
    setBusyAction('open')
    setShellError(null)

    try {
      const result = await window.api.openWorkspaceDialog()
      if (!result.ok) return

      if (result.workspaceRoot) {
        const workspace = await window.api.readWorkspace(result.workspaceRoot)
        loadWorkspace(workspace)
      } else {
        clearWorkspace()
      }

      if (!result.openBoardPath) {
        clearBoard()
        setView(result.workspaceRoot ? 'workspace-home' : 'start')
        return
      }

      await openBoardByPath(result.openBoardPath)
    } catch (error) {
      clearBoard()
      setShellError(error instanceof Error ? error.message : 'Unable to open the selected workspace or board.')
    } finally {
      setBusyAction(null)
    }
  }, [clearBoard, clearWorkspace, loadWorkspace, openBoardByPath])

  const handleCreateWorkspace = useCallback(async () => {
    setBusyAction('create-workspace')
    setShellError(null)

    try {
      const result = await window.api.createWorkspaceDialog()
      if (!result.ok || !result.workspaceRoot) return

      const workspace = await window.api.readWorkspace(result.workspaceRoot)
      loadWorkspace(workspace)
      clearBoard()
      setView('workspace-home')
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to create a workspace.')
    } finally {
      setBusyAction(null)
    }
  }, [clearBoard, loadWorkspace])

  const handleCreateQuickboard = useCallback(async () => {
    setBusyAction('create-quickboard')
    setShellError(null)

    try {
      const result = await window.api.createQuickboard()
      if (!result.ok || !result.boardPath) return

      clearWorkspace()
      await openBoardByPath(result.boardPath)
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to create a quickboard.')
    } finally {
      setBusyAction(null)
    }
  }, [clearWorkspace, openBoardByPath])

  const handleOpenTransientBoard = useCallback(
    async (nextBoardPath: string) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
        clearWorkspace()
        await openBoardByPath(nextBoardPath)
      } catch (error) {
        setShellError(error instanceof Error ? error.message : 'Unable to open that quickboard.')
      } finally {
        setBusyAction(null)
      }
    },
    [clearWorkspace, openBoardByPath]
  )

  const handleOpenRecentBoard = useCallback(
    async (item: RecentBoardItem) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
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
    [clearBoard, clearWorkspace, loadWorkspace, openBoardByPath]
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
      const result = await window.api.trashBoard(pendingTrashBoard.boardPath)
      if (!result.ok) {
        throw new Error('Unable to move that board into trash.')
      }

      if (pendingTrashBoard.removeFromWorkspace) {
        removeBoard(pendingTrashBoard.boardPath)
      } else {
        setTransientBoards((current) =>
          current.filter((boardPath) => boardPath !== pendingTrashBoard.boardPath)
        )
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
  }, [clearWorkspace, pendingTrashBoard, removeBoard])

  const handleOpenWorkspaceBoard = useCallback(
    async (nextBoardPath: string) => {
      setBusyAction('open-board')
      setShellError(null)

      try {
        await openBoardByPath(nextBoardPath)
      } catch (error) {
        setShellError(error instanceof Error ? error.message : 'Unable to open that board.')
      } finally {
        setBusyAction(null)
      }
    },
    [openBoardByPath]
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
    clearBoard()
    clearWorkspace()
    setShellError(null)
    setView('start')
  }, [clearBoard, clearWorkspace])

  const handleNewBoardFromCanvas = useCallback(() => {
    if (workspaceRoot !== null) {
      handleOpenCreateBoardModal()
    } else {
      void handleCreateQuickboard()
    }
  }, [workspaceRoot, handleOpenCreateBoardModal, handleCreateQuickboard])

  const handleGoHome = useCallback(() => setView('start'), [])
  const handleGoToWorkspaceHome = useCallback(() => setView('workspace-home'), [])
  const handleReturnToBoard = useCallback(() => setView('board'), [])

  const canReturnToBoard = boardPath !== null && view !== 'board'

  if (view === 'board' && boardPath !== null) {
    return (
      <>
        <ReactFlowProvider>
          <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas
              onGoHome={handleGoHome}
              onGoToWorkspaceHome={handleGoToWorkspaceHome}
              onNewBoard={handleNewBoardFromCanvas}
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
      </>
    )
  }

  if (view === 'workspace-home' || (workspaceRoot !== null && view !== 'start')) {
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
      {pendingTrashBoard ? (
        <ConfirmTrashModal
          busy={busyAction === 'trash-board'}
          onClose={handleCloseTrashModal}
          onConfirm={() => void handleConfirmTrashBoard()}
        />
      ) : null}
    </>
  )
}

export default App
