import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../shared/app-settings'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveBoardAs: (
        json: string,
        currentFilePath?: string
      ) => Promise<{ ok: boolean; filePath?: string }>
      saveBoardToPath: (
        filePath: string,
        json: string
      ) => Promise<{ ok: boolean; filePath?: string }>
      loadBoard: () => Promise<{ ok: boolean; json?: string; filePath?: string }>
      openFile: (filePath: string) => Promise<void>
      loadAppSettings: () => Promise<AppSettings>
      saveAppSettings: (settings: AppSettings) => Promise<{ ok: boolean; settings: AppSettings }>
      onCloseRequested: (cb: () => void) => () => void
      confirmClose: () => void
    }
  }
}
