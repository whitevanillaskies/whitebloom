import { forwardRef } from 'react'
import type { ReactNode } from 'react'
import './PetalToolbarButton.css'

type PetalToolbarButtonProps = {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  indicator?: boolean
  disabled?: boolean
}

const PetalToolbarButton = forwardRef<HTMLButtonElement, PetalToolbarButtonProps>(
  function PetalToolbarButton(
    { icon, label, onClick, active = false, indicator = false, disabled = false },
    ref
  ) {
    const preventMouseFocus = (e: React.MouseEvent) => e.preventDefault()

    const cls = [
      'petal-toolbar-button',
      active && 'petal-toolbar-button--active',
      indicator && 'petal-toolbar-button--indicator'
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        type="button"
        className={cls}
        onClick={onClick}
        onMouseDown={preventMouseFocus}
        aria-label={label}
        disabled={disabled}
      >
        {icon}
      </button>
    )
  }
)

export default PetalToolbarButton
