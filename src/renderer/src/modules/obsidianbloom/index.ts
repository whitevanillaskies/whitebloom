import type { WhitebloomModule } from '../types'
import { ObsidianBloomIcon } from './ObsidianBloomIcon'
import { ObsidianBloomNode } from './ObsidianBloomNode'

export const obsidianBloomModule: WhitebloomModule = {
  id: 'io.obsidianbloom.vault',
  extensions: [],
  defaultRenderer: 'external',
  importable: false,
  handlesDirectories: true,

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
