import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PetalField } from '@renderer/components/petal'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import type { UnhandledDropBehavior } from '../../../../shared/app-settings'

export default function AppSection() {
  const { t } = useTranslation()

  const unhandledDropOptions: { value: UnhandledDropBehavior; label: string; description: string }[] = [
    { value: 'link',   label: t('appSettings.linkOption'),   description: t('appSettings.linkDescription') },
    { value: 'import', label: t('appSettings.importOption'), description: t('appSettings.importDescription') },
    { value: 'ask',    label: t('appSettings.askOption'),    description: t('appSettings.askDescription') }
  ]

  const username = useAppSettingsStore((s) => s.user.username)
  const language = useAppSettingsStore((s) => s.language)
  const unhandledDrop = useAppSettingsStore((s) => s.files.unhandledDrop)
  const warnLargeImport = useAppSettingsStore((s) => s.files.warnLargeImport)
  const updateUsername = useAppSettingsStore((s) => s.updateUsername)
  const updateLanguage = useAppSettingsStore((s) => s.updateLanguage)
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
      <h2 className="settings-section__title">{t('appSettings.title')}</h2>
      <div className="settings-section__fields">
        <PetalField
          label={t('appSettings.usernameLabel')}
          hint={t('appSettings.usernameHint')}
          value={username}
          placeholder={t('appSettings.usernamePlaceholder')}
          onChange={(e) => void updateUsername(e.target.value)}
        />

        <div className="settings-field">
          <span className="settings-field__label">{t('appSettings.languageLabel')}</span>
          <select
            className="settings-select"
            value={language}
            onChange={(e) => void updateLanguage(e.target.value)}
          >
            <option value="en">{t('appSettings.languageEnglish')}</option>
            <option value="es">{t('appSettings.languageSpanish')}</option>
          </select>
        </div>

        <div className="settings-field">
          <span className="settings-field__label">{t('appSettings.unhandledDropLabel')}</span>
          <span className="settings-field__hint">{t('appSettings.unhandledDropHint')}</span>
          <div className="settings-radio-group">
            {unhandledDropOptions.map(({ value, label, description }) => (
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
            {t('appSettings.advancedToggle')}
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
                  <span className="settings-toggle__label">{t('appSettings.warnLargeFilesLabel')}</span>
                </label>
                <span className="settings-field__hint" style={{ paddingLeft: 22 }}>
                  {t('appSettings.warnLargeFilesHint')}
                </span>

                {confirmingDisableWarn && (
                  <div className="settings-confirm">
                    <span className="settings-confirm__text">
                      {t('appSettings.confirmDisableWarnText')}
                    </span>
                    <div className="settings-confirm__actions">
                      <button type="button" className="settings-confirm__btn settings-confirm__btn--danger" onClick={handleConfirmDisable}>
                        {t('appSettings.disableWarningButton')}
                      </button>
                      <button type="button" className="settings-confirm__btn" onClick={handleCancelDisable}>
                        {t('appSettings.keepWarningButton')}
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
