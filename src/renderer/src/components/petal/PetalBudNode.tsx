import type React from 'react'
import type { Size } from '../../shared/types'
import './PetalBudNode.css'

type PetalBudNodeProps = {
  size: Size
  label: string
  selected: boolean
  /** CSS variable name for the accent color, e.g. `'--color-accent-blue'`.
   *  Drives the selected-label tint. Defaults to blue. */
  accentColor?: string
  onDoubleClick?: () => void
  children: React.ReactNode
}

export default function PetalBudNode({
  size,
  label,
  selected,
  accentColor = '--color-accent-blue',
  onDoubleClick,
  children
}: PetalBudNodeProps): JSX.Element {
  return (
    <div
      className="petal-bud-node"
      style={
        {
          '--bud-accent': `var(${accentColor})`,
          width: size.w,
          height: size.h
        } as React.CSSProperties
      }
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick?.()
      }}
    >
      {children}
      <p className={`petal-bud-node__label${selected ? ' petal-bud-node__label--selected' : ''}`}>
        {label}
      </p>
    </div>
  )
}
