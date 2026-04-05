import { Trash2 } from 'lucide-react'
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
      <section className="start-screen__actions" aria-label="Startup actions">
        <button
          type="button"
          className="start-screen__action start-screen__action--primary"
          onClick={onOpenWorkspace}
          disabled={busy}
        >
          <span className="start-screen__action-title">Open workspace or board</span>
        </button>

        <button
          type="button"
          className="start-screen__action"
          onClick={onCreateWorkspace}
          disabled={busy}
        >
          <span className="start-screen__action-title">Create workspace</span>
        </button>

        <button
          type="button"
          className="start-screen__action"
          onClick={onCreateQuickboard}
          disabled={busy}
        >
          <span className="start-screen__action-title">New quickboard</span>
        </button>
      </section>

      {transientBoards.length > 0 ? (
        <section className="start-screen__transients" aria-label="Unsaved quickboards">
          <div className="start-screen__transients-header">
            <p className="start-screen__transients-eyebrow">Unsaved quickboards</p>
          </div>

          <div className="start-screen__transient-list">
            {transientBoards.map((boardPath) => (
              <div key={boardPath} className="start-screen__transient-card">
                <button
                  type="button"
                  className="start-screen__transient-open"
                  onClick={() => onOpenTransientBoard(boardPath)}
                  disabled={busy}
                >
                  <span className="start-screen__transient-title">{getBoardLabel(boardPath)}</span>
                  <span className="start-screen__transient-path">{boardPath}</span>
                </button>

                <button
                  type="button"
                  className="start-screen__transient-discard"
                  onClick={() => onTrashBoard(boardPath)}
                  disabled={busy}
                  aria-label={`Move ${getBoardLabel(boardPath)} to trash`}
                  title="Move board to trash"
                >
                  <Trash2 size={16} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {errorMessage ? <p className="start-screen__error">{errorMessage}</p> : null}
    </main>
  )
}