import { dialog, ipcMain } from 'electron'
import { basename, dirname } from 'path'
import type { MainProcessContext } from '../state/main-process-context'
import {
  createTransientQuickboard,
  promoteTransientBoard,
  trashBoard
} from '../services/app-storage'
import {
  createBoard,
  copyWorkspaceResource,
  createWorkspace,
  findWorkspaceRootForBoard,
  readBoard,
  readWorkspace,
  writeBoard
} from '../services/workspace-files'

type WorkspaceOpenDialogResult = {
  ok: boolean
  workspaceRoot?: string
  openBoardPath?: string
}

type WorkspaceCreateDialogResult = {
  ok: boolean
  workspaceRoot?: string
}

type BoardSaveResult = {
  ok: boolean
  boardPath?: string
}

type BoardCreateResult = {
  ok: boolean
  boardPath?: string
}

type QuickboardCreateResult = {
  ok: boolean
  boardPath?: string
}

type BoardSaveDialogResult = {
  ok: boolean
  boardPath?: string
}

type BoardPromoteResult = {
  ok: boolean
  boardPath?: string
}

type BoardTrashResult = {
  ok: boolean
  trashPath?: string
}

type WorkspaceCopyToResResult = {
  ok: boolean
  resource?: string
}

function suggestBoardFileName(defaultName?: string): string {
  const normalized = (defaultName ?? 'board')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/g, '')
    .trim()

  const stem = normalized.length > 0 ? normalized : 'board'
  return stem.toLowerCase().endsWith('.wb.json') ? stem : `${stem}.wb.json`
}

export function registerBoardIpc(context: MainProcessContext): void {
  ipcMain.handle('workspace:open-dialog', async (): Promise<WorkspaceOpenDialogResult> => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Open workspace or board',
      filters: [
        { name: 'Whitebloom workspace', extensions: ['wbconfig'] },
        { name: 'Whitebloom board', extensions: ['wb.json'] }
      ],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return { ok: false }

    const selectedPath = filePaths[0]
    const selectedName = basename(selectedPath).toLowerCase()

    if (selectedName === '.wbconfig') {
      const workspaceRoot = dirname(selectedPath)
      context.setActiveWorkspaceRoot(workspaceRoot)
      return { ok: true, workspaceRoot }
    }

    if (selectedName.endsWith('.wb.json')) {
      const workspaceRoot = await findWorkspaceRootForBoard(selectedPath)
      context.setActiveWorkspaceRoot(workspaceRoot)

      return workspaceRoot
        ? { ok: true, workspaceRoot, openBoardPath: selectedPath }
        : { ok: true, openBoardPath: selectedPath }
    }

    return { ok: false }
  })

  ipcMain.handle('workspace:create-dialog', async (): Promise<WorkspaceCreateDialogResult> => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Create workspace',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return { ok: false }

    try {
      const workspaceRoot = filePaths[0]
      await createWorkspace(workspaceRoot)
      context.setActiveWorkspaceRoot(workspaceRoot)
      return { ok: true, workspaceRoot }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('workspace:read', async (_event, workspaceRoot: string) => {
    const workspace = await readWorkspace(workspaceRoot)
    context.setActiveWorkspaceRoot(workspace.rootPath)
    return workspace
  })

  ipcMain.handle('board:open', async (_event, boardPath: string) => {
    const json = await readBoard(boardPath)
    context.setActiveWorkspaceRoot(await findWorkspaceRootForBoard(boardPath))
    return json
  })

  ipcMain.handle(
    'board:save',
    async (_event, boardPath: string, json: string): Promise<BoardSaveResult> => {
      if (!boardPath) return { ok: false }

      try {
        await writeBoard(boardPath, json)
        context.setActiveWorkspaceRoot(await findWorkspaceRootForBoard(boardPath))
        return { ok: true, boardPath }
      } catch {
        return { ok: false }
      }
    }
  )

  ipcMain.handle(
    'board:save-dialog',
    async (_event, defaultName?: string): Promise<BoardSaveDialogResult> => {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save board',
        defaultPath: suggestBoardFileName(defaultName),
        filters: [{ name: 'Whitebloom board', extensions: ['wb.json'] }]
      })

      if (canceled || !filePath) return { ok: false }
      return { ok: true, boardPath: filePath }
    }
  )

  ipcMain.handle(
    'board:promote',
    async (
      _event,
      transientPath: string,
      targetPath: string,
      json: string
    ): Promise<BoardPromoteResult> => {
      if (!transientPath || !targetPath) return { ok: false }

      try {
        await promoteTransientBoard(transientPath, targetPath, json)
        context.setActiveWorkspaceRoot(await findWorkspaceRootForBoard(targetPath))
        return { ok: true, boardPath: targetPath }
      } catch {
        return { ok: false }
      }
    }
  )

  ipcMain.handle('board:trash', async (_event, boardPath: string): Promise<BoardTrashResult> => {
    if (!boardPath) return { ok: false }

    try {
      const trashPath = await trashBoard(boardPath)
      context.setActiveWorkspaceRoot(await findWorkspaceRootForBoard(boardPath))
      return { ok: true, trashPath }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle(
    'board:create',
    async (_event, workspaceRoot: string, name: string): Promise<BoardCreateResult> => {
      if (!workspaceRoot) return { ok: false }

      try {
        const boardPath = await createBoard(workspaceRoot, name)
        context.setActiveWorkspaceRoot(workspaceRoot)
        return { ok: true, boardPath }
      } catch {
        return { ok: false }
      }
    }
  )

  ipcMain.handle(
    'workspace:copy-to-res',
    async (_event, workspaceRoot: string, srcPath: string): Promise<WorkspaceCopyToResResult> => {
      if (!workspaceRoot || !srcPath) return { ok: false }

      try {
        const resource = await copyWorkspaceResource(workspaceRoot, srcPath)
        context.setActiveWorkspaceRoot(workspaceRoot)
        return { ok: true, resource }
      } catch {
        return { ok: false }
      }
    }
  )

  ipcMain.handle('quickboard:create', async (): Promise<QuickboardCreateResult> => {
    try {
      const boardPath = await createTransientQuickboard()
      context.setActiveWorkspaceRoot(null)
      return { ok: true, boardPath }
    } catch {
      return { ok: false }
    }
  })
}
