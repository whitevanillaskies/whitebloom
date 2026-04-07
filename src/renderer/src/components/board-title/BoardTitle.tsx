import { Settings2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './BoardTitle.css'

type Props = {
  name: string | undefined
  onNameChange: (name: string) => void
  onOpenSettings: () => void
}

export default function BoardTitle({ name, onNameChange, onOpenSettings }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { t } = useTranslation()
  const displayName = name?.trim() || t('boardTitle.untitledPlaceholder')
  const isUntitled = !name?.trim()

  const startEditing = () => {
    setDraft(name ?? '')
    setEditing(true)
  }

  const commitEdit = () => {
    onNameChange(draft.trim())
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    }
    if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  const preventMouseFocus = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="board-title">
      {editing ? (
        <input
          ref={inputRef}
          className="board-title__input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          placeholder={t('boardTitle.untitledPlaceholder')}
        />
      ) : (
        <span
          className={`board-title__name${isUntitled ? ' board-title__name--untitled' : ''}`}
          onClick={startEditing}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') startEditing()
          }}
        >
          {displayName}
        </span>
      )}
      <button
        type="button"
        className="board-title__settings-btn"
        onMouseDown={preventMouseFocus}
        onClick={onOpenSettings}
        aria-label={t('boardTitle.settingsLabel')}
      >
        <Settings2 size={14} strokeWidth={1.8} />
      </button>
    </div>
  )
}
