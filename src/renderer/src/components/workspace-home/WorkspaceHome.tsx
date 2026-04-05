import './WorkspaceHome.css'

type WorkspaceHomeProps = {
  busy: boolean
  errorMessage: string | null
  workspaceName?: string
  workspaceBrief?: string
  boards: string[]
  onCreateBoard: () => void
  onOpenBoard: (boardPath: string) => void
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
  onCreateBoard,
  onOpenBoard,
  onCloseWorkspace
}: WorkspaceHomeProps) {
  return (
    <main className="workspace-home">
      <header className="workspace-home__header">
        <div>
          <p className="workspace-home__eyebrow">Workspace</p>
          <h1 className="workspace-home__title">{workspaceName?.trim() || 'Untitled workspace'}</h1>
          <p className="workspace-home__brief">
            {workspaceBrief?.trim() || 'No workspace brief yet. Open a board or create one to begin.'}
          </p>
        </div>

        <div className="workspace-home__actions">
          <button type="button" className="workspace-home__button" onClick={onCloseWorkspace}>
            Close workspace
          </button>
          <button
            type="button"
            className="workspace-home__button workspace-home__button--primary"
            onClick={onCreateBoard}
            disabled={busy}
          >
            New board
          </button>
        </div>
      </header>

      {errorMessage ? <p className="workspace-home__error">{errorMessage}</p> : null}

      <section className="workspace-home__board-list" aria-label="Workspace boards">
        {boards.length === 0 ? (
          <div className="workspace-home__empty">
            <p className="workspace-home__empty-title">No boards yet</p>
            <p className="workspace-home__empty-copy">
              Create the first `.wb.json` in this workspace and drop directly into the editor.
            </p>
          </div>
        ) : (
          boards.map((boardPath) => (
            <button
              type="button"
              key={boardPath}
              className="workspace-home__board"
              onClick={() => onOpenBoard(boardPath)}
              disabled={busy}
            >
              <span className="workspace-home__board-title">{getBoardLabel(boardPath)}</span>
              <span className="workspace-home__board-path">{boardPath}</span>
            </button>
          ))
        )}
      </section>
    </main>
  )
}