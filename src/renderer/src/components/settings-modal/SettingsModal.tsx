import { useEffect, useRef, useState } from 'react'
import './SettingsModal.css'

type Props = {
  name: string | undefined
  brief: string | undefined
  username: string
  onChange: (patch: { name?: string; brief?: string }) => void
  onUsernameChange: (username: string) => void
  onClose: () => void
}

type Section = 'board' | 'app'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'app', label: 'App' }
]

export default function SettingsModal({
  name,
  brief,
  username,
  onChange,
  onUsernameChange,
  onClose
}: Props) {
  const [activeSection, setActiveSection] = useState<Section>('board')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      className="settings-modal__overlay"
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <nav className="settings-modal__sidebar">
          <span className="settings-modal__sidebar-heading">Settings</span>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`settings-modal__nav-item${activeSection === s.id ? ' settings-modal__nav-item--active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-modal__content">
          {activeSection === 'board' && <BoardSection name={name} brief={brief} onChange={onChange} />}
          {activeSection === 'app' && (
            <AppSection username={username} onUsernameChange={onUsernameChange} />
          )}
        </div>

        <button
          type="button"
          className="settings-modal__close"
          onClick={onClose}
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function BoardSection({
  name,
  brief,
  onChange
}: {
  name: string | undefined
  brief: string | undefined
  onChange: Props['onChange']
}) {
  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Board</h2>

      <div className="settings-field">
        <label className="settings-field__label" htmlFor="settings-board-name">
          Board name
        </label>
        <input
          id="settings-board-name"
          className="settings-field__input"
          type="text"
          value={name ?? ''}
          placeholder="Untitled"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-field__label" htmlFor="settings-board-brief">
          Brief
          <span className="settings-field__label-hint">
            A message for AI agents — describe what this board is for, what context they should keep
            in mind, or how you'd like them to help.
          </span>
        </label>
        <textarea
          id="settings-board-brief"
          className="settings-field__textarea"
          value={brief ?? ''}
          placeholder="This board is for…"
          rows={6}
          onChange={(e) => onChange({ brief: e.target.value })}
        />
      </div>
    </div>
  )
}

function AppSection({
  username,
  onUsernameChange
}: {
  username: string
  onUsernameChange: Props['onUsernameChange']
}) {
  return (
    <div className="settings-section">
      <h2 className="settings-section__title">App</h2>

      <div className="settings-field">
        <label className="settings-field__label" htmlFor="settings-app-username">
          Username
          <span className="settings-field__label-hint">
            Stored once for the app and used for node authorship metadata across all boards.
          </span>
        </label>
        <input
          id="settings-app-username"
          className="settings-field__input"
          type="text"
          value={username}
          placeholder="anon"
          onChange={(e) => onUsernameChange(e.target.value)}
        />
      </div>
    </div>
  )
}
