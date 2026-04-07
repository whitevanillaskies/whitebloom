import { ArrowLeft, ChevronLeft, FilePlus, LayoutGrid, PanelsTopLeft, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { resourceToImageSrc } from '../../shared/resource-url'
import './WorkspaceHome.css'

type BoardEntry = {
  path: string
  thumbnailUri?: string
}

type WorkspaceHomeProps = {
  busy: boolean
  errorMessage: string | null
  workspaceName?: string
  workspaceBrief?: string
  boards: BoardEntry[]
  currentBoardName: string | null
  onReturnToBoard: (() => void) | null
  onOpenArrangements: (() => void) | null
  onCreateBoard: () => void
  onOpenBoard: (boardPath: string) => void
  onTrashBoard: (boardPath: string) => void
  onCloseWorkspace: () => void
}

function getBoardLabel(boardPath: string, untitledLabel: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || fileName || untitledLabel
}

export default function WorkspaceHome({
  busy,
  errorMessage,
  workspaceName,
  workspaceBrief,
  boards,
  currentBoardName,
  onReturnToBoard,
  onOpenArrangements,
  onCreateBoard,
  onOpenBoard,
  onTrashBoard,
  onCloseWorkspace
}: WorkspaceHomeProps) {
  const { t } = useTranslation()

  return (
    <main className="workspace-home">
      <aside className="workspace-home__sidebar">
        <div className="workspace-home__identity">
          <p className="workspace-home__eyebrow">{t('workspaceHome.workspaceLabel')}</p>
          <h1 className="workspace-home__title">{workspaceName?.trim() || t('workspaceHome.untitledWorkspace')}</h1>
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
              {currentBoardName ?? t('workspaceHome.backToBoard')}
            </button>
          ) : null}

          <button
            type="button"
            className="workspace-home__action"
            onClick={onCreateBoard}
            disabled={busy}
          >
            <FilePlus size={14} strokeWidth={1.8} className="workspace-home__action-icon" />
            {t('workspaceHome.newBoardAction')}
          </button>

          {onOpenArrangements ? (
            <button
              type="button"
              className="workspace-home__action"
              onClick={onOpenArrangements}
              disabled={busy}
            >
              <PanelsTopLeft
                size={14}
                strokeWidth={1.8}
                className="workspace-home__action-icon"
              />
              {t('workspaceHome.arrangementsAction')}
            </button>
          ) : null}

          <button
            type="button"
            className="workspace-home__action"
            onClick={onCloseWorkspace}
          >
            <ArrowLeft size={14} strokeWidth={1.8} className="workspace-home__action-icon" />
            {t('workspaceHome.closeWorkspaceAction')}
          </button>
        </nav>

        {errorMessage ? <p className="workspace-home__error">{errorMessage}</p> : null}
      </aside>

      <section className="workspace-home__main" aria-label="Workspace boards">
        <p className="workspace-home__boards-eyebrow">{t('workspaceHome.boardsSection')}</p>
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
                <span className="workspace-home__board-label">{t('workspaceHome.newBoardTile')}</span>
              </div>
            </button>
          </div>

          {boards.map(({ path: boardPath, thumbnailUri }) => (
            <div key={boardPath} className="workspace-home__board-tile">
              <button
                type="button"
                className="workspace-home__board-open"
                onClick={() => onOpenBoard(boardPath)}
                disabled={busy}
              >
                <div className="workspace-home__board-preview">
                  {thumbnailUri ? (
                    <img
                      src={resourceToImageSrc(thumbnailUri)}
                      alt=""
                      className="workspace-home__board-thumbnail"
                      draggable={false}
                    />
                  ) : (
                    <LayoutGrid size={30} strokeWidth={1.2} />
                  )}
                </div>
                <div className="workspace-home__board-info">
                  <span className="workspace-home__board-label">{getBoardLabel(boardPath, t('workspaceHome.untitledBoard'))}</span>
                  <span className="workspace-home__board-path">{boardPath}</span>
                </div>
              </button>

              <button
                type="button"
                className="workspace-home__board-discard"
                onClick={() => onTrashBoard(boardPath)}
                disabled={busy}
                aria-label={t('workspaceHome.moveToTrashAria', { name: getBoardLabel(boardPath, t('workspaceHome.untitledBoard')) })}
                title={t('workspaceHome.moveToTrashTitle')}
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
