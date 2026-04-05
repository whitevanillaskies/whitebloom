import { useEffect, useRef } from 'react'
import './CreateBoardModal.css'

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
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return
    if (event.target === overlayRef.current) onClose()
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div
      className="create-board-modal__overlay"
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <form className="create-board-modal" role="dialog" aria-modal="true" onSubmit={handleSubmit}>
        <div className="create-board-modal__header">
          <p className="create-board-modal__eyebrow">Workspace</p>
          <h2 className="create-board-modal__title">Create board</h2>
          <p className="create-board-modal__copy">
            Choose the board name. Whitebloom will create a `.wb.json` file in this workspace.
          </p>
        </div>

        <label className="create-board-modal__field" htmlFor="create-board-name">
          Board name
        </label>
        <input
          id="create-board-name"
          ref={inputRef}
          className="create-board-modal__input"
          type="text"
          value={boardName}
          onChange={(event) => onBoardNameChange(event.target.value)}
          placeholder="Board"
          disabled={busy}
        />

        <div className="create-board-modal__actions">
          <button type="button" className="create-board-modal__button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="create-board-modal__button create-board-modal__button--primary"
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create board'}
          </button>
        </div>
      </form>
    </div>
  )
}
