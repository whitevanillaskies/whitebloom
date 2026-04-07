import { Save, Table2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PetalToolbarButton from '../../components/petal/PetalToolbarButton'
import './CanvasToolbar.css'

type CanvasToolbarProps = {
  onAddTable: () => void
  onSave: () => void
}

export default function CanvasToolbar({ onAddTable, onSave }: CanvasToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="sb-canvas-toolbar">
      <PetalToolbarButton icon={<Table2 size={16} />} label={t('schemaBloomToolbar.addTableLabel')} onClick={onAddTable} />
      <PetalToolbarButton icon={<Save size={16} />} label={t('schemaBloomToolbar.saveLabel')} onClick={onSave} />
    </div>
  )
}
