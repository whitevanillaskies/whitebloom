import { X } from 'lucide-react'
import './MicaWindow.css'

type MicaWindowProps = {
  title: string
  onClose?: () => void
  headerActions?: React.ReactNode
  sidebar?: React.ReactNode
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export default function MicaWindow({
  title,
  onClose,
  headerActions,
  sidebar,
  children,
  className,
  style,
  'aria-label': ariaLabel
}: MicaWindowProps): React.JSX.Element {
  return (
    <div
      className={['mica-window', className].filter(Boolean).join(' ')}
      style={style}
      role="region"
      aria-label={ariaLabel ?? title}
    >
      <div className="mica-window__titlebar" data-mica-drag-handle="true">
        {onClose ? (
          <button
            type="button"
            className="mica-window__close"
            onClick={onClose}
            aria-label="Close"
            data-mica-no-drag="true"
          >
            <X size={13} strokeWidth={1.8} />
          </button>
        ) : (
          <div className="mica-window__close-placeholder" aria-hidden="true" />
        )}

        <span className="mica-window__title">{title}</span>

        <div className="mica-window__actions" data-mica-no-drag="true">
          {headerActions}
        </div>
      </div>

      <div className="mica-window__content">
        {sidebar ? (
          <aside className="mica-window__sidebar" data-mica-no-drag="true">
            {sidebar}
          </aside>
        ) : null}
        <div className="mica-window__main" data-mica-no-drag="true">
          {children}
        </div>
      </div>
    </div>
  )
}
