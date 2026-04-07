import { PetalButton, PetalField, PetalPanel } from '@renderer/components/petal'
import { useTranslation } from 'react-i18next'

type CreateBoardModalProps = {
  boardName: string
  busy: boolean
  onBoardNameChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

export default function CreateBoardModal({
  boardName,
  busy,
  onBoardNameChange,
  onClose,
  onSubmit
}: CreateBoardModalProps) {
  const { t } = useTranslation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <PetalPanel
      title={t('createBoardModal.title')}
      body={t('createBoardModal.description')}
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <PetalField
          label={t('createBoardModal.boardNameLabel')}
          value={boardName}
          onChange={(e) => onBoardNameChange(e.target.value)}
          placeholder={t('createBoardModal.boardNamePlaceholder')}
          disabled={busy}
          autoFocus
        />
        <div className="petal-panel__actions">
          <PetalButton type="button" onClick={onClose} disabled={busy}>
            {t('createBoardModal.cancelButton')}
          </PetalButton>
          <PetalButton type="submit" intent="primary" disabled={busy}>
            {busy ? t('createBoardModal.creatingButton') : t('createBoardModal.submitButton')}
          </PetalButton>
        </div>
      </form>
    </PetalPanel>
  )
}
