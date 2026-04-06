import { useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace'
import BoardSection from './BoardSection'
import WorkspaceSection from './WorkspaceSection'
import AppSection from './AppSection'
import './SettingsModal.css'

type Props = {
  name: string | undefined
  brief: string | undefined
  onChange: (patch: { name?: string; brief?: string }) => void
  onClose: () => void
}

type Section = 'board' | 'workspace' | 'app'

export default function SettingsModal({ name, brief, onChange, onClose }: Props) {
  const hasWorkspace = useWorkspaceStore((s) => s.root !== null)
  const [activeSection, setActiveSection] = useState<Section>('board')
  const overlayRef = useRef<HTMLDivElement>(null)

  const sections: { id: Section; label: string }[] = [
    { id: 'board', label: 'Board' },
    ...(hasWorkspace ? [{ id: 'workspace' as Section, label: 'Workspace' }] : []),
    { id: 'app', label: 'App' }
  ]

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <nav className="settings-modal__sidebar">
          <span className="settings-modal__sidebar-heading">Settings</span>
          {sections.map((s) => (
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
          {activeSection === 'board' && (
            <BoardSection name={name} brief={brief} onChange={onChange} />
          )}
          {activeSection === 'workspace' && hasWorkspace && <WorkspaceSection />}
          {activeSection === 'app' && <AppSection />}
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
