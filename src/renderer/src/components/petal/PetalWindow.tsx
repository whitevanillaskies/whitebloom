import { MicaWindow } from '../../mica'

type PetalWindowProps = {
  title: string
  /** Legacy compatibility prop. Renders the new left-side close control. */
  onBack?: () => void
  /** Slot for right-side chrome actions: view toggles, search, etc. */
  headerActions?: React.ReactNode
  /** Optional sidebar rendered inside the window to the left of main content. */
  sidebar?: React.ReactNode
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export default function PetalWindow({
  title,
  onBack,
  headerActions,
  sidebar,
  children,
  className,
  style,
  'aria-label': ariaLabel
}: PetalWindowProps): React.JSX.Element {
  return (
    <MicaWindow
      title={title}
      onClose={onBack}
      headerActions={headerActions}
      sidebar={sidebar}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </MicaWindow>
  )
}
