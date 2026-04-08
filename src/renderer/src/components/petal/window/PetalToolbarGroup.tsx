import './PetalToolbarGroup.css'

type PetalToolbarGroupProps = {
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

export default function PetalToolbarGroup({
  className,
  children,
  ...props
}: PetalToolbarGroupProps): React.JSX.Element {
  const cls = ['petal-window-toolbar-group', className ?? null]
    .filter(Boolean)
    .join(' ')

  return (
    <div {...props} className={cls}>
      {children}
    </div>
  )
}
