import { registerModule } from './registry'
import { imageModule } from './image'
import { focusWriterModule } from './focus-writer'
import { boardBloomModule } from './boardbloom'
import { schemaBloomModule } from './schemabloom'
import { obsidianBloomModule } from './obsidianbloom'

registerModule(imageModule)
registerModule(focusWriterModule)
registerModule(boardBloomModule)
registerModule(schemaBloomModule)
registerModule(obsidianBloomModule)
