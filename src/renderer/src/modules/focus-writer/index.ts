import type { WhitebloomModule } from '../types'
import { FocusWriterNode } from './FocusWriterNode'
import { FocusWriterEditor } from './FocusWriterEditor'
import { FocusWriterIcon } from './FocusWriterIcon'

export const focusWriterModule: WhitebloomModule = {
  id: 'com.whitebloom.focus-writer',
  extensions: ['.blt'],
  defaultRenderer: 'internal',

  recognizes(resource: string): boolean {
    return resource.endsWith('.blt')
  },

  createDefault(): string {
    return ''
  },

  IconComponent: FocusWriterIcon,
  accentColor: '--color-accent-pink',
  NodeComponent: FocusWriterNode,
  EditorComponent: FocusWriterEditor
}
