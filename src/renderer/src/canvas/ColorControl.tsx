import { useEffect, useId, useRef } from 'react'
import type { ColorValue } from '@renderer/shared/types'
import { CanvasToolbarBtn, CanvasToolbarSwatch, useCanvasToolbarPopover } from './CanvasToolbar'
import { CanvasPopover } from './CanvasPopover'
import {
  WHITEBLOOM_DEFAULT_PALETTE,
  SYSTEM_PALETTE_ID,
  type PaletteSwatch,
} from './palette'
import { resolveVectorColor } from './vectorStyles'
import './CanvasPopover.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSwatchSelected(color: ColorValue, swatch: PaletteSwatch): boolean {
  if (color.kind === 'swatch') {
    return color.paletteId === SYSTEM_PALETTE_ID && color.swatchId === swatch.id
  }
  if (color.kind === 'custom') {
    return color.value.toLowerCase() === swatch.value.toLowerCase()
  }
  return false
}

/** Convert any ColorValue to a hex string suitable for <input type="color">. */
function colorToInputHex(color: ColorValue): string {
  const resolved = resolveVectorColor(color)
  // CSS var strings can't be fed to input[type=color]; fall back to charcoal
  if (resolved.startsWith('var(')) return '#2b2b2b'
  return resolved.startsWith('#') ? resolved : '#2b2b2b'
}

// ── Component ─────────────────────────────────────────────────────────────────

type ColorControlProps = {
  color: ColorValue
  onChange: (color: ColorValue) => void
  'aria-label': string
  allowTransparent?: boolean
  transparentLabel?: string
}

/**
 * Reusable toolbar color control: a swatch button that opens a color picker popover.
 * Works for stroke color, fill color, label color — anything expressed as a ColorValue.
 *
 * Usage: place inside a CanvasToolbar; it handles its own popover lifecycle.
 */
export function ColorControl({
  color,
  onChange,
  'aria-label': ariaLabel,
  allowTransparent = false,
  transparentLabel = 'Transparent'
}: ColorControlProps) {
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

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

  const resolvedColor = resolveVectorColor(color)
  const palette = WHITEBLOOM_DEFAULT_PALETTE

  function handleSwatchClick(swatch: PaletteSwatch) {
    onChange({ kind: 'swatch', paletteId: SYSTEM_PALETTE_ID, swatchId: swatch.id })
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ kind: 'custom', value: e.target.value })
    // Keep popover open while picking — native picker is modal, no need to close
  }

  function handleTransparentClick() {
    onChange({ kind: 'custom', value: 'transparent' })
  }

  return (
    <div className="canvas-control" ref={controlRef}>
      <CanvasToolbarBtn
        aria-label={ariaLabel}
        popoverId={popoverId}
        active={open}
      >
        <CanvasToolbarSwatch color={resolvedColor} />
      </CanvasToolbarBtn>

      {open && (
        <CanvasPopover anchorRef={controlRef} className="canvas-color-picker">
          <div className="canvas-color-picker__palette-name">{palette.name}</div>

          <div className="canvas-color-picker__swatches">
            {palette.swatches.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                tabIndex={-1}
                className={`canvas-color-picker__swatch${isSwatchSelected(color, swatch) ? ' canvas-color-picker__swatch--selected' : ''}`}
                style={{ backgroundColor: swatch.value }}
                aria-label={swatch.label}
                title={swatch.label}
                onClick={() => handleSwatchClick(swatch)}
              />
            ))}
          </div>

          <div className="canvas-popover__sep" />

          {allowTransparent && (
            <>
              <button
                type="button"
                className="canvas-color-picker__option"
                onClick={handleTransparentClick}
              >
                <CanvasToolbarSwatch color="transparent" />
                <span className="canvas-color-picker__custom-label">{transparentLabel}</span>
              </button>

              <div className="canvas-popover__sep" />
            </>
          )}

          <div
            className="canvas-color-picker__option"
            onClick={() => colorInputRef.current?.click()}
          >
            <input
              ref={colorInputRef}
              type="color"
              className="canvas-color-picker__custom-input"
              value={colorToInputHex(color)}
              onChange={handleCustomChange}
              tabIndex={-1}
            />
            <span className="canvas-color-picker__custom-label">Custom</span>
          </div>
        </CanvasPopover>
      )}
    </div>
  )
}
