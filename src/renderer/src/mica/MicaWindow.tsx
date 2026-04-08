import { X } from 'lucide-react'
import { PetalControlButton } from '../components/petal/window'
import './MicaWindow.css'

type MicaWindowProps = {
  title: string
  onClose?: () => void
  toolbar?: React.ReactNode
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
  toolbar,
  headerActions,
  sidebar,
  children,
  className,
  style,
  'aria-label': ariaLabel
}: MicaWindowProps): React.JSX.Element {
  const resolvedToolbar = toolbar ?? headerActions

  return (
    <div
      className={['mica-window', className].filter(Boolean).join(' ')}
      style={style}
      role="region"
      aria-label={ariaLabel ?? title}
    >
      <div className="mica-window__titlebar" data-mica-drag-handle="true">
        <div className="mica-window__leading">
          {onClose ? (
            <PetalControlButton
              variant="close"
              onClick={onClose}
              label="Close"
              data-mica-no-drag="true"
            >
              <X size={13} strokeWidth={1.8} />
            </PetalControlButton>
          ) : (
            <div className="mica-window__close-placeholder" aria-hidden="true" />
          )}

          <span className="mica-window__title">{title}</span>
        </div>

        {resolvedToolbar ? (
          <div className="mica-window__actions" data-mica-no-drag="true">
            {resolvedToolbar}
          </div>
        ) : null}
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
