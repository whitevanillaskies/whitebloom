import { ElectronAPI } from '@electron-toolkit/preload'

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
    }
  }
}
