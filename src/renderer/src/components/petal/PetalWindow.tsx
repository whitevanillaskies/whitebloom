import { ArrowLeft } from 'lucide-react'
import './PetalWindow.css'

type PetalWindowProps = {
  title: string
  /** Back button handler. If omitted the back button is not rendered. */
  onBack?: () => void
  /** Slot for right-side chrome actions: view toggles, search, etc. */
  headerActions?: React.ReactNode
  /** Optional sidebar rendered inside the window to the left of main content. */
  sidebar?: React.ReactNode
  children?: React.ReactNode
  className?: string
  'aria-label'?: string
}

export default function PetalWindow({
  title,
  onBack,
  headerActions,
  sidebar,
  children,
  className,
  'aria-label': ariaLabel
}: PetalWindowProps): React.JSX.Element {
  return (
    <div
      className={['petal-window', className].filter(Boolean).join(' ')}
      role="region"
      aria-label={ariaLabel ?? title}
    >
      <div className="petal-window__titlebar">
        {onBack ? (
          <button
            type="button"
            className="petal-window__back"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft size={13} strokeWidth={1.8} />
          </button>
        ) : (
          <div />
        )}

        <span className="petal-window__title">{title}</span>

        <div className="petal-window__actions">{headerActions}</div>
      </div>

      <div className="petal-window__content">
        {sidebar ? (
          <aside className="petal-window__sidebar">{sidebar}</aside>
        ) : null}
        <div className="petal-window__main">{children}</div>
      </div>
    </div>
  )
}
