import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
  entries: ProjectFinderDirectoryEntry[]
}

const api = {
  openWorkspaceDialog: (): Promise<WorkspaceOpenDialogResult> =>
    ipcRenderer.invoke('workspace:open-dialog'),
  createWorkspaceDialog: (): Promise<WorkspaceCreateDialogResult> =>
    ipcRenderer.invoke('workspace:create-dialog'),
  createWorkspaceAtPath: (workspaceRoot: string): Promise<WorkspaceCreateAtPathResult> =>
    ipcRenderer.invoke('workspace:create-at-path', workspaceRoot),
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
  showLinkFileDialog: (): Promise<FileLinkDialogResult> => ipcRenderer.invoke('file:link-dialog'),
  showImportFileDialog: (): Promise<FileImportDialogResult> =>
    ipcRenderer.invoke('file:import-dialog'),
  copyWorkspaceResource: (
    workspaceRoot: string,
    srcPath: string
  ): Promise<WorkspaceCopyToResResult> =>
    ipcRenderer.invoke('workspace:copy-to-res', workspaceRoot, srcPath),
  createQuickboard: (): Promise<QuickboardCreateResult> => ipcRenderer.invoke('quickboard:create'),
  listTransientBoards: (): Promise<ListTransientBoardsResult> =>
    ipcRenderer.invoke('app:list-transient-boards'),
  listRecentBoards: (): Promise<ListRecentBoardsResult> =>
    ipcRenderer.invoke('app:list-recent-boards'),
  getProjectFinderShell: (
    preferredPath?: string | null
  ): Promise<{ ok: boolean; shell: ProjectFinderShell | null }> =>
    ipcRenderer.invoke('project-finder:get-shell', preferredPath),
  listProjectFinderDirectory: (
    directoryPath: string
  ): Promise<{ ok: boolean; listing: ProjectFinderDirectoryListing | null }> =>
    ipcRenderer.invoke('project-finder:list-directory', directoryPath),
  createProjectFinderFolder: (
    parentPath: string,
    folderName: string
  ): Promise<{ ok: boolean; path: string | null }> =>
    ipcRenderer.invoke('project-finder:create-folder', parentPath, folderName),
  readArrangements: (workspaceRoot: string): Promise<ArrangementsReadResult> =>
    ipcRenderer.invoke('arrangements:read', workspaceRoot),
  saveArrangements: (workspaceRoot: string, state: GardenState): Promise<ArrangementsWriteResult> =>
    ipcRenderer.invoke('arrangements:write', workspaceRoot, state),
  enumerateArrangementsMaterial: (workspaceRoot: string): Promise<ArrangementsEnumerateResult> =>
    ipcRenderer.invoke('arrangements:enumerate-material', workspaceRoot),
  emptyArrangementsTrash: (
    workspaceRoot: string,
    materialKeys: string[]
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('arrangements:trash-empty', workspaceRoot, materialKeys),
  getArrangementsReferences: (
    workspaceRoot: string,
    materialKey: string
  ): Promise<ArrangementsReferencesResult> =>
    ipcRenderer.invoke('arrangements:referenced-by', workspaceRoot, materialKey),
  getArrangementsReferenceIndex: (
    workspaceRoot: string,
    materialKeys?: string[]
  ): Promise<ArrangementsReferenceIndexResult> =>
    ipcRenderer.invoke('arrangements:reference-index', workspaceRoot, materialKeys),
  registerArrangementsLinkedMaterials: (
    workspaceRoot: string,
    materials: Array<{ key: string; displayName?: string }>
  ): Promise<ArrangementsRegisterLinkedMaterialsResult> =>
    ipcRenderer.invoke('arrangements:register-linked-materials', workspaceRoot, materials),
  readBlossom: (workspaceRoot: string, resource: string): Promise<string> =>
    ipcRenderer.invoke('blossom:read', workspaceRoot, resource),
  writeBlossom: (workspaceRoot: string, resource: string, data: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('blossom:write', workspaceRoot, resource, data),
  openFile: (filePath: string): Promise<void> => ipcRenderer.invoke('file:open', filePath),
  getFileIcon: (
    workspaceRoot: string,
    resource: string
  ): Promise<{ ok: boolean; dataUrl: string | null }> =>
    ipcRenderer.invoke('file:get-icon', workspaceRoot, resource),
  checkProtocol: (scheme: string): Promise<boolean> => ipcRenderer.invoke('protocol:check', scheme),
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('url:open', url),
  isDirectory: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('path:is-directory', filePath),
  confirmLargeImport: (fileName: string, sizeMb: number): Promise<boolean> =>
    ipcRenderer.invoke('file:confirm-large-import', fileName, sizeMb),
  askImportOrLink: (fileName: string): Promise<'import' | 'link'> =>
    ipcRenderer.invoke('file:ask-import-or-link', fileName),
  updateWorkspaceConfig: (
    workspaceRoot: string,
    patch: { name?: string; brief?: string }
  ): Promise<{ ok: boolean; config: { version: number; name?: string; brief?: string } | null }> =>
    ipcRenderer.invoke('workspace:update-config', workspaceRoot, patch),
  loadAppSettings: (): Promise<AppSettings> => ipcRenderer.invoke('app-settings:get'),
  saveAppSettings: (settings: AppSettings): Promise<{ ok: boolean; settings: AppSettings }> =>
    ipcRenderer.invoke('app-settings:save', settings),
  onCloseRequested: (cb: () => void): (() => void) => {
    const listener = () => cb()
    ipcRenderer.on('app:close-requested', listener)
    return () => ipcRenderer.off('app:close-requested', listener)
  },
  confirmClose: (): void => ipcRenderer.send('app:confirm-close'),
  saveThumbnail: (
    boardPath: string,
    workspaceRoot: string,
    dataUrl: string
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('thumbnail:save', boardPath, workspaceRoot, dataUrl),
  getThumbnailUri: (
    boardPath: string,
    workspaceRoot: string
  ): Promise<{ ok: boolean; uri: string | null }> =>
    ipcRenderer.invoke('thumbnail:get-uri', boardPath, workspaceRoot),
  discardThumbnail: (boardPath: string, workspaceRoot: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('thumbnail:discard', boardPath, workspaceRoot),
  setLanguage: (lang: string): Promise<void> => ipcRenderer.invoke('app:set-language', lang),
  probeNetwork: (): Promise<{ reachable: boolean }> => ipcRenderer.invoke('network:probe'),
  fetchPageTitle: (url: string): Promise<{ ok: boolean; title: string | null }> =>
    ipcRenderer.invoke('page:fetch-title', url),
  readInkAcetate: (
    workspaceRoot: string,
    binding: InkSurfaceBinding
  ): Promise<{ ok: boolean; acetate: InkAcetate | null }> =>
    ipcRenderer.invoke('ink:read', workspaceRoot, binding),
  appendInkStroke: (
    workspaceRoot: string,
    binding: InkSurfaceBinding,
    stroke: InkStroke
  ): Promise<{ ok: boolean; acetate: InkAcetate | null }> =>
    ipcRenderer.invoke('ink:append-stroke', workspaceRoot, binding, stroke)
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
