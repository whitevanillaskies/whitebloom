import { DEFAULT_CANVAS_TEXT } from '@renderer/shared/types'
import type { ColorValue, VectorColorToken } from '@renderer/shared/types'
import { resolveSwatchColor } from './palette'

const VECTOR_COLOR_TOKENS: Record<VectorColorToken, string> = {
  blue: 'var(--color-accent-blue)',
  pink: 'var(--color-accent-pink)',
  red: 'var(--color-accent-red)',
  purple: 'var(--color-accent-purple)',
  green: 'var(--color-accent-green)',
  neutral: 'var(--color-panel)',
  foreground: 'var(--color-primary-fg)'
}

function isDirectCssColor(value: string): boolean {
  return (
    value.startsWith('#') ||
    value.startsWith('rgb') ||
    value.startsWith('hsl') ||
    value.startsWith('var(')
  )
}

/**
 * Shared color resolution for vector-rendered canvas elements.
 * Token colors resolve to CSS variables; custom colors pass through untouched.
 * Legacy string colors are accepted so edges can adopt this helper before their
 * persisted color model is upgraded.
 */
export function resolveVectorColor(
  color: ColorValue | string | null | undefined,
  fallback = 'var(--color-primary-fg)'
): string {
  if (!color) return fallback

  if (typeof color === 'string') {
    if (isDirectCssColor(color)) return color
    return VECTOR_COLOR_TOKENS[color as VectorColorToken] ?? fallback
  }

  if (color.kind === 'custom') return color.value
  if (color.kind === 'swatch') return resolveSwatchColor(color.paletteId, color.swatchId) ?? fallback
  return VECTOR_COLOR_TOKENS[color.value] ?? fallback
}

export function resolveCanvasStrokeColor(
  color: ColorValue | string | null | undefined,
  fallback = 'var(--color-primary-fg)'
): string {
  return resolveVectorColor(color, fallback)
}

export function resolveCanvasFillColor(
  color: ColorValue | string | null | undefined,
  fallback = 'transparent'
): string {
  return resolveVectorColor(color, fallback)
}

export function resolveCanvasTextColor(
  color?: ColorValue | string | null,
  fallback = 'var(--color-primary-fg)'
): string {
  return resolveVectorColor(color ?? DEFAULT_CANVAS_TEXT.color, fallback)
}

export function resolveCanvasMarkerColor(
  color: ColorValue | string | null | undefined,
  fallback = 'var(--color-primary-fg)'
): string {
  return resolveVectorColor(color, fallback)
}

/**
 * Shared stroke rendering defaults for SVG vector elements on the canvas.
 * Stroke width remains in flow-space units for now, so it naturally scales
 * with node size and canvas zoom.
 */
export function getSvgStrokeProps(strokeWidth: number) {
  return {
    strokeWidth,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const
  }
}
