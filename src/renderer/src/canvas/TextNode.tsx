import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import './TextNode.css'

type TextNodeData = { content: string }

export function TextNode({ data, selected, dragging }: NodeProps) {
  const { content } = data as TextNodeData
  return (
    <>
      <NodeToolbar isVisible={selected && !dragging} position={Position.Top} offset={8}>
        <div className="text-node-toolbar">
          <span className="text-node-toolbar__placeholder">toolbar</span>
        </div>
      </NodeToolbar>

      <div className={`text-node${selected ? ' text-node--selected' : ''}`}>
        {content || ''}
        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  )
}
