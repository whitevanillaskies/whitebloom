import type { WhitebloomModule } from '../types'
import { DramaticBloomEditor } from './DramaticBloomEditor'
import { DramaticBloomIcon } from './DramaticBloomIcon'
import { DramaticBloomNode } from './DramaticBloomNode'
import { createDefaultDramaticBloomProject, serializeDramaticBloomProject } from './model'

export const dramaticBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.dramaticbloom',
  majorModeLabel: 'DramaticBloom',
  extensions: ['.drb'],
  defaultRenderer: 'internal',
  defaultSize: { w: 260, h: 180 },

  recognizes(resource: string): boolean {
    return resource.toLowerCase().endsWith('.drb')
  },

  createDefault(): string {
    return serializeDramaticBloomProject(createDefaultDramaticBloomProject())
  },

  IconComponent: DramaticBloomIcon,
  accentColor: '--color-accent-purple',
  NodeComponent: DramaticBloomNode,
  EditorComponent: DramaticBloomEditor
}
