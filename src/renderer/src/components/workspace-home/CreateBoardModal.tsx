import { PetalButton, PetalField, PetalPanel } from '@renderer/components/petal'

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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <PetalPanel
      title="Create board"
      body="Choose a name. Whitebloom will create a .wb.json file in this workspace."
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <PetalField
          label="Board name"
          value={boardName}
          onChange={(e) => onBoardNameChange(e.target.value)}
          placeholder="Board"
          disabled={busy}
          autoFocus
        />
        <div className="petal-panel__actions">
          <PetalButton type="button" onClick={onClose} disabled={busy}>
            Cancel
          </PetalButton>
          <PetalButton type="submit" intent="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create board'}
          </PetalButton>
        </div>
      </form>
    </PetalPanel>
  )
}
