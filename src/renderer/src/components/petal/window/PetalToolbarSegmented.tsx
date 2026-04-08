import './PetalToolbarSegmented.css'

type PetalToolbarSegmentedItem<TValue extends string> = {
  value: TValue
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

type PetalToolbarSegmentedProps<TValue extends string> = {
  value: TValue
  items: PetalToolbarSegmentedItem<TValue>[]
  onChange: (value: TValue) => void
  className?: string
}

export default function PetalToolbarSegmented<TValue extends string>({
  value,
  items,
  onChange,
  className
}: PetalToolbarSegmentedProps<TValue>): React.JSX.Element {
  const cls = ['petal-window-toolbar-segmented', className ?? null]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      role="group"
      aria-label="Segmented control"
      data-mica-no-drag="true"
    >
      {items.map((item) => {
        const isActive = item.value === value

        return (
          <button
            key={item.value}
            type="button"
            className={[
              'petal-window-toolbar-segmented__item',
              isActive ? 'petal-window-toolbar-segmented__item--active' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(item.value)}
            aria-label={item.label}
            aria-pressed={isActive}
            title={item.label}
            disabled={item.disabled}
          >
            {item.icon ?? item.label}
          </button>
        )
      })}
    </div>
  )
}
