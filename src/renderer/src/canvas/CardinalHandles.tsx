import { Handle, Position } from '@xyflow/react'
import { CONNECTION_HANDLE_OUTSET_PX, NODE_HANDLE_IDS } from './canvas-constants'

type HandleOffsets = {
  top?: number
  left?: number
  bottom?: number
  right?: number
}

type CardinalHandlesProps = {
  hidden?: boolean
  offsets?: HandleOffsets
}

function renderHandlePair(
  id: string,
  position: Position,
  style: React.CSSProperties
): React.JSX.Element {
  return (
    <>
      <Handle id={id} type="target" position={position} style={style} />
      <Handle id={id} type="source" position={position} style={style} />
    </>
  )
}

export function CardinalHandles({ hidden = false, offsets }: CardinalHandlesProps): React.JSX.Element {
  return (
    <span style={{ visibility: hidden ? 'hidden' : undefined }}>
      {renderHandlePair(NODE_HANDLE_IDS.top, Position.Top, {
        top: -CONNECTION_HANDLE_OUTSET_PX,
        ...(typeof offsets?.top === 'number' ? { left: offsets.top } : {})
      })}
      {renderHandlePair(NODE_HANDLE_IDS.left, Position.Left, {
        left: -CONNECTION_HANDLE_OUTSET_PX,
        ...(typeof offsets?.left === 'number' ? { top: offsets.left } : {})
      })}
      {renderHandlePair(NODE_HANDLE_IDS.bottom, Position.Bottom, {
        bottom: -CONNECTION_HANDLE_OUTSET_PX,
        ...(typeof offsets?.bottom === 'number' ? { left: offsets.bottom } : {})
      })}
      {renderHandlePair(NODE_HANDLE_IDS.right, Position.Right, {
        right: -CONNECTION_HANDLE_OUTSET_PX,
        ...(typeof offsets?.right === 'number' ? { top: offsets.right } : {})
      })}
    </span>
  )
}
