import type { WhitebloomModule } from '../types'
import { MarkdownBloomEditor } from './MarkdownBloomEditor'
import { MarkdownBloomIcon } from './MarkdownBloomIcon'
import { MarkdownBloomNode } from './MarkdownBloomNode'

function isMarkdownResource(resource: string): boolean {
  const normalized = resource.toLowerCase()
  return normalized.endsWith('.md') || normalized.endsWith('.markdown')
}

export const markdownBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.markdownbloom',
  majorModeLabel: 'Markdown',
  extensions: ['.md', '.markdown'],
  defaultRenderer: 'internal',
  defaultSize: { w: 248, h: 184 },

  recognizes(resource: string): boolean {
    return isMarkdownResource(resource)
  },

  createDefault(): string {
    return '# Untitled\n\n'
  },

  IconComponent: MarkdownBloomIcon,
  accentColor: '--color-accent-blue',
  NodeComponent: MarkdownBloomNode,
  EditorComponent: MarkdownBloomEditor
}
