import type { WhitebloomModule } from '../types'
import { ImageNodeComponent } from './ImageNodeComponent'
import { ImageIcon } from './ImageIcon'

export const imageModule: WhitebloomModule = {
  id: 'com.whitebloom.image',
  extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tiff', '.svg'],
  defaultRenderer: 'external',
  IconComponent: ImageIcon,
  accentColor: '--color-accent-purple',
  NodeComponent: ImageNodeComponent
}
