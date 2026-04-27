import type { WhitebloomModule } from '../types'
import { ImageNodeComponent } from './ImageNodeComponent'
import { ImageIcon } from './ImageIcon'
import { imageClipboardHandler } from './clipboard'

export const imageModule: WhitebloomModule = {
  id: 'com.whitebloom.image',
  majorModeLabel: 'Image',
  extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tiff', '.svg'],
  defaultRenderer: 'external',
  IconComponent: ImageIcon,
  accentColor: '--color-accent-purple',
  clipboard: imageClipboardHandler,
  NodeComponent: ImageNodeComponent
}
