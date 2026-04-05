import { ArrowLeft, ChevronLeft, FilePlus, LayoutGrid, Plus, Trash2 } from 'lucide-react'
import './WorkspaceHome.css'

type WorkspaceHomeProps = {
  busy: boolean
  errorMessage: string | null
  workspaceName?: string
  workspaceBrief?: string
  boards: string[]
  currentBoardName: string | null
  onReturnToBoard: (() => void) | null
  onCreateBoard: () => void
  onOpenBoard: (boardPath: string) => void
  onTrashBoard: (boardPath: string) => void
  onCloseWorkspace: () => void
}

function getBoardLabel(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || fileName || 'Untitled board'
}

export default function WorkspaceHome({
  busy,
  errorMessage,
  workspaceName,
  workspaceBrief,
  boards,
  currentBoardName,
  onReturnToBoard,
  onCreateBoard,
  onOpenBoard,
  onTrashBoard,
  onCloseWorkspace
}: WorkspaceHomeProps) {
  return (
    <main className="workspace-home">
      <aside className="workspace-home__sidebar">
        <div className="workspace-home__identity">
          <p className="workspace-home__eyebrow">Workspace</p>
          <h1 className="workspace-home__title">{workspaceName?.trim() || 'Untitled workspace'}</h1>
          {workspaceBrief?.trim() ? (
            <p className="workspace-home__brief">{workspaceBrief.trim()}</p>
          ) : null}
        </div>

        <nav className="workspace-home__nav">
          {onReturnToBoard ? (
            <button
              type="button"
              className="workspace-home__action workspace-home__action--return"
              onClick={onReturnToBoard}
            >
              <ChevronLeft size={14} strokeWidth={1.8} className="workspace-home__action-icon" />
              {currentBoardName ?? 'Back to board'}
            </button>
          ) : null}

          <button
            type="button"
            className="workspace-home__action"
            onClick={onCreateBoard}
            disabled={busy}
          >
            <FilePlus size={14} strokeWidth={1.8} className="workspace-home__action-icon" />
            New board
          </button>

          <button
            type="button"
            className="workspace-home__action"
            onClick={onCloseWorkspace}
          >
            <ArrowLeft size={14} strokeWidth={1.8} className="workspace-home__action-icon" />
            Close workspace
          </button>
        </nav>

        {errorMessage ? <p className="workspace-home__error">{errorMessage}</p> : null}
      </aside>

      <section className="workspace-home__main" aria-label="Workspace boards">
        <p className="workspace-home__boards-eyebrow">Boards</p>
        <div className="workspace-home__board-grid">
          <div className="workspace-home__board-tile workspace-home__board-tile--new">
            <button
              type="button"
              className="workspace-home__board-open"
              onClick={onCreateBoard}
              disabled={busy}
            >
              <div className="workspace-home__board-preview">
                <Plus size={28} strokeWidth={1.4} />
              </div>
              <div className="workspace-home__board-info">
                <span className="workspace-home__board-label">New board</span>
              </div>
            </button>
          </div>

          {boards.map((boardPath) => (
            <div key={boardPath} className="workspace-home__board-tile">
              <button
                type="button"
                className="workspace-home__board-open"
                onClick={() => onOpenBoard(boardPath)}
                disabled={busy}
              >
                <div className="workspace-home__board-preview">
                  <LayoutGrid size={30} strokeWidth={1.2} />
                </div>
                <div className="workspace-home__board-info">
                  <span className="workspace-home__board-label">{getBoardLabel(boardPath)}</span>
                  <span className="workspace-home__board-path">{boardPath}</span>
                </div>
              </button>

              <button
                type="button"
                className="workspace-home__board-discard"
                onClick={() => onTrashBoard(boardPath)}
                disabled={busy}
                aria-label={`Move ${getBoardLabel(boardPath)} to trash`}
                title="Move to trash"
              >
                <Trash2 size={11} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
