export function absolutePathToFileUri(filePath: string): string {
  const normalizedPath = filePath.trim().replace(/\\/g, '/')

  if (/^[a-zA-Z]:\//.test(normalizedPath)) {
    return `file:///${encodeURI(normalizedPath)}`
  }

  if (normalizedPath.startsWith('/')) {
    return `file://${encodeURI(normalizedPath)}`
  }

  throw new Error(`Expected an absolute filesystem path, received: ${filePath}`)
}

export function resourceToImageSrc(resource: string): string {
  const trimmed = resource.trim()

  if (trimmed.startsWith('wloc:') || trimmed.startsWith('wbapp:')) {
    return trimmed
  }

  if (trimmed.startsWith('file:///')) {
    return `wloc://local?resource=${encodeURIComponent(trimmed)}`
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed
  }

  throw new Error(`Unsupported image resource URI: ${resource}`)
}
