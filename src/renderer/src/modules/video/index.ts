import type { WhitebloomModule } from '../types'
import { VideoIcon } from './VideoIcon'
import { VideoNodeComponent } from './VideoNodeComponent'

export const videoModule: WhitebloomModule = {
  id: 'com.whitebloom.video',
  extensions: ['.mp4', '.m4v', '.mov', '.webm', '.ogv', '.ogg', '.webm'],
  defaultRenderer: 'external',
  IconComponent: VideoIcon,
  accentColor: '--color-accent-blue',
  NodeComponent: VideoNodeComponent
}
