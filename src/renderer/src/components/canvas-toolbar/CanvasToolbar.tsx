import { CalendarClock, Hand, Hexagon, MessageCircleMore, MousePointer2, Type } from 'lucide-react'
import './CanvasToolbar.css'
import type { Tool } from '@renderer/canvas/tools'

type CanvasToolbarProps = {
    activeTool: Tool
    onToolChange: (tool: Tool) => void
}

export default function CanvasToolbar({ activeTool, onToolChange }: CanvasToolbarProps) {
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
            <button
                type="button"
                 className={'canvas-toolbar__button'}
                aria-label='TODO - alerts'>
                    <CalendarClock size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                 className={'canvas-toolbar__button'}
                aria-label='TODO - comments'>
                    <MessageCircleMore size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                 className={'canvas-toolbar__button'}
                aria-label='TODO - shapes'>
                    <Hexagon size={16} strokeWidth={2} />
            </button>            
        </div>
    )
}
