import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import './CanvasToolbar.css'

// ── Shell ─────────────────────────────────────────────────────────────────────

type CanvasToolbarProps = HTMLAttributes<HTMLDivElement>

/**
 * Shared shell for all canvas-context floating toolbars (edge, format, shape, etc.).
 * Owns the glass chrome: background, border, shadow, padding, gap.
 * Positioning and pointer-events are left to the consumer.
 * Sets data-board-capture="exclude" by default; override via props if needed.
 */
export function CanvasToolbar({ className, children, ...props }: CanvasToolbarProps) {
  return (
    <div
      data-board-capture="exclude"
      {...props}
      className={`canvas-toolbar${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

type CanvasToolbarBtnProps = {
  active?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

/**
 * Canonical button for all canvas toolbar controls.
 * Supports icon-only usage, active/hover/pressed/disabled states, and grouped usage.
 * For color-value buttons, render a <CanvasToolbarSwatch> as the sole child.
 */
export function CanvasToolbarBtn({ active, className, children, ...props }: CanvasToolbarBtnProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      {...props}
      className={`canvas-toolbar__btn${active ? ' canvas-toolbar__btn--active' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  )
}

// ── Color swatch ──────────────────────────────────────────────────────────────

type CanvasToolbarSwatchProps = {
  /** Resolved CSS color string (e.g. '#1e87ff', 'rgba(30,135,255,1)'). */
  color: string
}

/**
 * Color value indicator for use as the sole child of a CanvasToolbarBtn.
 * The button handles interaction; the swatch just shows the current color.
 */
export function CanvasToolbarSwatch({ color }: CanvasToolbarSwatchProps) {
  return <span className="canvas-toolbar__swatch" style={{ backgroundColor: color }} />
}

// ── Separator ─────────────────────────────────────────────────────────────────

/**
 * Thin visual divider between button groups within a toolbar.
 */
export function CanvasToolbarSep() {
  return <span className="canvas-toolbar__sep" aria-hidden />
}
