import type { WhitebloomModule } from '../types'
import { BUD_ICON_NODE_W } from '@renderer/canvas/canvas-constants'
import { WebPageBloomIcon } from './WebPageBloomIcon'
import { WebPageBloomNode } from './WebPageBloomNode'

export const webPageBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.webpagebloom',
  extensions: [],
  defaultRenderer: 'external',
  defaultSize: { w: BUD_ICON_NODE_W, h: BUD_ICON_NODE_W },
  IconComponent: WebPageBloomIcon,
  accentColor: '--color-accent-blue',
  NodeComponent: WebPageBloomNode
}
