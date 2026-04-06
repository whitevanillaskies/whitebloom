import { toJpeg } from 'html-to-image'

// Fixed thumbnail dimensions used across all tile surfaces.
export const THUMBNAIL_WIDTH = 640
export const THUMBNAIL_HEIGHT = 360

const THUMBNAIL_QUALITY = 0.85

// Returns false to exclude a node from the capture.
//
// Primary gate: data-board-capture="exclude" — add this attribute to any shell
// element rendered inside the capture root that must not appear in thumbnails.
//
// Class-based fallback: covers RF-internal elements and components where we
// cannot annotate the outermost rendered wrapper (NodeToolbar, etc.).
function captureFilter(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true
  if (node.dataset.boardCapture === 'exclude') return false

  // RF panels and chrome (BoardContextBar, CanvasToolbar, MiniMap are wrapped
  // with the data attribute, but these class checks are a safety net).
  if (node.classList.contains('react-flow__panel')) return false
  if (node.classList.contains('react-flow__minimap')) return false
  if (node.classList.contains('react-flow__controls')) return false

  // RF interaction chrome — transient elements that should never appear in thumbnails.
  if (node.classList.contains('react-flow__selection')) return false
  if (node.classList.contains('react-flow__connection')) return false

  // NodeToolbar wrapper — used by NodeResizeHandles; RF owns the outer element.
  if (node.classList.contains('react-flow__node-toolbar')) return false

  // Shell overlays annotated via class name as a fallback for components where
  // the RF wrapper cannot be annotated with the data attribute.
  if (node.classList.contains('format-toolbar')) return false
  if (node.classList.contains('edge-toolbar')) return false

  return true
}

/**
 * Captures the current board viewport as a JPEG data URL.
 * Targets the element marked data-board-capture="root".
 * Returns null and logs on failure — callers must not gate save success on this.
 */
export async function captureBoardThumbnail(): Promise<string | null> {
  const root = document.querySelector<HTMLElement>('[data-board-capture="root"]')
  if (!root) return null

  try {
    return await toJpeg(root, {
      canvasWidth: THUMBNAIL_WIDTH,
      canvasHeight: THUMBNAIL_HEIGHT,
      quality: THUMBNAIL_QUALITY,
      filter: captureFilter,
      pixelRatio: 1,
      backgroundColor: '#ffffff',
    })
  } catch (error) {
    console.error('[thumbnail] capture failed:', error)
    return null
  }
}
