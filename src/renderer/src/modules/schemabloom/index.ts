import type { WhitebloomModule } from '../types'
import { SchemaBloomEditor } from './SchemaBloomEditor'
import { SchemaBloomNode } from './SchemaBloomNode'
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

  NodeComponent: SchemaBloomNode,
  EditorComponent: SchemaBloomEditor
}
