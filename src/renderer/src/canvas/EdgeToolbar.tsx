import { useTranslation } from 'react-i18next'
import { useEdges, useNodes, useReactFlow } from '@xyflow/react'
import { ArrowLeft, ArrowRight, Type } from 'lucide-react'
import { useBoardStore } from '@renderer/stores/board'
import { normalizeEdgeStyle } from '@renderer/shared/types'
import { ColorControl } from './ColorControl'
import { StrokeControl } from './StrokeControl'
import { CanvasToolbar, CanvasToolbarBtn, CanvasToolbarSep } from './CanvasToolbar'
import { useTransientViewportPanState } from './useTransientViewportPanState'
import type { WbEdgeData } from './WbEdge'

export function EdgeToolbar() {
  const { t } = useTranslation()
  const { flowToScreenPosition } = useReactFlow()
  // Subscribe directly to the React Flow store so the toolbar tracks selection
  // even when the parent canvas doesn't happen to re-render on the same tick.
  const nodes = useNodes()
  const edges = useEdges()
  const boardEdges = useBoardStore((s) => s.edges)
  const patchEdgeStyles = useBoardStore((s) => s.patchEdgeStyles)
  const { isPanning, viewportInitialized } = useTransientViewportPanState()

  const selectedEdges = edges.filter((e) => e.selected)
  const selectedNodes = nodes.filter((node) => node.selected)
  const totalSelectedItems = selectedEdges.length + selectedNodes.length
  if (!viewportInitialized || selectedEdges.length !== 1 || totalSelectedItems !== 1 || isPanning)
    return null

  const edge = selectedEdges[0]
  const persistedEdge = boardEdges.find((candidate) => candidate.id === edge.id)
  const edgeStyle =
    (edge.data as WbEdgeData | undefined)?.normalizedStyle ??
    (persistedEdge ? normalizeEdgeStyle(persistedEdge) : null)

  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)
  if (!sourceNode || !targetNode || !edgeStyle) return null
  const activeEdgeStyle = edgeStyle

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

  function patchEdgeStyle(patch: Parameters<typeof patchEdgeStyles>[1]) {
    patchEdgeStyles([edge.id], patch)
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
      onMouseDown={(e) => e.stopPropagation()}
    >
      <StrokeControl
        stroke={activeEdgeStyle.stroke}
        onChange={(stroke) => patchEdgeStyle({ stroke })}
        aria-label={t('edgeToolbar.strokeLabel')}
      />

      <ColorControl
        color={activeEdgeStyle.stroke.color}
        onChange={(color) => patchEdgeStyle({ stroke: { ...activeEdgeStyle.stroke, color } })}
        aria-label={t('edgeToolbar.colorLabel')}
      />

      <ColorControl
        color={activeEdgeStyle.labelColor}
        onChange={(labelColor) => patchEdgeStyle({ labelColor })}
        aria-label={t('edgeToolbar.labelColorLabel')}
        coloredIcon={<Type size={13} strokeWidth={2.1} />}
      />

      <CanvasToolbarSep />

      <CanvasToolbarBtn
        aria-label={t('edgeToolbar.startMarkerLabel')}
        title={t('edgeToolbar.startMarkerLabel')}
        active={activeEdgeStyle.startMarker === 'arrow'}
        onClick={() =>
          patchEdgeStyle({
            startMarker: activeEdgeStyle.startMarker === 'arrow' ? 'none' : 'arrow'
          })
        }
      >
        <ArrowLeft size={13} strokeWidth={2.1} />
      </CanvasToolbarBtn>

      <CanvasToolbarBtn
        aria-label={t('edgeToolbar.endMarkerLabel')}
        title={t('edgeToolbar.endMarkerLabel')}
        active={activeEdgeStyle.endMarker === 'arrow'}
        onClick={() =>
          patchEdgeStyle({
            endMarker: activeEdgeStyle.endMarker === 'arrow' ? 'none' : 'arrow'
          })
        }
      >
        <ArrowRight size={13} strokeWidth={2.1} />
      </CanvasToolbarBtn>
    </CanvasToolbar>
  )
}
