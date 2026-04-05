import { useEffect, useRef } from 'react'
import './PetalPanel.css'

type PetalPanelProps = {
  title: string
  body?: string
  children?: React.ReactNode
  onClose: () => void
  'aria-label'?: string
}

export default function PetalPanel({
  title,
  body,
  children,
  onClose,
  'aria-label': ariaLabel
}: PetalPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      className="petal-panel__overlay"
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="petal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="petal-panel__header">
          <h2 className="petal-panel__title">{title}</h2>
          {body ? <p className="petal-panel__body">{body}</p> : null}
        </div>
        {children ? <div className="petal-panel__content">{children}</div> : null}
      </div>
    </div>
  )
}
