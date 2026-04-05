import { PetalButton, PetalPanel } from '../petal'

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
  return (
    <PetalPanel
      title="Move board to trash?"
      body="The board file will be moved into wbapp:trash. You can still restore it manually from the filesystem during development."
      onClose={busy ? () => {} : onClose}
    >
      <div className="petal-panel__actions">
        <PetalButton onClick={onClose} disabled={busy}>Cancel</PetalButton>
        <PetalButton intent="destructive" onClick={onConfirm} disabled={busy}>
          {busy ? 'Moving…' : 'Move to trash'}
        </PetalButton>
      </div>
    </PetalPanel>
  )
}
