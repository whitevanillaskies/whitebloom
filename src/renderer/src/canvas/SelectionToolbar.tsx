import { useReactFlow, useViewport, type Node as RFNode } from '@xyflow/react'
import { getSelectionBoundingBox } from './selectionBounds'
import './SelectionToolbar.css'

const TOOLBAR_GAP_PX = 8

type SelectionToolbarProps = {
  selectedNodes: RFNode[]
}

export function SelectionToolbar({ selectedNodes }: SelectionToolbarProps) {
  const { flowToScreenPosition } = useReactFlow()
  useViewport() // subscribe to pan/zoom so position stays in sync

  if (selectedNodes.length === 0) return null
  if (selectedNodes.some((n) => n.dragging)) return null

  const box = getSelectionBoundingBox(selectedNodes)
  if (!box) return null

  const screen = flowToScreenPosition({ x: (box.minX + box.maxX) / 2, y: box.minY })

  return (
    <div
      style={{
        position: 'fixed',
        left: screen.x,
        top: screen.y - TOOLBAR_GAP_PX,
        transform: 'translateX(-50%) translateY(-100%)',
        pointerEvents: 'none',
        zIndex: 10,
        willChange: 'transform, top, left'
      }}
    >
      <div className="selection-toolbar" style={{ pointerEvents: 'auto' }}>
        <span className="selection-toolbar__placeholder">text</span>
      </div>
    </div>
  )
}
