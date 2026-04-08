import type { WhitebloomModule } from '../types'
import { BoardBloomIcon } from './BoardBloomIcon'
import { BoardBloomNode } from './BoardBloomNode'

export const boardBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.boardbloom',
  extensions: [],
  defaultRenderer: 'internal',
  defaultSize: { w: 196, h: 128 },

  recognizes(resource: string): boolean {
    return /\.wb\.json$/i.test(resource)
  },

  IconComponent: BoardBloomIcon,
  accentColor: '--color-accent-green',
  NodeComponent: BoardBloomNode
}
