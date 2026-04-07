import { create } from 'zustand'
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  normalizeLanguage,
  normalizeUsername,
  type AppSettings,
  type UnhandledDropBehavior
} from '../../../shared/app-settings'
import i18n from '../i18n'
import { useBoardStore } from './board'

type AppSettingsState = AppSettings & {
  isHydrated: boolean
  loadAppSettings: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
  updateUnhandledDrop: (behavior: UnhandledDropBehavior) => Promise<void>
  updateWarnLargeImport: (warn: boolean) => Promise<void>
  updateLanguage: (lang: string) => Promise<void>
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...DEFAULT_APP_SETTINGS,
  isHydrated: false,

  loadAppSettings: async () => {
    const settings = normalizeAppSettings(await window.api.loadAppSettings())
    set({ ...settings, isHydrated: true })
    useBoardStore.getState().setActiveUsername(settings.user.username)
    await i18n.changeLanguage(settings.language)
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
  },

  updateLanguage: async (lang) => {
    const normalized = normalizeLanguage(lang)
    const next: AppSettings = { ...get(), language: normalized }
    set(next)
    await i18n.changeLanguage(normalized)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    await window.api.setLanguage(normalized)
    if (!result.ok) console.error('Failed to persist app settings')
  }
}))
