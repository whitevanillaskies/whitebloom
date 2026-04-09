/**
 * Canvas palette system.
 *
 * Palettes live at the app level. Each workspace stores one activePaletteId.
 * For now the registry is in-memory (hardcoded default palette only).
 * When app-level DB storage is added, PALETTE_REGISTRY will be hydrated from
 * there — the resolver contract stays identical.
 */

export type PaletteSwatch = {
  id: string
  label: string
  value: string // literal CSS color value (hex)
}

export type Palette = {
  id: string
  name: string
  swatches: PaletteSwatch[]
  readonly?: boolean // system palettes cannot be edited
}

// ── Default system palette ────────────────────────────────────────────────────

export const SYSTEM_PALETTE_ID = 'whitebloom-default'

export const WHITEBLOOM_DEFAULT_PALETTE: Palette = {
  id: SYSTEM_PALETTE_ID,
  name: 'Whitebloom',
  readonly: true,
  swatches: [
    { id: 'charcoal', label: 'Charcoal', value: '#2b2b2b' },
    { id: 'slate',    label: 'Slate',    value: '#6b7280' },
    { id: 'blue',     label: 'Blue',     value: '#1e87ff' },
    { id: 'purple',   label: 'Purple',   value: '#7c35ff' },
    { id: 'pink',     label: 'Pink',     value: '#ff285a' },
    { id: 'red',      label: 'Red',      value: '#ec164c' },
    { id: 'orange',   label: 'Orange',   value: '#ff6b2b' },
    { id: 'green',    label: 'Green',    value: '#00b86b' },
    { id: 'teal',     label: 'Teal',     value: '#0bbcd4' },
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

const PALETTE_REGISTRY = new Map<string, Palette>([
  [SYSTEM_PALETTE_ID, WHITEBLOOM_DEFAULT_PALETTE],
])

/** Resolve a swatch reference to its literal CSS color. Returns null if not found. */
export function resolveSwatchColor(paletteId: string, swatchId: string): string | null {
  return PALETTE_REGISTRY.get(paletteId)?.swatches.find((s) => s.id === swatchId)?.value ?? null
}

/** All available palettes (currently just the system default). */
export function getAvailablePalettes(): Palette[] {
  return [...PALETTE_REGISTRY.values()]
}
