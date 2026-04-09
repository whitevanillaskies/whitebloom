import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEdges, useNodes, useReactFlow, useStore } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import { isShapeLeafNode } from '@renderer/shared/types'
import { ColorControl } from './ColorControl'
import { StrokeControl } from './StrokeControl'
import { CanvasToolbar, CanvasToolbarSep } from './CanvasToolbar'

export function ShapeToolbar() {
  const { t } = useTranslation()
  const { flowToScreenPosition } = useReactFlow()
  // Subscribe directly to the React Flow store so selection-driven visibility
  // isn't gated on an unrelated parent render.
  const nodes = useNodes()
  const edges = useEdges()
  const boardNodes = useBoardStore((s) => s.nodes)
  const patchShapeStyles = useBoardStore((s) => s.patchShapeStyles)

  const transform = useStore((s) => s.transform)
  const prevTransformRef = useRef(transform)
  const [isPanning, setIsPanning] = useState(false)
  const panTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const [, , prevZoom] = prevTransformRef.current
    const [, , nextZoom] = transform
    prevTransformRef.current = transform
    if (nextZoom !== prevZoom) return
    setIsPanning(true)
    if (panTimerRef.current) clearTimeout(panTimerRef.current)
    panTimerRef.current = setTimeout(() => setIsPanning(false), 80)
    return () => {
      if (panTimerRef.current) clearTimeout(panTimerRef.current)
    }
  }, [transform])

  const selectedNodes = nodes.filter((node) => node.selected)
  const selectedEdges = edges.filter((edge) => edge.selected)
  const totalSelectedItems = selectedNodes.length + selectedEdges.length
  if (selectedNodes.length !== 1 || totalSelectedItems !== 1 || isPanning) return null

  const selectedNode = selectedNodes[0]
  const persistedShape = boardNodes.find(
    (candidate): candidate is Extract<(typeof boardNodes)[number], { kind: 'leaf'; type: 'shape' }> =>
      candidate.id === selectedNode.id && isShapeLeafNode(candidate)
  )
  if (!persistedShape) return null

  const width = selectedNode.measured?.width ?? selectedNode.width ?? persistedShape.size.w
  const x = selectedNode.position.x + width / 2
  const y = selectedNode.position.y
  const screen = flowToScreenPosition({ x, y })
  const shapeId = persistedShape.id
  const activeShapeStyle = persistedShape.shape.style

  function patchShapeStyle(patch: Parameters<typeof patchShapeStyles>[1]) {
    patchShapeStyles([shapeId], patch)
  }

  return (
    <CanvasToolbar
      style={{
        position: 'fixed',
        left: screen.x,
        top: screen.y - 12,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'all',
        zIndex: 1000,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <StrokeControl
        stroke={activeShapeStyle.stroke}
        onChange={(stroke) => patchShapeStyle({ stroke })}
        aria-label={t('shapeToolbar.strokeLabel')}
        showDashControls={false}
      />

      <ColorControl
        color={activeShapeStyle.stroke.color}
        onChange={(color) => patchShapeStyle({ stroke: { ...activeShapeStyle.stroke, color } })}
        aria-label={t('shapeToolbar.strokeColorLabel')}
      />

      <CanvasToolbarSep />

      <ColorControl
        color={activeShapeStyle.fill.color}
        onChange={(color) => patchShapeStyle({ fill: { ...activeShapeStyle.fill, color } })}
        aria-label={t('shapeToolbar.fillColorLabel')}
        allowTransparent
        transparentLabel={t('shapeToolbar.transparentFillLabel')}
      />
    </CanvasToolbar>
  )
}
