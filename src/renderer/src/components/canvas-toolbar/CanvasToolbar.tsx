import { CalendarClock, Hand, MousePointer2, Shapes, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import './CanvasToolbar.css'
import type { Tool } from '@renderer/canvas/tools'

type CanvasToolbarProps = {
    activeTool: Tool
    onToolChange: (tool: Tool) => void
    onShapesClick?: (anchor: { x: number; y: number }) => void
}

export default function CanvasToolbar({ activeTool, onToolChange, onShapesClick }: CanvasToolbarProps) {
    const { t } = useTranslation()

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
                aria-label={t('canvasToolbar.pointerLabel')}
            >
                <MousePointer2 size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={() => onToolChange('hand')}
                className={`canvas-toolbar__button${activeTool === 'hand' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label={t('canvasToolbar.handLabel')}
            >
                <Hand size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={() => onToolChange('text')}
                className={`canvas-toolbar__button${activeTool === 'text' ? ' canvas-toolbar__button--active' : ''}`}
                aria-label={t('canvasToolbar.addTextLabel')}
            >
                <Type size={16} strokeWidth={2} />
            </button>
            <button
                type="button"
                onMouseDown={preventMouseFocus}
                onClick={(e) => {
                    if (!onShapesClick) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    onShapesClick({ x: rect.left, y: rect.top })
                }}
                className={'canvas-toolbar__button'}
                aria-label={t('canvasToolbar.shapesLabel')}>
                    <Shapes size={16} strokeWidth={2} />
            </button>
        </div>
    )
}
