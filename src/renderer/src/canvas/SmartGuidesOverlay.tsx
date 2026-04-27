import { useViewport } from '@xyflow/react'
import type { SmartGuide } from './layoutGeometry'

type SmartGuidesOverlayProps = {
  guides: SmartGuide[]
  padding?: number
}

export function SmartGuidesOverlay({ guides, padding = 24 }: SmartGuidesOverlayProps) {
  const viewport = useViewport()

  if (guides.length === 0) return null

  return (
    <svg
      className="smart-guides-overlay"
      aria-hidden="true"
      focusable="false"
      data-board-capture="exclude"
    >
      {guides.map((guide, index) => {
        if (guide.axis === 'x') {
          const x = guide.value * viewport.zoom + viewport.x
          const y1 = guide.from * viewport.zoom + viewport.y - padding
          const y2 = guide.to * viewport.zoom + viewport.y + padding
          return (
            <line
              key={`${guide.axis}:${guide.value}:${guide.targetNodeId}:${index}`}
              className="smart-guides-overlay__line smart-guides-overlay__line--vertical"
              x1={x}
              y1={y1}
              x2={x}
              y2={y2}
            />
          )
        }

        const y = guide.value * viewport.zoom + viewport.y
        const x1 = guide.from * viewport.zoom + viewport.x - padding
        const x2 = guide.to * viewport.zoom + viewport.x + padding
        return (
          <line
            key={`${guide.axis}:${guide.value}:${guide.targetNodeId}:${index}`}
            className="smart-guides-overlay__line smart-guides-overlay__line--horizontal"
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
          />
        )
      })}
    </svg>
  )
}
