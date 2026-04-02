import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  type Node as RFNode,
  type NodeChange,
  applyNodeChanges,
  Panel,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useBoardStore } from '@renderer/stores/board'
import { TextNode } from './TextNode'
import CanvasToolbar from '@renderer/components/canvas-toolbar/CanvasToolbar'
import type { Board } from '@renderer/shared/types'
import { makeLexicalContent } from '@renderer/shared/types'
import type { Tool } from './tools'

const nodeTypes = { text: TextNode }

const cursorForTool: Record<Tool, string> = {
  pointer: 'default',
  hand: 'grab',
  text: 'crosshair'
}

export function Canvas() {
  const boardNodes = useBoardStore((s) => s.nodes)
  const boardEdges = useBoardStore((s) => s.edges)
  const version = useBoardStore((s) => s.version)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const addNode = useBoardStore((s) => s.addNode)
  const loadBoard = useBoardStore((s) => s.loadBoard)

  const { screenToFlowPosition } = useReactFlow()

  const [activeTool, setActiveTool] = useState<Tool>('pointer')

  // Derive RF nodes from store
  const schemaNodes: RFNode[] = useMemo(
    () =>
      boardNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.position.x, y: n.position.y },
        data: {
          content: n.content ?? makeLexicalContent(n.label ?? ''),
          widthMode: n.widthMode ?? 'auto',
          wrapWidth: n.wrapWidth ?? null,
          size: n.size
        }
      })),
    [boardNodes]
  )

  // Local state so RF can update positions during drag
  const [nodes, setNodes] = useState<RFNode[]>(schemaNodes)
  useEffect(() => {
    setNodes((prev) => {
      const selectedIds = new Set(prev.filter((n) => n.selected).map((n) => n.id))
      return schemaNodes.map((n) => ({ ...n, selected: selectedIds.has(n.id) }))
    })
  }, [schemaNodes])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateNodePosition(change.id, change.position.x, change.position.y)
        }
      }
    },
    [updateNodePosition]
  )

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'text') return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode({
        id: crypto.randomUUID(),
        kind: 'leaf',
        type: 'text',
        position,
        size: { w: 200, h: 40 },
        content: makeLexicalContent('text'),
        widthMode: 'auto',
        wrapWidth: null
      })
      setActiveTool('pointer')
    },
    [activeTool, screenToFlowPosition, addNode]
  )

  const handleSave = useCallback(async () => {
    const board: Board = { version, nodes: boardNodes, edges: boardEdges }
    await window.api.saveBoard(JSON.stringify(board, null, 2))
  }, [version, boardNodes, boardEdges])

  const handleLoad = useCallback(async () => {
    const result = await window.api.loadBoard()
    if (!result.ok || !result.json) return
    try {
      const board: Board = JSON.parse(result.json)
      loadBoard(board)
    } catch {
      console.error('Failed to parse board file')
    }
  }, [loadBoard])

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onPaneClick={onPaneClick}
      nodesDraggable={activeTool === 'pointer'}
      panOnDrag={activeTool !== 'text'}
      style={{ cursor: cursorForTool[activeTool] }}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={25} size={1} color="var(--color-secondary-fg)" />
      <Panel position="bottom-center">
        <CanvasToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onSave={handleSave}
          onLoad={handleLoad}
        />
      </Panel>
    </ReactFlow>
  )
}
