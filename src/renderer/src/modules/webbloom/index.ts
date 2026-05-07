import type { WhitebloomModule } from '../types'
import { WebBloomIcon } from './WebBloomIcon'
import { WebBloomNode } from './WebBloomNode'

export const webBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.webbloom',
  majorModeLabel: 'WebBloom',
  extensions: [],
  defaultRenderer: 'external',
  defaultSize: { w: 640, h: 420 },
  importable: false,
  IconComponent: WebBloomIcon,
  accentColor: '--color-accent-green',
  NodeComponent: WebBloomNode
}
