import { NodeToolbar, Position, useStore } from '@xyflow/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResizeCorner } from './useFixedCornerResize'
import './NodeResizeHandles.css'

type NodeResizeHandlesProps = {
  visible: boolean
  activeCorner: ResizeCorner | null
  onPointerDown: (corner: ResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => void
}

export function NodeResizeHandles({ visible, activeCorner, onPointerDown }: NodeResizeHandlesProps) {
  const { t } = useTranslation()
  const selectedNodeCount = useStore((state) => state.nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0))
  const selectedEdgeCount = useStore((state) => state.edges.reduce((count, edge) => count + (edge.selected ? 1 : 0), 0))
  const isSingleNodeSelection = selectedNodeCount === 1 && selectedEdgeCount === 0
  const shouldShowHandles = visible && (isSingleNodeSelection || activeCorner !== null)

  const handleConfig = [
    { align: 'start' as const, ariaLabel: t('nodeResizeHandles.topLeftAria'),     corner: 'nw' as ResizeCorner, position: Position.Top },
    { align: 'end'   as const, ariaLabel: t('nodeResizeHandles.topRightAria'),    corner: 'ne' as ResizeCorner, position: Position.Top },
    { align: 'end'   as const, ariaLabel: t('nodeResizeHandles.bottomRightAria'), corner: 'se' as ResizeCorner, position: Position.Bottom },
    { align: 'start' as const, ariaLabel: t('nodeResizeHandles.bottomLeftAria'),  corner: 'sw' as ResizeCorner, position: Position.Bottom }
  ]

  return (
    <>
      {handleConfig.map(({ align, ariaLabel, corner, position }) => (
        <NodeToolbar
          key={corner}
          isVisible={shouldShowHandles}
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
