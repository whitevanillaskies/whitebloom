import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { PetalField } from '@renderer/components/petal'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import type { UnhandledDropBehavior } from '../../../../shared/app-settings'

const UNHANDLED_DROP_OPTIONS: { value: UnhandledDropBehavior; label: string; description: string }[] = [
  { value: 'link',   label: 'Link',   description: 'Keep the file at its current location.' },
  { value: 'import', label: 'Import', description: 'Copy the file into the workspace.' },
  { value: 'ask',    label: 'Ask',    description: 'Ask each time a file is dropped.' }
]

export default function AppSection() {
  const username = useAppSettingsStore((s) => s.user.username)
  const unhandledDrop = useAppSettingsStore((s) => s.files.unhandledDrop)
  const warnLargeImport = useAppSettingsStore((s) => s.files.warnLargeImport)
  const updateUsername = useAppSettingsStore((s) => s.updateUsername)
  const updateUnhandledDrop = useAppSettingsStore((s) => s.updateUnhandledDrop)
  const updateWarnLargeImport = useAppSettingsStore((s) => s.updateWarnLargeImport)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [confirmingDisableWarn, setConfirmingDisableWarn] = useState(false)

  const handleWarnToggle = () => {
    if (warnLargeImport) {
      // Turning off — ask first
      setConfirmingDisableWarn(true)
    } else {
      void updateWarnLargeImport(true)
    }
  }

  const handleConfirmDisable = () => {
    setConfirmingDisableWarn(false)
    void updateWarnLargeImport(false)
  }

  const handleCancelDisable = () => {
    setConfirmingDisableWarn(false)
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">App</h2>
      <div className="settings-section__fields">
        <PetalField
          label="Username"
          hint="Stored once for the app and used for node authorship metadata across all boards."
          value={username}
          placeholder="anon"
          onChange={(e) => void updateUsername(e.target.value)}
        />

        <div className="settings-field">
          <span className="settings-field__label">Files without a handler</span>
          <span className="settings-field__hint">What to do when you drop a file that no module knows how to open.</span>
          <div className="settings-radio-group">
            {UNHANDLED_DROP_OPTIONS.map(({ value, label, description }) => (
              <label key={value} className="settings-radio">
                <input
                  type="radio"
                  name="unhandledDrop"
                  value={value}
                  checked={unhandledDrop === value}
                  onChange={() => void updateUnhandledDrop(value)}
                />
                <span className="settings-radio__label">{label}</span>
                <span className="settings-radio__desc">{description}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="settings-advanced">
          <button
            type="button"
            className={`settings-advanced__toggle${advancedOpen ? ' settings-advanced__toggle--open' : ''}`}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <ChevronRight size={12} strokeWidth={2} className="settings-advanced__chevron" />
            Advanced
          </button>

          {advancedOpen && (
            <div className="settings-advanced__body">
              <div className="settings-field">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={warnLargeImport}
                    onChange={handleWarnToggle}
                  />
                  <span className="settings-toggle__label">Warn before importing large files</span>
                </label>
                <span className="settings-field__hint" style={{ paddingLeft: 22 }}>
                  Shows a warning when importing a file over 50 MB.
                </span>

                {confirmingDisableWarn && (
                  <div className="settings-confirm">
                    <span className="settings-confirm__text">
                      Large files can fill your workspace quickly. Are you sure?
                    </span>
                    <div className="settings-confirm__actions">
                      <button type="button" className="settings-confirm__btn settings-confirm__btn--danger" onClick={handleConfirmDisable}>
                        Disable warning
                      </button>
                      <button type="button" className="settings-confirm__btn" onClick={handleCancelDisable}>
                        Keep it on
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
