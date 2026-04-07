import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PetalField } from '@renderer/components/petal'
import { useWorkspaceStore } from '@renderer/stores/workspace'

export default function WorkspaceSection() {
  const { t } = useTranslation()
  const config = useWorkspaceStore((s) => s.config)
  const updateConfig = useWorkspaceStore((s) => s.updateConfig)

  const [name, setName] = useState(config?.name ?? '')
  const [brief, setBrief] = useState(config?.brief ?? '')

  const handleNameBlur = () => {
    void updateConfig({ name, brief: config?.brief })
  }

  const handleBriefBlur = () => {
    void updateConfig({ name: config?.name, brief })
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">{t('workspaceSettings.title')}</h2>
      <div className="settings-section__fields">
        <PetalField
          label={t('workspaceSettings.nameLabel')}
          value={name}
          placeholder={t('workspaceSettings.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
        />
        <PetalField
          as="textarea"
          label={t('workspaceSettings.briefLabel')}
          hint={t('workspaceSettings.briefHint')}
          value={brief}
          placeholder={t('workspaceSettings.briefPlaceholder')}
          rows={6}
          onChange={(e) => setBrief(e.target.value)}
          onBlur={handleBriefBlur}
        />
      </div>
    </div>
  )
}
