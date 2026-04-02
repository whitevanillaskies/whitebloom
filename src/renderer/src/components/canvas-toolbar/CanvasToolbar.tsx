import { ArrowDownFromLine, ArrowUpToLine } from 'lucide-react'
import './CanvasToolbar.css'

type CanvasToolbarProps = {
    onSave: () => void
    onLoad: () => void
}

export default function CanvasToolbar({ onSave, onLoad }: CanvasToolbarProps) {
    return (
        <div className="canvas-toolbar">
            <button type="button" onClick={onSave} className="canvas-toolbar__button" aria-label="Save">
                <ArrowUpToLine size={16} strokeWidth={2}/>
            </button>
            <button type="button" onClick={onLoad} className="canvas-toolbar__button" aria-label="Load">
                <ArrowDownFromLine size={16} strokeWidth={2}/>
            </button>
        </div>
    )
}