import type { WhitebloomModule } from '../types'
import { PdfEditor } from './PdfEditor'
import { PdfIcon } from './PdfIcon'
import { PdfNodeComponent } from './PdfNodeComponent'

export const pdfModule: WhitebloomModule = {
  id: 'com.whitebloom.pdf',
  majorModeLabel: 'PDF',
  extensions: ['.pdf'],
  defaultRenderer: 'internal',
  defaultSize: { w: 180, h: 120 },
  editorDataSource: 'resource',
  IconComponent: PdfIcon,
  accentColor: '--color-accent-red',
  NodeComponent: PdfNodeComponent,
  EditorComponent: PdfEditor
}
