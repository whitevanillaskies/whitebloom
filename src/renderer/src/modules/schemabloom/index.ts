import type { WhitebloomModule } from '../types'
import { SchemaBloomEditor } from './SchemaBloomEditor'
import { SchemaBloomNode } from './SchemaBloomNode'
import { SchemaBloomIcon } from './SchemaBloomIcon'
import { saveSchema, createEmptySchema } from './schema'

export const schemaBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.schemabloom',
  extensions: ['.bdb'],
  defaultRenderer: 'internal',

  recognizes(resource: string): boolean {
    return resource.endsWith('.bdb')
  },

  createDefault(): string {
    return saveSchema(createEmptySchema())
  },

  IconComponent: SchemaBloomIcon,
  accentColor: '--color-accent-blue',
  NodeComponent: SchemaBloomNode,
  EditorComponent: SchemaBloomEditor
}
