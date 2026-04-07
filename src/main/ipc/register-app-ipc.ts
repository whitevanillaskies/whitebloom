import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { stat } from 'fs/promises'
import { normalizeAppSettings, type AppSettings } from '../../shared/app-settings'
import { t } from '../i18n'
import { readAppSettings, writeAppSettings } from '../services/app-settings-store'
import { listTransientBoards } from '../services/app-storage'
import { listRecentBoards, type RecentBoardItem } from '../services/recent-boards-store'
import { openResource } from '../services/file-resource'
import { resolveResource } from '../resource-uri'
import { updateWorkspaceConfig } from '../services/workspace-files'
import type { MainProcessContext } from '../state/main-process-context'

type ListTransientBoardsResult = {
  ok: boolean
  boardPaths: string[]
}

type ListRecentBoardsResult = {
  ok: boolean
  boards: RecentBoardItem[]
}

export function registerAppIpc(context: MainProcessContext): void {
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('app-settings:get', async () => {
    return await readAppSettings()
  })

  ipcMain.handle('file:open', (_event, resource: string) => {
    return openResource(resource, context)
  })

  ipcMain.handle(
    'workspace:update-config',
    async (_event, workspaceRoot: string, patch: { name?: string; brief?: string }) => {
      try {
        const updated = await updateWorkspaceConfig(workspaceRoot, patch)
        return { ok: true, config: updated }
      } catch {
        return { ok: false, config: null }
      }
    }
  )

  ipcMain.handle('file:confirm-large-import', async (_event, fileName: string, sizeMb: number) => {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: [t('dialogs.importAnywayButton'), t('dialogs.cancelButton')],
      defaultId: 1,
      cancelId: 1,
      title: t('dialogs.largeFileTitle'),
      message: t('dialogs.largeFileMessage', { fileName, sizeMb }),
      detail: t('dialogs.largeFileDetail')
    })
    return response === 0
  })

  ipcMain.handle('file:ask-import-or-link', async (_event, fileName: string) => {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: [t('dialogs.importButton'), t('dialogs.linkButton')],
      defaultId: 1,
      cancelId: 1,
      title: t('dialogs.importOrLinkTitle'),
      message: t('dialogs.importOrLinkMessage', { fileName }),
      detail: t('dialogs.importOrLinkDetail')
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

  ipcMain.handle('protocol:check', (_event, scheme: string) => {
    return app.getApplicationNameForProtocol(scheme) !== ''
  })

  ipcMain.handle('url:open', (_event, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle('path:is-directory', async (_event, filePath: string) => {
    try {
      return (await stat(filePath)).isDirectory()
    } catch {
      return false
    }
  })

  ipcMain.handle('app:list-transient-boards', async (): Promise<ListTransientBoardsResult> => {
    try {
      return { ok: true, boardPaths: await listTransientBoards() }
    } catch {
      return { ok: false, boardPaths: [] }
    }
  })

  ipcMain.handle('app:list-recent-boards', async (): Promise<ListRecentBoardsResult> => {
    try {
      return { ok: true, boards: await listRecentBoards() }
    } catch {
      return { ok: false, boards: [] }
    }
  })

  ipcMain.on('app:confirm-close', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) win.destroy()
  })
}
