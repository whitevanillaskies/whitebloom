import {
  createContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  useContext,
  useState,
} from 'react'
import './CanvasToolbar.css'

type CanvasToolbarContextValue = {
  activePopoverId: string | null
  setActivePopoverId: (id: string | null) => void
}

const CanvasToolbarContext = createContext<CanvasToolbarContextValue | null>(null)

// ── Shell ─────────────────────────────────────────────────────────────────────

type CanvasToolbarProps = HTMLAttributes<HTMLDivElement>

/**
 * Shared shell for all canvas-context floating toolbars (edge, format, shape, etc.).
 * Owns the glass chrome: background, border, shadow, padding, gap.
 * Positioning and pointer-events are left to the consumer.
 * Sets data-board-capture="exclude" by default; override via props if needed.
 */
export function CanvasToolbar({ className, children, ...props }: CanvasToolbarProps) {
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null)

  return (
    <CanvasToolbarContext.Provider value={{ activePopoverId, setActivePopoverId }}>
      <div
        data-board-capture="exclude"
        {...props}
        className={`canvas-toolbar${className ? ` ${className}` : ''}`}
      >
        {children}
      </div>
    </CanvasToolbarContext.Provider>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

type CanvasToolbarBtnProps = {
  active?: boolean
  popoverId?: string
  preserveOpenPopover?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

/**
 * Canonical button for all canvas toolbar controls.
 * Supports icon-only usage, active/hover/pressed/disabled states, and grouped usage.
 * For color-value buttons, render a <CanvasToolbarSwatch> as the sole child.
 */
export function CanvasToolbarBtn({
  active,
  className,
  children,
  onClick,
  popoverId,
  preserveOpenPopover = false,
  ...props
}: CanvasToolbarBtnProps) {
  const toolbar = useContext(CanvasToolbarContext)

  return (
    <button
      type="button"
      tabIndex={-1}
      {...props}
      onClick={(event) => {
        if (toolbar) {
          if (popoverId) {
            toolbar.setActivePopoverId(
              toolbar.activePopoverId === popoverId ? null : popoverId
            )
          } else if (!preserveOpenPopover) {
            toolbar.setActivePopoverId(null)
          }
        }
        onClick?.(event)
      }}
      className={`canvas-toolbar__btn${active ? ' canvas-toolbar__btn--active' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  )
}

export function useCanvasToolbarPopover(popoverId: string) {
  const toolbar = useContext(CanvasToolbarContext)
  const open = toolbar?.activePopoverId === popoverId

  return {
    open: Boolean(open),
    setOpen(nextOpen: boolean) {
      toolbar?.setActivePopoverId(nextOpen ? popoverId : null)
    },
    close() {
      toolbar?.setActivePopoverId(null)
    },
  }
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
  const isTransparent = color === 'transparent'

  return (
    <span
      className={`canvas-toolbar__swatch${isTransparent ? ' canvas-toolbar__swatch--transparent' : ''}`}
      style={isTransparent ? undefined : { backgroundColor: color }}
    />
  )
}

// ── Separator ─────────────────────────────────────────────────────────────────

/**
 * Thin visual divider between button groups within a toolbar.
 */
export function CanvasToolbarSep() {
  return <span className="canvas-toolbar__sep" aria-hidden />
}
