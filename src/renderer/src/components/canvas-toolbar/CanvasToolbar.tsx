import { ArrowDownFromLine, ArrowUpToLine, Hand, MousePointer2, Type } from 'lucide-react'
import './CanvasToolbar.css'
import type { Tool } from '@renderer/canvas/tools'

type CanvasToolbarProps = {
    activeTool: Tool
    onToolChange: (tool: Tool) => void
    onSave: () => void
    onLoad: () => void
}

export default function CanvasToolbar({ activeTool, onToolChange, onSave, onLoad }: CanvasToolbarProps) {
    return (
        <div className="canvas-toolbar">
            <button
                type="button"
                onClick={() => onToolChange('pointer')}
                className={`canvas-toolbar__button${activeTool === 'pointer' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label="Pointer"
            >
                <MousePointer2 size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onClick={() => onToolChange('hand')}
                className={`canvas-toolbar__button${activeTool === 'hand' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label="Hand"
            >
                <Hand size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onClick={() => onToolChange('text')}
                className={`canvas-toolbar__button${activeTool === 'text' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label="Add text"
            >
                <Type size={16} strokeWidth={2} />
            </button>

            <div className="canvas-toolbar__separator" />

            <button type="button" onClick={onSave} className="canvas-toolbar__button" aria-label="Save">
                <ArrowUpToLine size={16} strokeWidth={2} />
            </button>
            <button type="button" onClick={onLoad} className="canvas-toolbar__button" aria-label="Load">
                <ArrowDownFromLine size={16} strokeWidth={2} />
            </button>
        </div>
    )
}
