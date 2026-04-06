import type { WhitebloomModule } from '../types'
import { BUD_ICON_NODE_W } from '@renderer/canvas/canvas-constants'
import { ObsidianBloomIcon } from './ObsidianBloomIcon'
import { ObsidianBloomNode } from './ObsidianBloomNode'

export const obsidianBloomModule: WhitebloomModule = {
  id: 'io.obsidianbloom.vault',
  extensions: [],
  defaultRenderer: 'external',
  importable: false,
  handlesDirectories: true,
  defaultSize: { w: BUD_ICON_NODE_W, h: BUD_ICON_NODE_W },

  /**
   * Recognizes an Obsidian vault by the presence of a `.obsidian/` config directory
   * at the root of the dropped folder.
   */
  async recognizes(dirPath: string): Promise<boolean> {
    // fs.stat in the main process accepts mixed separators on all platforms
    return window.api.isDirectory(dirPath + '/.obsidian')
  },

  IconComponent: ObsidianBloomIcon,
  accentColor: '--color-accent-purple',
  NodeComponent: ObsidianBloomNode
}
