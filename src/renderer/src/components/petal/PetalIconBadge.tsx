import type React from 'react'
import './PetalIconBadge.css'

type PetalIconBadgeProps = {
  IconComponent: React.ComponentType<{ size?: number }>
  accentColor: string
  /** Badge width and height in px. Defaults to 64. */
  size?: number
  selected?: boolean
  className?: string
}

export default function PetalIconBadge({
  IconComponent,
  accentColor,
  size = 64,
  selected = false,
  className
}: PetalIconBadgeProps) {
  const iconSize = Math.round(size * 0.5)
  const radius = Math.min(12, Math.round(size * 0.2))

  const cls = ['petal-icon-badge', selected ? 'petal-icon-badge--selected' : null, className ?? null]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      style={
        {
          '--badge-accent': `var(${accentColor})`,
          width: size,
          height: size,
          borderRadius: radius,
          background: `var(${accentColor})`
        } as React.CSSProperties
      }
    >
      <IconComponent size={iconSize} />
    </div>
  )
}
