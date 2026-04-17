import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import './PetalShelfZoomItem.css'

type PetalShelfZoomItemProps = {
  scale: number
  minScale: number
  maxScale: number
  onScaleChange: (scale: number) => void
  onFitPage: () => void
  presets?: number[]
  label?: string
}

export function PetalShelfZoomItem({
  scale,
  minScale,
  maxScale,
  onScaleChange,
  onFitPage,
  presets = [0.5, 1, 2],
  label = 'Zoom'
}: PetalShelfZoomItemProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const minPct = Math.round(minScale * 100)
  const maxPct = Math.round(maxScale * 100)
  const currentPct = Math.round(scale * 100)

  return (
    <div ref={rootRef} className="petal-shelf-zoom">
      <button
        type="button"
        className={`petal-shelf-zoom__trigger${open ? ' petal-shelf-zoom__trigger--open' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="petal-shelf-zoom__label">{label}</span>
        <span className="petal-shelf-zoom__value">
          <span className="petal-shelf-zoom__value-number">{currentPct}%</span>
          <ChevronDown size={10} strokeWidth={1.8} />
        </span>
      </button>

      {open ? (
        <div className="petal-shelf-zoom__popover" role="dialog" aria-label={`${label} controls`}>
          <div className="petal-shelf-zoom__slider-row">
            <span className="petal-shelf-zoom__slider-readout">{currentPct}%</span>
            <input
              type="range"
              className="petal-shelf-zoom__slider"
              min={minPct}
              max={maxPct}
              step={1}
              value={currentPct}
              onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
            />
          </div>
          <div className="petal-shelf-zoom__presets">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="petal-shelf-zoom__preset"
                onClick={() => {
                  onScaleChange(preset)
                }}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
            <button
              type="button"
              className="petal-shelf-zoom__preset"
              onClick={() => {
                onFitPage()
              }}
            >
              Fit Page
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
