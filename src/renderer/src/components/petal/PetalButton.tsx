import './PetalButton.css'

type PetalButtonProps = {
  intent?: 'default' | 'primary' | 'destructive'
  size?: 'md' | 'sm'
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export default function PetalButton({
  intent = 'default',
  size = 'md',
  className,
  ...props
}: PetalButtonProps) {
  const cls = [
    'petal-button',
    intent !== 'default' ? `petal-button--${intent}` : null,
    size !== 'md' ? `petal-button--${size}` : null,
    className ?? null
  ]
    .filter(Boolean)
    .join(' ')

  return <button className={cls} {...props} />
}
