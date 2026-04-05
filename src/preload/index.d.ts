import { ElectronAPI } from '@electron-toolkit/preload'
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

type QuickboardCreateDialogResult = {
  ok: boolean
  boardPath?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openWorkspaceDialog: () => Promise<WorkspaceOpenDialogResult>
      createWorkspaceDialog: () => Promise<WorkspaceCreateDialogResult>
      readWorkspace: (workspaceRoot: string) => Promise<Workspace>
      openBoard: (boardPath: string) => Promise<string>
      saveBoard: (boardPath: string, json: string) => Promise<BoardSaveResult>
      createBoard: (workspaceRoot: string, name: string) => Promise<BoardCreateResult>
      createQuickboardDialog: () => Promise<QuickboardCreateDialogResult>
      openFile: (filePath: string) => Promise<void>
      loadAppSettings: () => Promise<AppSettings>
      saveAppSettings: (settings: AppSettings) => Promise<{ ok: boolean; settings: AppSettings }>
      onCloseRequested: (cb: () => void) => () => void
      confirmClose: () => void
    }
  }
}
