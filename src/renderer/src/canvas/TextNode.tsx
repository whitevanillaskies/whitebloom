import { Handle, Position, type NodeProps } from '@xyflow/react'

type TextNodeData = { content: string }

export function TextNode({ data }: NodeProps) {
  const { content } = data as TextNodeData
  return (
    <div style={{ padding: '8px 12px', fontSize: 14, color: '#e0e0e0' }}>
      {content || ''}
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
}
