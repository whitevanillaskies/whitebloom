import './PetalControlButton.css'

type PetalControlButtonProps = {
  label: string
  onClick?: () => void
  variant?: 'default' | 'close'
  className?: string
  children?: React.ReactNode
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'onClick'
>

export default function PetalControlButton({
  label,
  onClick,
  variant = 'default',
  className,
  children,
  type = 'button',
  ...props
}: PetalControlButtonProps): React.JSX.Element {
  const cls = [
    'petal-control-button',
    variant !== 'default' ? `petal-control-button--${variant}` : null,
    className ?? null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...props}
      type={type}
      className={cls}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  )
}
