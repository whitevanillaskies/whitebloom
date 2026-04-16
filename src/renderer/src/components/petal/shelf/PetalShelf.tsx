import './PetalShelf.css'

type PetalShelfProps = {
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

export function PetalShelf({
  className,
  children,
  ...props
}: PetalShelfProps): React.JSX.Element {
  const cls = ['petal-shelf', className ?? null].filter(Boolean).join(' ')

  return (
    <div {...props} className={cls} role="toolbar">
      {children}
    </div>
  )
}
