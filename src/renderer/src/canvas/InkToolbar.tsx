import { Eraser, Pen, Trash2 } from 'lucide-react'
import { CanvasToolbar, CanvasToolbarBtn, CanvasToolbarSep } from './CanvasToolbar'

export type InkTool = 'pen' | 'eraser'

type InkToolbarProps = {
  activeTool: InkTool
  onToolChange: (tool: InkTool) => void
  onClearLayer: () => void
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>
}

export function InkToolbar({ activeTool, onToolChange, onClearLayer, onMouseDown }: InkToolbarProps) {
  return (
    <CanvasToolbar onMouseDown={onMouseDown}>
      <CanvasToolbarBtn
        active={activeTool === 'pen'}
        onClick={() => onToolChange('pen')}
        aria-label="Pen"
        title="Pen"
      >
        <Pen size={14} strokeWidth={1.8} />
      </CanvasToolbarBtn>
      <CanvasToolbarBtn
        active={activeTool === 'eraser'}
        onClick={() => onToolChange('eraser')}
        aria-label="Eraser"
        title="Eraser"
      >
        <Eraser size={14} strokeWidth={1.8} />
      </CanvasToolbarBtn>
      <CanvasToolbarSep />
      <CanvasToolbarBtn
        onClick={onClearLayer}
        aria-label="Clear ink layer"
        title="Clear ink layer"
      >
        <Trash2 size={14} strokeWidth={1.8} />
      </CanvasToolbarBtn>
    </CanvasToolbar>
  )
}
