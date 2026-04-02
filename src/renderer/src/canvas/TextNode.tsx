import { Handle, Position, type NodeProps } from '@xyflow/react'
import './TextNode.css'

type TextNodeData = { content: string }

export function TextNode({ data, selected }: NodeProps) {
  const { content } = data as TextNodeData
  return (
    <div className={`text-node${selected ? ' text-node--selected' : ''}`}>
      {content || ''}
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
