import { registerModule } from './registry'
import { imageModule } from './image'
import { focusWriterModule } from './focus-writer'
import { schemaBloomModule } from './schemabloom'
import { obsidianBloomModule } from './obsidianbloom'

registerModule(imageModule)
registerModule(focusWriterModule)
registerModule(schemaBloomModule)
registerModule(obsidianBloomModule)
