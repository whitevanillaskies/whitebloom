import { Save, Table2 } from 'lucide-react'
import PetalToolbarButton from '../../components/petal/PetalToolbarButton'
import './CanvasToolbar.css'

type CanvasToolbarProps = {
  onAddTable: () => void
  onSave: () => void
}

export default function CanvasToolbar({ onAddTable, onSave }: CanvasToolbarProps) {
  return (
    <div className="sb-canvas-toolbar">
      <PetalToolbarButton icon={<Table2 size={16} />} label="Add table" onClick={onAddTable} />
      <PetalToolbarButton icon={<Save size={16} />} label="Save" onClick={onSave} />
    </div>
  )
}
