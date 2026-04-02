import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  saveBoardAs: (
    json: string,
    currentFilePath?: string
  ): Promise<{ ok: boolean; filePath?: string }> =>
    ipcRenderer.invoke('board:save-as', json, currentFilePath),
  saveBoardToPath: (filePath: string, json: string): Promise<{ ok: boolean; filePath?: string }> =>
    ipcRenderer.invoke('board:save-to-path', filePath, json),
  loadBoard: (): Promise<{ ok: boolean; json?: string; filePath?: string }> =>
    ipcRenderer.invoke('board:load')
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
