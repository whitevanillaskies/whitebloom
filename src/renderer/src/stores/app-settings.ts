import { create } from 'zustand'
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  normalizeUsername,
  type AppSettings,
  type UnhandledDropBehavior
} from '../../../shared/app-settings'
import { useBoardStore } from './board'

type AppSettingsState = AppSettings & {
  isHydrated: boolean
  loadAppSettings: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
  updateUnhandledDrop: (behavior: UnhandledDropBehavior) => Promise<void>
  updateWarnLargeImport: (warn: boolean) => Promise<void>
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...DEFAULT_APP_SETTINGS,
  isHydrated: false,

  loadAppSettings: async () => {
    const settings = normalizeAppSettings(await window.api.loadAppSettings())
    set({ ...settings, isHydrated: true })
    useBoardStore.getState().setActiveUsername(settings.user.username)
  },

  updateUsername: async (username) => {
    const next: AppSettings = {
      ...get(),
      user: { username: normalizeUsername(username) }
    }
    set(next)
    useBoardStore.getState().setActiveUsername(next.user.username)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) console.error('Failed to persist app settings')
  },

  updateUnhandledDrop: async (behavior) => {
    const next: AppSettings = { ...get(), files: { ...get().files, unhandledDrop: behavior } }
    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) console.error('Failed to persist app settings')
  },

  updateWarnLargeImport: async (warn) => {
    const next: AppSettings = { ...get(), files: { ...get().files, warnLargeImport: warn } }
    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) console.error('Failed to persist app settings')
  }
}))
