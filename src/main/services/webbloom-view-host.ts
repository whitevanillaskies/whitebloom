import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  type Rectangle,
  type Session
} from 'electron'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import fetch from 'cross-fetch'

type WebBloomViewRecord = {
  ownerId: number
  view: WebContentsView
  url: string
}

type WebBloomBoundsInput = Rectangle & {
  visible: boolean
}

const WEBBLOOM_PARTITION = 'persist:whitebloom-webbloom'
const views = new Map<string, WebBloomViewRecord>()

let initialized = false
let blockerReady: Promise<void> | null = null

function normalizeWebBloomUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.protocol === 'http:' && !isLocalHttpHost(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

function isLocalHttpHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function getWebBloomSession(): Session {
  return session.fromPartition(WEBBLOOM_PARTITION)
}

function clampBounds(bounds: WebBloomBoundsInput): Rectangle {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height))
  }
}

function ensureWebBloomSecurity(sessionToHarden: Session): void {
  sessionToHarden.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  sessionToHarden.setPermissionCheckHandler(() => false)

  sessionToHarden.on('will-download', (event) => {
    event.preventDefault()
  })
}

function ensureAdblock(sessionToBlock: Session): Promise<void> {
  blockerReady ??= ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInSession(sessionToBlock)
  })
  return blockerReady
}

function createWebBloomView(url: string): WebContentsView {
  const webBloomSession = getWebBloomSession()
  const view = new WebContentsView({
    webPreferences: {
      session: webBloomSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      javascript: true
    }
  })

  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  view.webContents.on('will-navigate', (event, nextUrl) => {
    if (normalizeWebBloomUrl(nextUrl) === null) {
      event.preventDefault()
    }
  })
  view.webContents.on('will-redirect', (event, nextUrl) => {
    if (normalizeWebBloomUrl(nextUrl) === null) {
      event.preventDefault()
    }
  })

  void view.webContents.loadURL(url)
  return view
}

function removeView(id: string): void {
  const record = views.get(id)
  if (!record) return

  const owner = BrowserWindow.fromId(record.ownerId)
  owner?.contentView.removeChildView(record.view)
  record.view.webContents.close()
  views.delete(id)
}

export function initializeWebBloomViewHost(): void {
  if (initialized) return
  initialized = true

  const webBloomSession = getWebBloomSession()
  ensureWebBloomSecurity(webBloomSession)
  void ensureAdblock(webBloomSession).catch((error) => {
    console.warn('[webbloom] adblock initialization failed', error)
  })

  ipcMain.handle('webbloom:create', async (event, input: { id: string; url: string }) => {
    const id = typeof input?.id === 'string' ? input.id.trim() : ''
    const url = typeof input?.url === 'string' ? normalizeWebBloomUrl(input.url) : null
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!id || !url || !owner) return { ok: false }

    await ensureAdblock(webBloomSession)

    removeView(id)
    const view = createWebBloomView(url)
    views.set(id, {
      ownerId: owner.id,
      view,
      url
    })
    owner.contentView.addChildView(view)
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    return { ok: true }
  })

  ipcMain.handle('webbloom:set-bounds', (event, id: string, bounds: WebBloomBoundsInput) => {
    const record = typeof id === 'string' ? views.get(id) : undefined
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!record || !owner || record.ownerId !== owner.id) return { ok: false }

    const nextBounds = bounds?.visible ? clampBounds(bounds) : { x: 0, y: 0, width: 0, height: 0 }
    record.view.setBounds(nextBounds)
    return { ok: true }
  })

  ipcMain.handle('webbloom:destroy', (_event, id: string) => {
    if (typeof id !== 'string') return { ok: false }
    removeView(id)
    return { ok: true }
  })

  ipcMain.handle('webbloom:focus', (event, id: string) => {
    const record = typeof id === 'string' ? views.get(id) : undefined
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!record || !owner || record.ownerId !== owner.id) return { ok: false }
    record.view.webContents.focus()
    return { ok: true }
  })
}
