import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  type Node as RFNode,
  type NodeChange,
  applyNodeChanges,
  Panel
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useBoardStore } from '@renderer/stores/board'
import { TextNode } from './TextNode'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'

const nodeTypes = { text: TextNode }

export function Canvas() {
  const boardNodes = useBoardStore((s) => s.nodes)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)

  // Derive nodes from the store — recomputed when boardNodes changes
  const schemaNodes: RFNode[] = useMemo(
    () =>
      boardNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.position.x, y: n.position.y },
        data: { content: n.content ?? n.label ?? '' }
      })),
    [boardNodes]
  )

  // ReactFlow needs to own node positions during drag, so we keep a
  // local nodes array that starts from schemaNodes but can diverge
  // while dragging. When the store changes, we sync back.
  const [nodes, setNodes] = useState<RFNode[]>(schemaNodes)

  useEffect(() => {
    setNodes(schemaNodes)
  }, [schemaNodes])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds))

      // Sync drag-end positions back to the store
      for (const change of changes) {
        if (
          change.type === 'position' &&
          change.position &&
          !change.dragging
        ) {
          updateNodePosition(change.id, change.position.x, change.position.y)
        }
      }
    },
    [updateNodePosition]
  )

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={15} size={1} color="var(--color-secondary-fg)" />
      <Panel position="bottom-center">
        <CanvasToolbar />
      </Panel>
    </ReactFlow>
  )
}
