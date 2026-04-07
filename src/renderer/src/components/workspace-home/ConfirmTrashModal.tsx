import { PetalButton, PetalPanel } from '../petal'
import { useTranslation } from 'react-i18next'

type ConfirmTrashModalProps = {
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ConfirmTrashModal({
  busy,
  onClose,
  onConfirm
}: ConfirmTrashModalProps) {
  const { t } = useTranslation()

  return (
    <PetalPanel
      title={t('confirmTrashModal.title')}
      body={t('confirmTrashModal.description')}
      onClose={busy ? () => {} : onClose}
    >
      <div className="petal-panel__actions">
        <PetalButton onClick={onClose} disabled={busy}>{t('confirmTrashModal.cancelButton')}</PetalButton>
        <PetalButton intent="destructive" onClick={onConfirm} disabled={busy}>
          {busy ? t('confirmTrashModal.movingButton') : t('confirmTrashModal.moveButton')}
        </PetalButton>
      </div>
    </PetalPanel>
  )
}
