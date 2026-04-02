import { ArrowDownFromLine, ArrowUpToLine, File, Hand, MousePointer2, Type } from 'lucide-react'
import './CanvasToolbar.css'
import type { Tool } from '@renderer/canvas/tools'

type CanvasToolbarProps = {
    activeTool: Tool
    hasUnsavedChanges: boolean
    onToolChange: (tool: Tool) => void
    onNewBoard: () => void
    onSave: () => void
    onLoad: () => void
}

export default function CanvasToolbar({
    activeTool,
    hasUnsavedChanges,
    onToolChange,
    onNewBoard,
    onSave,
    onLoad
}: CanvasToolbarProps) {
    const preventMouseFocus = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
    }

    return (
        <div className="canvas-toolbar">
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={() => onToolChange('pointer')}
                className={`canvas-toolbar__button${activeTool === 'pointer' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label="Pointer"
            >
                <MousePointer2 size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={() => onToolChange('hand')}
                className={`canvas-toolbar__button${activeTool === 'hand' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label="Hand"
            >
                <Hand size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={() => onToolChange('text')}
                className={`canvas-toolbar__button${activeTool === 'text' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label="Add text"
            >
                <Type size={16} strokeWidth={2} />
            </button>

            <div className="canvas-toolbar__separator" />
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={onNewBoard}
                className={`canvas-toolbar__button${hasUnsavedChanges ? ' canvas-toolbar__button--dirty' : ''}`}
                aria-label="New Whiteboard"
            >
                <File size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={onSave}
                className="canvas-toolbar__button"
                aria-label="Save"
            >
                <ArrowUpToLine size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={onLoad}
                className="canvas-toolbar__button"
                aria-label="Load"
            >
                <ArrowDownFromLine size={16} strokeWidth={2} />
            </button>
        </div>
    )
}
