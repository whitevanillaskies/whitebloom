import './PetalIsland.css'

type PetalIslandProps = {
  title: string
  children?: React.ReactNode
  className?: string
  'aria-label'?: string
}

export default function PetalIsland({
  title,
  children,
  className,
  'aria-label': ariaLabel
}: PetalIslandProps): React.JSX.Element {
  return (
    <div
      className={['petal-island', className].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? title}
    >
      <div className="petal-island__header">
        <span className="petal-island__title">{title}</span>
      </div>
      <div className="petal-island__body">{children}</div>
    </div>
  )
}
