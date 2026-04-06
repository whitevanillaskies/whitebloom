import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { normalizeAppSettings, type AppSettings } from '../../shared/app-settings'
import { readAppSettings, writeAppSettings } from '../services/app-settings-store'
import { listTransientBoards } from '../services/app-storage'
import { openResource } from '../services/file-resource'
import { resolveResource } from '../resource-uri'
import { updateWorkspaceConfig } from '../services/workspace-files'
import type { MainProcessContext } from '../state/main-process-context'

type ListTransientBoardsResult = {
  ok: boolean
  boardPaths: string[]
}

export function registerAppIpc(context: MainProcessContext): void {
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('app-settings:get', async () => {
    return await readAppSettings()
  })

  ipcMain.handle('file:open', (_event, resource: string) => {
    return openResource(resource, context)
  })

  ipcMain.handle('workspace:update-config', async (_event, workspaceRoot: string, patch: { name?: string; brief?: string }) => {
    try {
      const updated = await updateWorkspaceConfig(workspaceRoot, patch)
      return { ok: true, config: updated }
    } catch {
      return { ok: false, config: null }
    }
  })

  ipcMain.handle('file:confirm-large-import', async (_event, fileName: string, sizeMb: number) => {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Import anyway', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Large file',
      message: `"${fileName}" is ${sizeMb} MB`,
      detail: 'Importing will copy this file into your workspace. Consider linking it instead to avoid duplicating large files on disk.'
    })
    return response === 0
  })

  ipcMain.handle('file:ask-import-or-link', async (_event, fileName: string) => {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Import', 'Link'],
      defaultId: 1,
      cancelId: 1,
      title: 'Add file to workspace',
      message: `How do you want to add "${fileName}"?`,
      detail: 'Import copies the file into your workspace. Link keeps it at its current location — if the file moves, the node will break.'
    })
    return response === 0 ? 'import' : 'link'
  })

  ipcMain.handle('file:get-icon', async (_event, workspaceRoot: string, resource: string) => {
    try {
      const absolutePath = resolveResource(resource, workspaceRoot)
      const icon = await app.getFileIcon(absolutePath, { size: 'large' })
      return { ok: true, dataUrl: icon.toDataURL() }
    } catch {
      return { ok: false, dataUrl: null }
    }
  })

  ipcMain.handle('app-settings:save', async (_event, settings: AppSettings) => {
    try {
      const savedSettings = await writeAppSettings(settings)
      return { ok: true, settings: savedSettings }
    } catch {
      return { ok: false, settings: normalizeAppSettings(settings) }
    }
  })

  ipcMain.handle('app:list-transient-boards', async (): Promise<ListTransientBoardsResult> => {
    try {
      return { ok: true, boardPaths: await listTransientBoards() }
    } catch {
      return { ok: false, boardPaths: [] }
    }
  })

  ipcMain.on('app:confirm-close', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) win.destroy()
  })
}
