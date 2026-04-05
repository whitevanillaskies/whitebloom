import { BrowserWindow, ipcMain } from 'electron'
import { normalizeAppSettings, type AppSettings } from '../../shared/app-settings'
import { readAppSettings, writeAppSettings } from '../services/app-settings-store'
import { openResource } from '../services/file-resource'
import type { MainProcessContext } from '../state/main-process-context'

export function registerAppIpc(context: MainProcessContext): void {
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('app-settings:get', async () => {
    return await readAppSettings()
  })

  ipcMain.handle('file:open', (_event, resource: string) => {
    return openResource(resource, context)
  })

  ipcMain.handle('app-settings:save', async (_event, settings: AppSettings) => {
    try {
      const savedSettings = await writeAppSettings(settings)
      return { ok: true, settings: savedSettings }
    } catch {
      return { ok: false, settings: normalizeAppSettings(settings) }
    }
  })

  ipcMain.on('app:confirm-close', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) win.destroy()
  })
}
