import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { dirname, join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { normalizeAppSettings, type AppSettings } from '../shared/app-settings'

function getAppSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

async function readAppSettings(): Promise<AppSettings> {
  try {
    const json = await readFile(getAppSettingsPath(), 'utf-8')
    return normalizeAppSettings(JSON.parse(json))
  } catch {
    return normalizeAppSettings(undefined)
  }
}

async function writeAppSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeAppSettings(settings)
  const filePath = getAppSettingsPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('board:save-as', async (_event, json: string, currentFilePath?: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save board',
      defaultPath: currentFilePath ?? 'board.wb.json',
      filters: [{ name: 'Whitebloom board', extensions: ['wb.json'] }]
    })
    if (canceled || !filePath) return { ok: false }

    try {
      await writeFile(filePath, json, 'utf-8')
      return { ok: true, filePath }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('board:save-to-path', async (_event, filePath: string, json: string) => {
    if (!filePath) return { ok: false }

    try {
      await writeFile(filePath, json, 'utf-8')
      return { ok: true, filePath }
    } catch {
      return { ok: false }
    }
  })

  // Backwards-compatible alias for save-as.
  ipcMain.handle('board:save', async (_event, json: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save board',
      defaultPath: 'board.wb.json',
      filters: [{ name: 'Whitebloom board', extensions: ['wb.json'] }]
    })
    if (canceled || !filePath) return { ok: false }

    try {
      await writeFile(filePath, json, 'utf-8')
      return { ok: true, filePath }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('board:load', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Open board',
      filters: [{ name: 'Whitebloom board', extensions: ['wb.json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return { ok: false }

    try {
      const filePath = filePaths[0]
      const json = await readFile(filePath, 'utf-8')
      return { ok: true, json, filePath }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('app-settings:get', async () => {
    return await readAppSettings()
  })

  ipcMain.handle('app-settings:save', async (_event, settings: AppSettings) => {
    try {
      const savedSettings = await writeAppSettings(settings)
      return { ok: true, settings: savedSettings }
    } catch {
      return { ok: false, settings: normalizeAppSettings(settings) }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
