import { app, BrowserWindow, desktopCapturer, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './create-window'
import { initializeMainI18n } from './i18n'
import { registerAppIpc } from './ipc/register-app-ipc'
import { registerBoardIpc } from './ipc/register-board-ipc'
import {
  registerResourceProtocols,
  registerResourceSchemes
} from './protocol/register-wloc-protocol'
import { ensureAppStorageDirectories } from './services/app-storage'
import { readAppSettings } from './services/app-settings-store'
import { createMainProcessContext } from './state/main-process-context'

registerResourceSchemes()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: {
          width: 0,
          height: 0
        },
        fetchWindowIcons: false
      })

      if (sources.length === 0) {
        callback({})
        return
      }

      callback({
        video: sources[0]
      })
    },
    {
      useSystemPicker: true
    }
  )

  const context = createMainProcessContext()
  await ensureAppStorageDirectories()
  const settings = await readAppSettings()
  await initializeMainI18n(settings.language)

  registerResourceProtocols(context)
  registerBoardIpc(context)
  registerAppIpc(context)
  createMainWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
