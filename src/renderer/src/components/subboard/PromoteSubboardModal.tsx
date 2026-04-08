import { PetalButton, PetalField, PetalPanel } from '@renderer/components/petal'
import { useTranslation } from 'react-i18next'

type PromoteSubboardModalProps = {
  boardName: string
  busy: boolean
  onBoardNameChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

export default function PromoteSubboardModal({
  boardName,
  busy,
  onBoardNameChange,
  onClose,
  onSubmit
}: PromoteSubboardModalProps) {
  const { t } = useTranslation()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <PetalPanel
      title={t('promoteSubboardModal.title')}
      body={t('promoteSubboardModal.description')}
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <PetalField
          label={t('promoteSubboardModal.boardNameLabel')}
          value={boardName}
          onChange={(event) => onBoardNameChange(event.target.value)}
          placeholder={t('promoteSubboardModal.boardNamePlaceholder')}
          disabled={busy}
          autoFocus
        />
        <div className="petal-panel__actions">
          <PetalButton type="button" onClick={onClose} disabled={busy}>
            {t('promoteSubboardModal.cancelButton')}
          </PetalButton>
          <PetalButton type="submit" intent="primary" disabled={busy}>
            {busy ? t('promoteSubboardModal.promotingButton') : t('promoteSubboardModal.submitButton')}
          </PetalButton>
        </div>
      </form>
    </PetalPanel>
  )
}
