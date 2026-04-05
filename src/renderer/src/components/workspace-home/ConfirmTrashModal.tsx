import { useEffect, useRef } from 'react'
import './ConfirmTrashModal.css'

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
  const overlayRef = useRef<HTMLDivElement>(null)

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
    onConfirm()
  }

  return (
    <div
      className="confirm-trash-modal__overlay"
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <form className="confirm-trash-modal" role="dialog" aria-modal="true" onSubmit={handleSubmit}>
        <p className="confirm-trash-modal__eyebrow">Move to trash</p>
        <h2 className="confirm-trash-modal__title">Trash this board?</h2>
        <p className="confirm-trash-modal__copy">
          The board file will be moved into `wbapp:trash`. You can still restore it manually from
          the filesystem during development.
        </p>

        <div className="confirm-trash-modal__actions">
          <button type="button" className="confirm-trash-modal__button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="confirm-trash-modal__button confirm-trash-modal__button--danger"
            disabled={busy}
          >
            {busy ? 'Moving…' : 'Move to trash'}
          </button>
        </div>
      </form>
    </div>
  )
}