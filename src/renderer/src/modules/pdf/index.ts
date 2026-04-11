import type { WhitebloomModule } from '../types'
import { PdfIcon } from './PdfIcon'
import { PdfNodeComponent } from './PdfNodeComponent'

export const pdfModule: WhitebloomModule = {
  id: 'com.whitebloom.pdf',
  extensions: ['.pdf'],
  defaultRenderer: 'external',
  defaultSize: { w: 180, h: 120 },
  IconComponent: PdfIcon,
  accentColor: '--color-accent-red',
  NodeComponent: PdfNodeComponent
}
