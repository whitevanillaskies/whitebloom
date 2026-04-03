import { create } from 'zustand'
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  normalizeUsername,
  type AppSettings
} from '../../../shared/app-settings'
import { useBoardStore } from './board'

type AppSettingsState = AppSettings & {
  isHydrated: boolean
  loadAppSettings: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  ...DEFAULT_APP_SETTINGS,
  isHydrated: false,

  loadAppSettings: async () => {
    const settings = normalizeAppSettings(await window.api.loadAppSettings())
    set({ ...settings, isHydrated: true })
    useBoardStore.getState().setActiveUsername(settings.user.username)
  },

  updateUsername: async (username) => {
    const nextSettings = {
      user: {
        username: normalizeUsername(username)
      }
    }

    set(nextSettings)
    useBoardStore.getState().setActiveUsername(nextSettings.user.username)

    const result = await window.api.saveAppSettings(nextSettings)
    set({ ...normalizeAppSettings(result.settings) })

    if (!result.ok) {
      console.error('Failed to persist app settings')
    }
  }
}))
