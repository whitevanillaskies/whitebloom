import { registerModule } from './registry'
import { imageModule } from './image'
import { videoModule } from './video'
import { focusWriterModule } from './focus-writer'
import { boardBloomModule } from './boardbloom'
import { schemaBloomModule } from './schemabloom'
import { obsidianBloomModule } from './obsidianbloom'
import { webBloomModule } from './webbloom'
import { webPageBloomModule } from './webpagebloom'
import { pdfModule } from './pdf'
import { markdownBloomModule } from './markdownbloom'

registerModule(imageModule)
registerModule(videoModule)
registerModule(focusWriterModule)
registerModule(boardBloomModule)
registerModule(schemaBloomModule)
registerModule(obsidianBloomModule)
registerModule(webBloomModule)
registerModule(webPageBloomModule)
registerModule(pdfModule)
registerModule(markdownBloomModule)
