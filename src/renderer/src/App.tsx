import { useCallback, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './canvas/Canvas'
import StartScreen from './components/start-screen/StartScreen'
import WorkspaceHome from './components/workspace-home/WorkspaceHome'
import { useBoardStore } from './stores/board'
import { useWorkspaceStore } from './stores/workspace'
import type { Board } from './shared/types'

type BusyAction = 'open' | 'create-workspace' | 'create-quickboard' | 'create-board' | 'open-board' | null

function App(): React.JSX.Element {
  const boardPath = useBoardStore((s) => s.path)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const clearBoard = useBoardStore((s) => s.clearBoard)

  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const workspaceConfig = useWorkspaceStore((s) => s.config)
  const workspaceBoards = useWorkspaceStore((s) => s.boards)
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
  const addBoard = useWorkspaceStore((s) => s.addBoard)
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace)

  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [shellError, setShellError] = useState<string | null>(null)

  const openBoardByPath = useCallback(
    async (nextBoardPath: string) => {
      const json = await window.api.openBoard(nextBoardPath)
      const board = JSON.parse(json) as Board
      loadBoard(board, nextBoardPath)
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
      const result = await window.api.createQuickboardDialog()
      if (!result.ok || !result.boardPath) return

      clearWorkspace()
      await openBoardByPath(result.boardPath)
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to create a quickboard.')
    } finally {
      setBusyAction(null)
    }
  }, [clearWorkspace, openBoardByPath])

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

  const handleCreateWorkspaceBoard = useCallback(async () => {
    if (!workspaceRoot) return

    const requestedName = window.prompt('New board name', 'Board')
    if (requestedName === null) return

    setBusyAction('create-board')
    setShellError(null)

    try {
      const result = await window.api.createBoard(workspaceRoot, requestedName)
      if (!result.ok || !result.boardPath) {
        throw new Error('Unable to create a board in this workspace.')
      }

      addBoard(result.boardPath)
      await openBoardByPath(result.boardPath)
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'Unable to create a board.')
    } finally {
      setBusyAction(null)
    }
  }, [addBoard, openBoardByPath, workspaceRoot])

  const handleCloseWorkspace = useCallback(() => {
    clearBoard()
    clearWorkspace()
    setShellError(null)
  }, [clearBoard, clearWorkspace])

  if (boardPath !== null) {
    return (
      <ReactFlowProvider>
        <div style={{ width: '100vw', height: '100vh' }}>
          <Canvas />
        </div>
      </ReactFlowProvider>
    )
  }

  if (workspaceRoot !== null) {
    return (
      <WorkspaceHome
        busy={busyAction !== null}
        errorMessage={shellError}
        workspaceName={workspaceConfig?.name}
        workspaceBrief={workspaceConfig?.brief}
        boards={workspaceBoards}
        onCreateBoard={() => void handleCreateWorkspaceBoard()}
        onOpenBoard={(nextBoardPath) => void handleOpenWorkspaceBoard(nextBoardPath)}
        onCloseWorkspace={handleCloseWorkspace}
      />
    )
  }

  return (
    <StartScreen
      busy={busyAction !== null}
      errorMessage={shellError}
      onOpenWorkspace={() => void handleOpenWorkspace()}
      onCreateWorkspace={() => void handleCreateWorkspace()}
      onCreateQuickboard={() => void handleCreateQuickboard()}
    />
  )
}

export default App
