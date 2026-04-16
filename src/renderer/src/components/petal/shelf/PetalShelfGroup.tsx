import './PetalShelfGroup.css'

type PetalShelfGroupProps = {
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

export function PetalShelfGroup({
  className,
  children,
  ...props
}: PetalShelfGroupProps): React.JSX.Element {
  const cls = ['petal-shelf-group', className ?? null].filter(Boolean).join(' ')

  return (
    <div {...props} className={cls}>
      {children}
    </div>
  )
}
