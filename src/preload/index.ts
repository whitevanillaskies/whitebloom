import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../shared/app-settings'

const api = {
  saveBoardAs: (
    json: string,
    currentFilePath?: string
  ): Promise<{ ok: boolean; filePath?: string }> =>
    ipcRenderer.invoke('board:save-as', json, currentFilePath),
  saveBoardToPath: (filePath: string, json: string): Promise<{ ok: boolean; filePath?: string }> =>
    ipcRenderer.invoke('board:save-to-path', filePath, json),
  loadBoard: (): Promise<{ ok: boolean; json?: string; filePath?: string }> =>
    ipcRenderer.invoke('board:load'),
  openFile: (filePath: string): Promise<void> => ipcRenderer.invoke('file:open', filePath),
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
