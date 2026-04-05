import type { WhitebloomModule } from '../types'
import { ImageNodeComponent } from './ImageNodeComponent'

export const imageModule: WhitebloomModule = {
  id: 'com.whitebloom.image',
  extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tiff', '.svg'],
  defaultRenderer: 'external',
  NodeComponent: ImageNodeComponent
}
