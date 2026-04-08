import './PetalToolbarSearch.css'

type PetalToolbarSearchProps = {
  label: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'aria-label' | 'type'>

export default function PetalToolbarSearch({
  label,
  className,
  placeholder = 'Search…',
  ...props
}: PetalToolbarSearchProps): React.JSX.Element {
  const cls = ['petal-toolbar-search', className ?? null]
    .filter(Boolean)
    .join(' ')

  return (
    <input
      {...props}
      type="search"
      className={cls}
      placeholder={placeholder}
      aria-label={label}
    />
  )
}
