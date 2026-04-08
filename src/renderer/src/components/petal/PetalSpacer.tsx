import './PetalSpacer.css'

type PetalSpacerProps = {
  axis?: 'horizontal' | 'vertical'
  size?: number | string
  flexible?: boolean
  className?: string
} & React.HTMLAttributes<HTMLDivElement>

export default function PetalSpacer({
  axis = 'horizontal',
  size = 8,
  flexible = false,
  className,
  style,
  ...props
}: PetalSpacerProps): React.JSX.Element {
  const cls = [
    'petal-spacer',
    `petal-spacer--${axis}`,
    flexible ? 'petal-spacer--flexible' : null,
    className ?? null
  ]
    .filter(Boolean)
    .join(' ')

  const resolvedSize = typeof size === 'number' ? `${size}px` : size

  return (
    <div
      {...props}
      className={cls}
      aria-hidden="true"
      style={
        {
          ...style,
          '--petal-spacer-size': resolvedSize
        } as React.CSSProperties
      }
    />
  )
}
