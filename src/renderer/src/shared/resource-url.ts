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

export function resourceToImageSrc(resource: string, workspaceRoot?: string): string {
  const trimmed = resource.trim()

  if (trimmed.startsWith('wloc://') || trimmed.startsWith('wbapp://')) {
    return trimmed
  }

  // Standard schemes get normalized by Chromium (wloc:res/x → wloc://res/x),
  // which breaks the protocol handler. Wrap bare wloc:/wbapp: URIs in query-param
  // form so they arrive as a proper standard URL with a known authority.
  if (trimmed.startsWith('wloc:') || trimmed.startsWith('wbapp:')) {
    const scheme = trimmed.startsWith('wloc:') ? 'wloc' : 'wbapp'
    const params = new URLSearchParams({ resource: trimmed })
    if (workspaceRoot) params.set('workspaceRoot', workspaceRoot)
    return `${scheme}://local?${params.toString()}`
  }

  if (trimmed.startsWith('file:///')) {
    return `wloc://local?resource=${encodeURIComponent(trimmed)}`
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed
  }

  throw new Error(`Unsupported image resource URI: ${resource}`)
}
