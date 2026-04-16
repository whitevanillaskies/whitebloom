import './PetalShelfItem.css'

type PetalShelfItemProps = {
  label: string
  icon: React.ReactNode
  active?: boolean
  accent?: string
  className?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>

export function PetalShelfItem({
  label,
  icon,
  active = false,
  accent,
  className,
  type = 'button',
  style,
  ...props
}: PetalShelfItemProps): React.JSX.Element {
  const cls = [
    'petal-shelf-item',
    active ? 'petal-shelf-item--active' : null,
    className ?? null
  ]
    .filter(Boolean)
    .join(' ')

  const inlineStyle = accent
    ? { '--petal-shelf-item-accent': accent, ...style }
    : style

  return (
    <button
      {...props}
      type={type}
      className={cls}
      aria-label={label}
      title={props.title ?? label}
      aria-pressed={active}
      style={inlineStyle as React.CSSProperties}
    >
      <span className="petal-shelf-item__icon">{icon}</span>
      <span className="petal-shelf-item__label">{label}</span>
    </button>
  )
}
