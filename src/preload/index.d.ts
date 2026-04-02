import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      saveBoard: (json: string) => Promise<{ ok: boolean; filePath?: string }>
      loadBoard: () => Promise<{ ok: boolean; json?: string }>
    }
  }
}
