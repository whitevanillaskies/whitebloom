import type { ModuleClipboardHandler, ModulePasteContext } from '../types'

const IMAGE_CLIPBOARD_MAX_VIEWPORT_FRACTION = 0.4
const IMAGE_MODULE_ID = 'com.whitebloom.image'

function createClipboardImageName(extension = 'png'): string {
  const now = new Date()
  const stamp = [
    now.getFullYear().toString().padStart(4, '0'),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0')
  ].join('-')
  const time = [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0')
  ].join('-')
  return `clipboard-image-${stamp}_${time}.${extension}`
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/svg+xml') return 'svg'
  if (mimeType === 'image/bmp') return 'bmp'
  if (mimeType === 'image/avif') return 'avif'
  return 'png'
}

function extensionFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+)/i.exec(dataUrl)
  return match ? extensionFromMimeType(match[1].toLowerCase()) : 'png'
}

function bytesFromDataUrl(dataUrl: string): Uint8Array | null {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return null
  const header = dataUrl.slice(0, commaIndex)
  if (!/;base64/i.test(header)) return null

  const binary = atob(dataUrl.slice(commaIndex + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function measureImageFromSrc(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const naturalWidth = image.naturalWidth
      const naturalHeight = image.naturalHeight
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        reject(new Error('Unable to read clipboard image dimensions.'))
        return
      }

      const viewportLongestSide = Math.max(window.innerWidth, window.innerHeight)
      const maxLongestSide = Math.max(
        80,
        viewportLongestSide * IMAGE_CLIPBOARD_MAX_VIEWPORT_FRACTION
      )
      const imageLongestSide = Math.max(naturalWidth, naturalHeight)
      const scale = imageLongestSide > maxLongestSide ? maxLongestSide / imageLongestSide : 1

      resolve({
        w: Math.max(1, Math.round(naturalWidth * scale)),
        h: Math.max(1, Math.round(naturalHeight * scale))
      })
    }
    image.onerror = () => reject(new Error('Unable to load clipboard image.'))
    image.decoding = 'async'
    image.src = src
  })
}

async function readImageFileFromPasteEvent(
  event: ClipboardEvent | undefined
): Promise<File | null> {
  const data = event?.clipboardData
  if (!data) return null

  for (const file of Array.from(data.files)) {
    if (file.type.toLowerCase().startsWith('image/')) return file
  }

  for (const item of Array.from(data.items)) {
    if (!item.type.toLowerCase().startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }

  return null
}

async function pasteBrowserImageFile(
  context: ModulePasteContext,
  file: File
): Promise<Awaited<ReturnType<ModuleClipboardHandler['paste']>>> {
  if (!context.workspaceRoot) return null

  const bytes = new Uint8Array(await file.arrayBuffer())
  const fileName =
    file.name.trim() || createClipboardImageName(extensionFromMimeType(file.type.toLowerCase()))
  const result = await window.api.writeWorkspaceResource(context.workspaceRoot, fileName, bytes)
  if (!result.ok || !result.resource) return null

  const objectUrl = URL.createObjectURL(file)
  try {
    return {
      placement: {
        resource: result.resource,
        moduleType: IMAGE_MODULE_ID,
        size: await measureImageFromSrc(objectUrl),
        label: file.name.trim() || undefined
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function pasteNativeClipboardImage(
  context: ModulePasteContext
): Promise<Awaited<ReturnType<ModuleClipboardHandler['paste']>>> {
  if (!context.workspaceRoot) return null

  const image = await window.api.readClipboardImage()
  if (!image.ok || !image.dataUrl) return null

  const bytes = bytesFromDataUrl(image.dataUrl)
  if (!bytes) return null

  const resourceResult = await window.api.writeWorkspaceResource(
    context.workspaceRoot,
    createClipboardImageName(extensionFromDataUrl(image.dataUrl)),
    bytes
  )
  if (!resourceResult.ok || !resourceResult.resource) return null

  return {
    placement: {
      resource: resourceResult.resource,
      moduleType: IMAGE_MODULE_ID,
      size: await measureImageFromSrc(image.dataUrl)
    }
  }
}

export const imageClipboardHandler: ModuleClipboardHandler = {
  async paste(context) {
    const eventImageFile = await readImageFileFromPasteEvent(context.event)
    if (eventImageFile) return pasteBrowserImageFile(context, eventImageFile)

    return pasteNativeClipboardImage(context)
  }
}
