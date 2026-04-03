import { NodeToolbar, Position } from '@xyflow/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ResizeCorner } from './useFixedCornerResize'
import './NodeResizeHandles.css'

type NodeResizeHandlesProps = {
  visible: boolean
  activeCorner: ResizeCorner | null
  onPointerDown: (corner: ResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => void
}

const HANDLE_CONFIG: Array<{
  align: 'start' | 'end'
  ariaLabel: string
  corner: ResizeCorner
  position: Position
}> = [
  { align: 'start', ariaLabel: 'Resize from top left', corner: 'nw', position: Position.Top },
  { align: 'end', ariaLabel: 'Resize from top right', corner: 'ne', position: Position.Top },
  { align: 'end', ariaLabel: 'Resize from bottom right', corner: 'se', position: Position.Bottom },
  { align: 'start', ariaLabel: 'Resize from bottom left', corner: 'sw', position: Position.Bottom }
]

export function NodeResizeHandles({ visible, activeCorner, onPointerDown }: NodeResizeHandlesProps) {
  return (
    <>
      {HANDLE_CONFIG.map(({ align, ariaLabel, corner, position }) => (
        <NodeToolbar
          key={corner}
          isVisible={visible}
          position={position}
          align={align}
          offset={0}
          className="node-resize-handles__toolbar"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={ariaLabel}
            className={`node-resize-handles__handle node-resize-handles__handle--${corner}${activeCorner === corner ? ' node-resize-handles__handle--active' : ''}`}
            onPointerDown={(event) => onPointerDown(corner, event)}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          />
        </NodeToolbar>
      ))}
    </>
  )
}