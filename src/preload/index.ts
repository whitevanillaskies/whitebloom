import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../shared/app-settings'

type WorkspaceConfig = {
  version: number
  name?: string
  brief?: string
}

type Workspace = {
  config: WorkspaceConfig
  rootPath: string
  boards: string[]
}

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

type ListTransientBoardsResult = {
  ok: boolean
  boardPaths: string[]
}

type WorkspaceCopyToResResult = {
  ok: boolean
  resource?: string
}

const api = {
  openWorkspaceDialog: (): Promise<WorkspaceOpenDialogResult> =>
    ipcRenderer.invoke('workspace:open-dialog'),
  createWorkspaceDialog: (): Promise<WorkspaceCreateDialogResult> =>
    ipcRenderer.invoke('workspace:create-dialog'),
  readWorkspace: (workspaceRoot: string): Promise<Workspace> =>
    ipcRenderer.invoke('workspace:read', workspaceRoot),
  openBoard: (boardPath: string): Promise<string> => ipcRenderer.invoke('board:open', boardPath),
  saveBoard: (boardPath: string, json: string): Promise<BoardSaveResult> =>
    ipcRenderer.invoke('board:save', boardPath, json),
  showBoardSaveDialog: (defaultName?: string): Promise<BoardSaveDialogResult> =>
    ipcRenderer.invoke('board:save-dialog', defaultName),
  promoteBoard: (
    transientPath: string,
    targetPath: string,
    json: string
  ): Promise<BoardPromoteResult> =>
    ipcRenderer.invoke('board:promote', transientPath, targetPath, json),
  trashBoard: (boardPath: string): Promise<BoardTrashResult> =>
    ipcRenderer.invoke('board:trash', boardPath),
  createBoard: (workspaceRoot: string, name: string): Promise<BoardCreateResult> =>
    ipcRenderer.invoke('board:create', workspaceRoot, name),
  copyWorkspaceResource: (
    workspaceRoot: string,
    srcPath: string
  ): Promise<WorkspaceCopyToResResult> =>
    ipcRenderer.invoke('workspace:copy-to-res', workspaceRoot, srcPath),
  createQuickboard: (): Promise<QuickboardCreateResult> => ipcRenderer.invoke('quickboard:create'),
  listTransientBoards: (): Promise<ListTransientBoardsResult> =>
    ipcRenderer.invoke('app:list-transient-boards'),
  readBlossom: (workspaceRoot: string, resource: string): Promise<string> =>
    ipcRenderer.invoke('blossom:read', workspaceRoot, resource),
  writeBlossom: (
    workspaceRoot: string,
    resource: string,
    data: string
  ): Promise<{ ok: boolean }> => ipcRenderer.invoke('blossom:write', workspaceRoot, resource, data),
  openFile: (filePath: string): Promise<void> => ipcRenderer.invoke('file:open', filePath),
  getFileIcon: (workspaceRoot: string, resource: string): Promise<{ ok: boolean; dataUrl: string | null }> =>
    ipcRenderer.invoke('file:get-icon', workspaceRoot, resource),
  loadAppSettings: (): Promise<AppSettings> => ipcRenderer.invoke('app-settings:get'),
  saveAppSettings: (settings: AppSettings): Promise<{ ok: boolean; settings: AppSettings }> =>
    ipcRenderer.invoke('app-settings:save', settings),
  onCloseRequested: (cb: () => void): (() => void) => {
    const listener = () => cb()
    ipcRenderer.on('app:close-requested', listener)
    return () => ipcRenderer.off('app:close-requested', listener)
  },
  confirmClose: (): void => ipcRenderer.send('app:confirm-close')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
