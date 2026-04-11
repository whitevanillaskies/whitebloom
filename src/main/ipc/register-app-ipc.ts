import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir, stat } from 'fs/promises'
import { normalizeAppSettings, type AppSettings } from '../../shared/app-settings'
import { changeMainLanguage, t } from '../i18n'
import { readAppSettings, writeAppSettings } from '../services/app-settings-store'
import { readGardenState, writeGardenState } from '../services/garden-store'
import { listTransientBoards } from '../services/app-storage'
import { listRecentBoards, type RecentBoardItem } from '../services/recent-boards-store'
import { openResource } from '../services/file-resource'
import { getProjectFinderShell, listProjectFinderDirectory } from '../services/project-finder'
import { resolveResource } from '../resource-uri'
import {
  emptyArrangementsTrash,
  enumerateWorkspaceMaterial,
  findBoardsReferencingMaterial,
  registerLinkedMaterials
} from '../services/workspace-material'
import { updateWorkspaceConfig } from '../services/workspace-files'
import { probeNetwork } from '../services/network-probe'
import { fetchPageTitle } from '../services/page-title-fetcher'
import type { MainProcessContext } from '../state/main-process-context'
import type { GardenState } from '../../shared/arrangements'
import type { ArrangementsMaterial } from '../../shared/arrangements'

type ListTransientBoardsResult = {
  ok: boolean
  boardPaths: string[]
}

type ListRecentBoardsResult = {
  ok: boolean
  boards: RecentBoardItem[]
}

type ArrangementsReadResult = {
  ok: boolean
  state: GardenState | null
}

type ArrangementsWriteResult = {
  ok: boolean
  state: GardenState | null
}

type ArrangementsEnumerateResult = {
  ok: boolean
  materials: ArrangementsMaterial[]
}

type ArrangementsReferencesResult = {
  ok: boolean
  boardPaths: string[]
}

type ArrangementsRegisterLinkedMaterialsResult = {
  ok: boolean
}

export function registerAppIpc(context: MainProcessContext): void {
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('app-settings:get', async () => {
    return await readAppSettings()
  })

  ipcMain.handle(
    'arrangements:read',
    async (_event, workspaceRoot: string): Promise<ArrangementsReadResult> => {
      try {
        return { ok: true, state: await readGardenState(workspaceRoot) }
      } catch {
        return { ok: false, state: null }
      }
    }
  )

  ipcMain.handle(
    'arrangements:write',
    async (_event, workspaceRoot: string, state: GardenState): Promise<ArrangementsWriteResult> => {
      try {
        return { ok: true, state: await writeGardenState(workspaceRoot, state) }
      } catch {
        return { ok: false, state: null }
      }
    }
  )

  ipcMain.handle(
    'arrangements:enumerate-material',
    async (_event, workspaceRoot: string): Promise<ArrangementsEnumerateResult> => {
      try {
        return { ok: true, materials: await enumerateWorkspaceMaterial(workspaceRoot) }
      } catch {
        return { ok: false, materials: [] }
      }
    }
  )

  ipcMain.handle(
    'arrangements:trash-empty',
    async (_event, workspaceRoot: string, materialKeys: string[]): Promise<{ ok: boolean }> => {
      try {
        await emptyArrangementsTrash(workspaceRoot, materialKeys)
        return { ok: true }
      } catch {
        return { ok: false }
      }
    }
  )

  ipcMain.handle(
    'arrangements:referenced-by',
    async (
      _event,
      workspaceRoot: string,
      materialKey: string
    ): Promise<ArrangementsReferencesResult> => {
      try {
        return {
          ok: true,
          boardPaths: await findBoardsReferencingMaterial(workspaceRoot, materialKey)
        }
      } catch {
        return { ok: false, boardPaths: [] }
      }
    }
  )

  ipcMain.handle(
    'arrangements:register-linked-materials',
    async (
      _event,
      workspaceRoot: string,
      materials: Array<{ key: string; displayName?: string }>
    ): Promise<ArrangementsRegisterLinkedMaterialsResult> => {
      try {
        await registerLinkedMaterials(workspaceRoot, materials)
        return { ok: true }
      } catch {
        return { ok: false }
      }
    }
  )

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

  ipcMain.handle('project-finder:get-shell', async (_event, preferredPath?: string | null) => {
    try {
      return {
        ok: true,
        shell: await getProjectFinderShell(preferredPath ?? context.getActiveWorkspaceRoot())
      }
    } catch {
      return { ok: false, shell: null }
    }
  })

  ipcMain.handle('project-finder:list-directory', async (_event, directoryPath: string) => {
    try {
      return {
        ok: true,
        listing: await listProjectFinderDirectory(directoryPath)
      }
    } catch {
      return {
        ok: false,
        listing: null
      }
    }
  })

  ipcMain.handle(
    'project-finder:create-folder',
    async (
      _event,
      parentPath: string,
      folderName: string
    ): Promise<{ ok: boolean; path: string | null }> => {
      if (!parentPath || !folderName.trim()) return { ok: false, path: null }
      const { join } = await import('path')
      const newPath = join(parentPath, folderName.trim())
      try {
        await mkdir(newPath, { recursive: true })
        return { ok: true, path: newPath }
      } catch {
        return { ok: false, path: null }
      }
    }
  )

  ipcMain.handle('network:probe', async () => {
    return await probeNetwork()
  })

  ipcMain.handle('page:fetch-title', async (_event, url: string) => {
    return await fetchPageTitle(url)
  })

  ipcMain.handle('app:set-language', async (_event, lang: string) => {
    await changeMainLanguage(lang)
  })

  ipcMain.on('app:confirm-close', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) win.destroy()
  })
}
