import { File, FilePlus, Home, MoreHorizontal, Save, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PetalToolbarButton } from '../petal'
import './BoardContextBar.css'

type BoardContextBarProps = {
  name: string | undefined
  workspaceRoot: string | null
  isDirty: boolean
  onNameChange: (name: string) => void
  onSave: () => void
  onGoHome: () => void
  onGoToWorkspaceHome: () => void
  onNewBoard: () => void
  onOverflow: (anchor: { x: number; y: number }) => void
}

function getWorkspaceName(root: string): string {
  const normalized = root.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || 'Workspace'
}

export default function BoardContextBar({
  name,
  workspaceRoot,
  isDirty,
  onNameChange,
  onSave,
  onGoHome,
  onGoToWorkspaceHome,
  onNewBoard,
  onOverflow
}: BoardContextBarProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const overflowRef = useRef<HTMLButtonElement>(null)

  const displayName = name?.trim() || t('boardContextBar.untitledPlaceholder')
  const isUntitled = !name?.trim()
  const isWorkspace = workspaceRoot !== null

  const startEditing = () => {
    setDraft(name ?? '')
    setEditing(true)
  }

  const commitEdit = () => {
    onNameChange(draft.trim())
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') setEditing(false)
  }

  const handleOverflowClick = () => {
    const rect = overflowRef.current?.getBoundingClientRect()
    if (rect) onOverflow({ x: rect.left, y: rect.bottom + 6 })
  }

  return (
    <div className="board-context-bar">
      {/* Home — always present, navigates to start screen */}
      <button
        type="button"
        className="board-context-bar__home"
        onClick={onGoHome}
        aria-label={t('boardContextBar.homeLabel')}
      >
        <Home size={13} strokeWidth={2} />
      </button>

      {/* Identity slot */}
      {isWorkspace ? (
        <button
          type="button"
          className="board-context-bar__identity--workspace"
          onClick={onGoToWorkspaceHome}
        >
          {getWorkspaceName(workspaceRoot)}
        </button>
      ) : (
        <span className="board-context-bar__identity--quickboard">
          <Zap size={13} strokeWidth={2.2} />
        </span>
      )}

      <span className="board-context-bar__sep">//</span>

      {/* Board name */}
      {editing ? (
        <input
          ref={inputRef}
          className="board-context-bar__name-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          placeholder={t('boardContextBar.untitledPlaceholder')}
        />
      ) : (
        <span
          className={`board-context-bar__name${isUntitled ? ' board-context-bar__name--untitled' : ''}`}
          onClick={startEditing}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEditing() }}
        >
          {displayName}
        </span>
      )}

      <div className="board-context-bar__divider" />

      {/* Save — dirty indicator when unsaved changes */}
      <PetalToolbarButton
        icon={<Save size={15} strokeWidth={2} />}
        label={t('boardContextBar.saveLabel')}
        onClick={onSave}
        indicator={isDirty}
      />

      {/* New board / New quickboard */}
      <PetalToolbarButton
        icon={isWorkspace ? <FilePlus size={15} strokeWidth={2} /> : <File size={15} strokeWidth={2} />}
        label={isWorkspace ? t('boardContextBar.newBoardLabel') : t('boardContextBar.newQuickboardLabel')}
        onClick={onNewBoard}
      />

      {/* Overflow — opens PetalMenu anchored to this button */}
      <PetalToolbarButton
        ref={overflowRef}
        icon={<MoreHorizontal size={15} strokeWidth={2} />}
        label={t('boardContextBar.moreActionsLabel')}
        onClick={handleOverflowClick}
      />
    </div>
  )
}
