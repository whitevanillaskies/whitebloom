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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openWorkspaceDialog: () => Promise<WorkspaceOpenDialogResult>
      createWorkspaceDialog: () => Promise<WorkspaceCreateDialogResult>
      readWorkspace: (workspaceRoot: string) => Promise<Workspace>
      openBoard: (boardPath: string) => Promise<string>
      saveBoard: (boardPath: string, json: string) => Promise<BoardSaveResult>
      showBoardSaveDialog: (defaultName?: string) => Promise<BoardSaveDialogResult>
      promoteBoard: (
        transientPath: string,
        targetPath: string,
        json: string
      ) => Promise<BoardPromoteResult>
      trashBoard: (boardPath: string) => Promise<BoardTrashResult>
      createBoard: (workspaceRoot: string, name: string) => Promise<BoardCreateResult>
      copyWorkspaceResource: (
        workspaceRoot: string,
        srcPath: string
      ) => Promise<WorkspaceCopyToResResult>
      createQuickboard: () => Promise<QuickboardCreateResult>
      listTransientBoards: () => Promise<ListTransientBoardsResult>
      readBlossom: (workspaceRoot: string, resource: string) => Promise<string>
      writeBlossom: (workspaceRoot: string, resource: string, data: string) => Promise<{ ok: boolean }>
      openFile: (filePath: string) => Promise<void>
      loadAppSettings: () => Promise<AppSettings>
      saveAppSettings: (settings: AppSettings) => Promise<{ ok: boolean; settings: AppSettings }>
      onCloseRequested: (cb: () => void) => () => void
      confirmClose: () => void
    }
  }
}
