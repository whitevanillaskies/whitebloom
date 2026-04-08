import './PetalToolbar.css'

type PetalToolbarProps = {
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

export default function PetalToolbar({
  className,
  children,
  ...props
}: PetalToolbarProps): React.JSX.Element {
  const cls = ['petal-window-toolbar', className ?? null]
    .filter(Boolean)
    .join(' ')

  return (
    <div {...props} className={cls} data-mica-no-drag="true">
      {children}
    </div>
  )
}
