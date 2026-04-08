import './PetalToolbarButton.css'

type PetalToolbarButtonProps = {
  label: string
  active?: boolean
  className?: string
  children?: React.ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'>

export default function PetalToolbarButton({
  label,
  active = false,
  className,
  children,
  type = 'button',
  ...props
}: PetalToolbarButtonProps): React.JSX.Element {
  const cls = [
    'petal-window-toolbar-button',
    active ? 'petal-window-toolbar-button--active' : null,
    className ?? null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...props}
      type={type}
      className={cls}
      aria-label={label}
      title={props.title ?? label}
    >
      {children}
    </button>
  )
}
