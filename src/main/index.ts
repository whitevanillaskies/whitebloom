import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './create-window'
import { registerAppIpc } from './ipc/register-app-ipc'
import { registerBoardIpc } from './ipc/register-board-ipc'
import { registerWlocProtocol, registerWlocScheme } from './protocol/register-wloc-protocol'
import { createMainProcessContext } from './state/main-process-context'

registerWlocScheme()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const context = createMainProcessContext()

  registerWlocProtocol(context)
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
