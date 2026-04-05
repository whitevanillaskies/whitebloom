import { FolderOpen, FolderPlus, LayoutGrid, Trash2, Zap } from 'lucide-react'
import './StartScreen.css'

type StartScreenProps = {
  busy: boolean
  errorMessage: string | null
  transientBoards: string[]
  onOpenWorkspace: () => void
  onCreateWorkspace: () => void
  onCreateQuickboard: () => void
  onOpenTransientBoard: (boardPath: string) => void
  onTrashBoard: (boardPath: string) => void
}

function getBoardLabel(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || fileName || 'Unsaved quickboard'
}

export default function StartScreen({
  busy,
  errorMessage,
  transientBoards,
  onOpenWorkspace,
  onCreateWorkspace,
  onCreateQuickboard,
  onOpenTransientBoard,
  onTrashBoard
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <aside className="start-screen__sidebar">
        <h1 className="start-screen__logo">WHITEBLOOM</h1>

        <nav className="start-screen__nav">
          <button
            type="button"
            className="start-screen__action"
            onClick={onOpenWorkspace}
            disabled={busy}
          >
            <FolderOpen size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            Open
          </button>

          <button
            type="button"
            className="start-screen__action"
            onClick={onCreateWorkspace}
            disabled={busy}
          >
            <FolderPlus size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            New workspace
          </button>

          <button
            type="button"
            className="start-screen__action"
            onClick={onCreateQuickboard}
            disabled={busy}
          >
            <Zap size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            New quickboard
          </button>
        </nav>

        {errorMessage ? <p className="start-screen__error">{errorMessage}</p> : null}
      </aside>

      <section className="start-screen__recent" aria-label="Unsaved quickboards">
        {transientBoards.length > 0 ? (
          <>
            <p className="start-screen__recent-eyebrow">Unsaved quickboards</p>
            <div className="start-screen__board-grid">
              {transientBoards.map((boardPath) => (
                <div key={boardPath} className="start-screen__board-tile">
                  <button
                    type="button"
                    className="start-screen__board-open"
                    onClick={() => onOpenTransientBoard(boardPath)}
                    disabled={busy}
                  >
                    <div className="start-screen__board-preview">
                      <LayoutGrid size={30} strokeWidth={1.2} />
                    </div>
                    <div className="start-screen__board-info">
                      <span className="start-screen__board-label">{getBoardLabel(boardPath)}</span>
                      <span className="start-screen__board-path">{boardPath}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="start-screen__board-discard"
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
          </>
        ) : (
          <p className="start-screen__empty">No unsaved quickboards</p>
        )}
      </section>
    </main>
  )
}
