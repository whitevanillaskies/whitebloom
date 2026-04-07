import { ChevronLeft, FolderOpen, FolderPlus, LayoutGrid, Trash2, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { resourceToImageSrc } from '../../shared/resource-url'
import './StartScreen.css'

type RecentBoard = {
  path: string
  openedAt: number
  workspaceRoot?: string
  thumbnailUri?: string
}

type StartScreenProps = {
  busy: boolean
  errorMessage: string | null
  transientBoards: string[]
  recentBoards: RecentBoard[]
  currentBoardName: string | null
  onReturnToBoard: (() => void) | null
  onOpenWorkspace: () => void
  onCreateWorkspace: () => void
  onCreateQuickboard: () => void
  onOpenTransientBoard: (boardPath: string) => void
  onOpenRecentBoard: (item: RecentBoard) => void
  onTrashBoard: (boardPath: string) => void
}

function getBoardLabel(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || fileName || 'Unsaved quickboard'
}

function getContainingDir(boardPath: string): string {
  const normalized = boardPath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

function formatRelativeTime(openedAt: number): string {
  const diffMin = Math.floor((Date.now() - openedAt) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return `${Math.floor(diffDay / 30)}mo ago`
}

export default function StartScreen({
  busy,
  errorMessage,
  transientBoards,
  recentBoards,
  currentBoardName,
  onReturnToBoard,
  onOpenWorkspace,
  onCreateWorkspace,
  onCreateQuickboard,
  onOpenTransientBoard,
  onOpenRecentBoard,
  onTrashBoard
}: StartScreenProps) {
  const { t } = useTranslation()

  return (
    <main className="start-screen">
      <aside className="start-screen__sidebar">
        <h1 className="start-screen__logo">{t('startScreen.logo')}</h1>

        <nav className="start-screen__nav">
          {onReturnToBoard ? (
            <button
              type="button"
              className="start-screen__action start-screen__action--return"
              onClick={onReturnToBoard}
            >
              <ChevronLeft size={14} strokeWidth={1.8} className="start-screen__action-icon" />
              {currentBoardName ?? t('startScreen.backToBoard')}
            </button>
          ) : null}

          <button
            type="button"
            className="start-screen__action"
            onClick={onOpenWorkspace}
            disabled={busy}
          >
            <FolderOpen size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.openAction')}
          </button>

          <button
            type="button"
            className="start-screen__action"
            onClick={onCreateWorkspace}
            disabled={busy}
          >
            <FolderPlus size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.newWorkspaceAction')}
          </button>

          <button
            type="button"
            className="start-screen__action"
            onClick={onCreateQuickboard}
            disabled={busy}
          >
            <Zap size={14} strokeWidth={1.8} className="start-screen__action-icon" />
            {t('startScreen.newQuickboardAction')}
          </button>
        </nav>

        {errorMessage ? <p className="start-screen__error">{errorMessage}</p> : null}
      </aside>

      <section className="start-screen__recent" aria-label="Recent boards">
        {recentBoards.length > 0 && (
          <>
            <p className="start-screen__recent-eyebrow">{t('startScreen.recentSection')}</p>
            <div className="start-screen__board-grid">
              {recentBoards.map((item) => (
                <div key={item.path} className="start-screen__board-tile">
                  <button
                    type="button"
                    className="start-screen__board-open"
                    onClick={() => onOpenRecentBoard(item)}
                    disabled={busy}
                  >
                    <div className="start-screen__board-preview">
                      {item.thumbnailUri ? (
                        <img
                          src={resourceToImageSrc(item.thumbnailUri)}
                          alt=""
                          className="start-screen__board-thumbnail"
                          draggable={false}
                        />
                      ) : (
                        <LayoutGrid size={30} strokeWidth={1.2} />
                      )}
                    </div>
                    <div className="start-screen__board-info">
                      <span className="start-screen__board-label">{getBoardLabel(item.path)}</span>
                      <span className="start-screen__board-path">{getContainingDir(item.path)}</span>
                      <span className="start-screen__board-time">{formatRelativeTime(item.openedAt)}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {transientBoards.length > 0 && (
          <>
            <p className="start-screen__recent-eyebrow" style={recentBoards.length > 0 ? { marginTop: 32 } : undefined}>
              {t('startScreen.unsavedQuickboards')}
            </p>
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
                    aria-label={t('startScreen.moveToTrashAria', { name: getBoardLabel(boardPath) })}
                    title={t('startScreen.moveToTrashTitle')}
                  >
                    <Trash2 size={11} strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {recentBoards.length === 0 && transientBoards.length === 0 && (
          <p className="start-screen__empty">{t('startScreen.noRecentBoards')}</p>
        )}
      </section>
    </main>
  )
}
