import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useReactFlow, useNodes, useStore } from '@xyflow/react'
import type { Edge as RFEdge } from '@xyflow/react'
import { Spline } from 'lucide-react'
import './EdgeToolbar.css'

type EdgeToolbarProps = {
  edges: RFEdge[]
}

export function EdgeToolbar({ edges }: EdgeToolbarProps) {
  const { t } = useTranslation()
  const { flowToScreenPosition } = useReactFlow()
  const rfNodes = useNodes()

  // Hide while panning — viewport transform changes on every pan frame
  const transform = useStore((s) => s.transform)
  const prevTransformRef = useRef(transform)
  const [isPanning, setIsPanning] = useState(false)
  const panTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const [, , prevZoom] = prevTransformRef.current
    const [, , nextZoom] = transform
    prevTransformRef.current = transform
    // Only hide on pure pan; zoom (including zoom-to-cursor) changes the zoom level
    if (nextZoom !== prevZoom) return
    setIsPanning(true)
    if (panTimerRef.current) clearTimeout(panTimerRef.current)
    panTimerRef.current = setTimeout(() => setIsPanning(false), 80)
    return () => {
      if (panTimerRef.current) clearTimeout(panTimerRef.current)
    }
  }, [transform])

  const selectedEdges = edges.filter((e) => e.selected)
  const selectedNodes = rfNodes.filter((node) => node.selected)
  const totalSelectedItems = selectedEdges.length + selectedNodes.length
  if (selectedEdges.length !== 1 || totalSelectedItems !== 1 || isPanning) return null

  const edge = selectedEdges[0]
  const sourceNode = rfNodes.find((n) => n.id === edge.source)
  const targetNode = rfNodes.find((n) => n.id === edge.target)
  if (!sourceNode || !targetNode) return null

  // Approximate handle positions: center of each node
  const sourceW = sourceNode.measured?.width ?? 0
  const sourceH = sourceNode.measured?.height ?? 0
  const targetW = targetNode.measured?.width ?? 0
  const targetH = targetNode.measured?.height ?? 0

  const sourceCenter = {
    x: sourceNode.position.x + sourceW / 2,
    y: sourceNode.position.y + sourceH / 2,
  }
  const targetCenter = {
    x: targetNode.position.x + targetW / 2,
    y: targetNode.position.y + targetH / 2,
  }

  // Pick the endpoint with the lower Y value (higher on screen) for vertical anchor
  const anchorY = sourceCenter.y <= targetCenter.y ? sourceCenter.y : targetCenter.y
  const midX = (sourceCenter.x + targetCenter.x) / 2

  const screen = flowToScreenPosition({ x: midX, y: anchorY })

  return (
    <div
      className="edge-toolbar"
      data-board-capture="exclude"
      style={{ left: screen.x, top: screen.y - 12 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button className="edge-toolbar__btn" aria-label={t('edgeToolbar.styleLabel')} tabIndex={-1}>
        <Spline size={13} strokeWidth={2} />
      </button>
    </div>
  )
}
