import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../shared/app-settings'
import type { ArrangementsMaterial, GardenState } from '../shared/arrangements'
import type { InkAcetate, InkSurfaceBinding, InkStroke } from '../shared/ink'

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

type WorkspaceCreateAtPathResult = {
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

type FileLinkDialogResult = {
  ok: boolean
  filePaths: string[]
}

type FileImportDialogResult = {
  ok: boolean
  filePaths: string[]
}

type BoardTrashResult = {
  ok: boolean
  trashPath?: string
}

type ListTransientBoardsResult = {
  ok: boolean
  boardPaths: string[]
}

type RecentBoardItem = {
  path: string
  openedAt: number
  workspaceRoot?: string
  thumbnailUri?: string
}

type ListRecentBoardsResult = {
  ok: boolean
  boards: RecentBoardItem[]
}

type WorkspaceCopyToResResult = {
  ok: boolean
  resource?: string
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

type ArrangementsReferenceIndexResult = {
  ok: boolean
  references: Record<string, string[]>
}

type ArrangementsRegisterLinkedMaterialsResult = {
  ok: boolean
}

type ProjectFinderSidebarLocation = {
  label: string
  path: string
  kind: 'drive' | 'location'
}

type ProjectFinderDirectoryEntry = {
  name: string
  path: string
  kind: 'directory' | 'workspace' | 'board' | 'quickboard'
  workspaceRoot?: string
}

type ProjectFinderShell = {
  defaultPath: string
  locations: ProjectFinderSidebarLocation[]
}

type ProjectFinderDirectoryListing = {
  path: string
  parentPath: string | null
  isWorkspaceRoot: boolean
  isInsideWorkspace: boolean
  entries: ProjectFinderDirectoryEntry[]
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openWorkspaceDialog: () => Promise<WorkspaceOpenDialogResult>
      createWorkspaceDialog: () => Promise<WorkspaceCreateDialogResult>
      createWorkspaceAtPath: (workspaceRoot: string) => Promise<WorkspaceCreateAtPathResult>
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
      showLinkFileDialog: () => Promise<FileLinkDialogResult>
      showImportFileDialog: () => Promise<FileImportDialogResult>
      copyWorkspaceResource: (
        workspaceRoot: string,
        srcPath: string
      ) => Promise<WorkspaceCopyToResResult>
      createQuickboard: () => Promise<QuickboardCreateResult>
      listTransientBoards: () => Promise<ListTransientBoardsResult>
      listRecentBoards: () => Promise<ListRecentBoardsResult>
      getProjectFinderShell: (
        preferredPath?: string | null
      ) => Promise<{ ok: boolean; shell: ProjectFinderShell | null }>
      listProjectFinderDirectory: (
        directoryPath: string
      ) => Promise<{ ok: boolean; listing: ProjectFinderDirectoryListing | null }>
      createProjectFinderFolder: (
        parentPath: string,
        folderName: string
      ) => Promise<{ ok: boolean; path: string | null }>
      readArrangements: (workspaceRoot: string) => Promise<ArrangementsReadResult>
      saveArrangements: (
        workspaceRoot: string,
        state: GardenState
      ) => Promise<ArrangementsWriteResult>
      enumerateArrangementsMaterial: (workspaceRoot: string) => Promise<ArrangementsEnumerateResult>
      emptyArrangementsTrash: (
        workspaceRoot: string,
        materialKeys: string[]
      ) => Promise<{ ok: boolean }>
      getArrangementsReferences: (
        workspaceRoot: string,
        materialKey: string
      ) => Promise<ArrangementsReferencesResult>
      getArrangementsReferenceIndex: (
        workspaceRoot: string,
        materialKeys?: string[]
      ) => Promise<ArrangementsReferenceIndexResult>
      registerArrangementsLinkedMaterials: (
        workspaceRoot: string,
        materials: Array<{ key: string; displayName?: string }>
      ) => Promise<ArrangementsRegisterLinkedMaterialsResult>
      readBlossom: (workspaceRoot: string, resource: string) => Promise<string>
      writeBlossom: (
        workspaceRoot: string,
        resource: string,
        data: string
      ) => Promise<{ ok: boolean }>
      openFile: (filePath: string) => Promise<void>
      getFileIcon: (
        workspaceRoot: string,
        resource: string
      ) => Promise<{ ok: boolean; dataUrl: string | null }>
      checkProtocol: (scheme: string) => Promise<boolean>
      openUrl: (url: string) => Promise<void>
      isDirectory: (filePath: string) => Promise<boolean>
      confirmLargeImport: (fileName: string, sizeMb: number) => Promise<boolean>
      askImportOrLink: (fileName: string) => Promise<'import' | 'link'>
      updateWorkspaceConfig: (
        workspaceRoot: string,
        patch: { name?: string; brief?: string }
      ) => Promise<{
        ok: boolean
        config: { version: number; name?: string; brief?: string } | null
      }>
      loadAppSettings: () => Promise<AppSettings>
      saveAppSettings: (settings: AppSettings) => Promise<{ ok: boolean; settings: AppSettings }>
      onCloseRequested: (cb: () => void) => () => void
      confirmClose: () => void
      saveThumbnail: (
        boardPath: string,
        workspaceRoot: string,
        dataUrl: string
      ) => Promise<{ ok: boolean }>
      getThumbnailUri: (
        boardPath: string,
        workspaceRoot: string
      ) => Promise<{ ok: boolean; uri: string | null }>
      discardThumbnail: (boardPath: string, workspaceRoot: string) => Promise<{ ok: boolean }>
      setLanguage: (lang: string) => Promise<void>
      probeNetwork: () => Promise<{ reachable: boolean }>
      fetchPageTitle: (url: string) => Promise<{ ok: boolean; title: string | null }>
      readInkAcetate: (
        workspaceRoot: string,
        binding: InkSurfaceBinding
      ) => Promise<{ ok: boolean; acetate: InkAcetate | null }>
      appendInkStroke: (
        workspaceRoot: string,
        binding: InkSurfaceBinding,
        stroke: InkStroke
      ) => Promise<{ ok: boolean; acetate: InkAcetate | null }>
      saveRecording: (
        workspaceRoot: string,
        requestedName: string | null,
        bytes: Uint8Array
      ) => Promise<{
        ok: boolean
        filePath: string | null
        fileName: string | null
        relativePath: string | null
      }>
    }
  }
}
