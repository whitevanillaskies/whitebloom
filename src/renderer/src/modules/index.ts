import { registerModule } from './registry'
import { imageModule } from './image'
import { focusWriterModule } from './focus-writer'
import { schemaBloomModule } from './schemabloom'

registerModule(imageModule)
registerModule(focusWriterModule)
registerModule(schemaBloomModule)
