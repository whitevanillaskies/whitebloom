import { PetalField } from '@renderer/components/petal'
import { useTranslation } from 'react-i18next'

type BoardSectionProps = {
  name: string | undefined
  brief: string | undefined
  onChange: (patch: { name?: string; brief?: string }) => void
}

export default function BoardSection({ name, brief, onChange }: BoardSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">{t('boardSettings.title')}</h2>
      <div className="settings-section__fields">
        <PetalField
          label={t('boardSettings.nameLabel')}
          value={name ?? ''}
          placeholder={t('boardSettings.namePlaceholder')}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <PetalField
          as="textarea"
          label={t('boardSettings.briefLabel')}
          hint={t('boardSettings.briefHint')}
          value={brief ?? ''}
          placeholder={t('boardSettings.briefPlaceholder')}
          rows={6}
          onChange={(e) => onChange({ brief: e.target.value })}
        />
      </div>
    </div>
  )
}
