import { useEffect, useId, useRef } from 'react'
import { CanvasToolbarBtn, useCanvasToolbarPopover } from './CanvasToolbar'
import { CanvasPopover } from './CanvasPopover'
import './CanvasPopover.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type StrokeDash = 'solid' | 'dashed' | 'dotted'
const DASH_OPTIONS: StrokeDash[] = ['solid', 'dashed', 'dotted']
const WEIGHT_OPTIONS = [1, 1.5, 2, 3] as const
type StrokeWeight = (typeof WEIGHT_OPTIONS)[number]
type StrokeControlValue = {
  width: number
  dash?: StrokeDash
}

// ── Inline previews ───────────────────────────────────────────────────────────

function DashPreview({ dash }: { dash: StrokeDash }) {
  const dashArray =
    dash === 'dashed' ? '4 2.5' : dash === 'dotted' ? '1 2.5' : undefined
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
      <line
        x1="1" y1="5" x2="17" y2="5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashArray}
        strokeLinecap="round"
      />
    </svg>
  )
}

function WeightPreview({ weight }: { weight: number }) {
  // Visual weights are capped slightly so they fit comfortably in the button
  const visual = Math.min(weight, 3)
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
      <line
        x1="1" y1="5" x2="17" y2="5"
        stroke="currentColor"
        strokeWidth={visual}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type StrokeControlProps<T extends StrokeControlValue> = {
  stroke: T
  onChange: (stroke: T) => void
  'aria-label'?: string
  showDashControls?: boolean
}

/**
 * Reusable toolbar stroke control: a preview button that opens a stroke style popover.
 * Controls dash style (solid / dashed / dotted) and stroke weight (1 / 1.5 / 2 / 3).
 * Works for edges and shapes — anything with a width and optional dash value.
 *
 * Usage: place inside a CanvasToolbar; it handles its own popover lifecycle.
 */
export function StrokeControl<T extends StrokeControlValue>({
  stroke,
  onChange,
  'aria-label': ariaLabel = 'Stroke style',
  showDashControls = true
}: StrokeControlProps<T>) {
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  function setDash(dash: StrokeDash) {
    onChange({ ...stroke, dash } as T)
  }

  function setWeight(width: StrokeWeight) {
    onChange({ ...stroke, width } as T)
  }

  return (
    <div className="canvas-control" ref={controlRef}>
      <CanvasToolbarBtn
        aria-label={ariaLabel}
        popoverId={popoverId}
        active={open}
      >
        {showDashControls ? (
          <DashPreview dash={stroke.dash ?? 'solid'} />
        ) : (
          <WeightPreview weight={stroke.width} />
        )}
      </CanvasToolbarBtn>

      {open && (
        <CanvasPopover anchorRef={controlRef} className="canvas-stroke-picker">
          {showDashControls && (
            <>
              <div className="canvas-stroke-picker__row">
                {DASH_OPTIONS.map((dash) => (
                  <CanvasToolbarBtn
                    key={dash}
                    aria-label={dash}
                    active={(stroke.dash ?? 'solid') === dash}
                    preserveOpenPopover
                    onClick={() => setDash(dash)}
                  >
                    <DashPreview dash={dash} />
                  </CanvasToolbarBtn>
                ))}
              </div>

              <div className="canvas-popover__sep" />
            </>
          )}

          <div className="canvas-stroke-picker__row">
            {WEIGHT_OPTIONS.map((w) => (
              <CanvasToolbarBtn
                key={w}
                aria-label={`${w}px`}
                active={stroke.width === w}
                preserveOpenPopover
                onClick={() => setWeight(w)}
              >
                <WeightPreview weight={w} />
              </CanvasToolbarBtn>
            ))}
          </div>
        </CanvasPopover>
      )}
    </div>
  )
}
