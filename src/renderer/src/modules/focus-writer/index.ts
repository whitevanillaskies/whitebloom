import type { WhitebloomModule } from '../types'
import { FocusWriterNode } from './FocusWriterNode'
import { FocusWriterEditor } from './FocusWriterEditor'

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

  NodeComponent: FocusWriterNode,
  EditorComponent: FocusWriterEditor
}
