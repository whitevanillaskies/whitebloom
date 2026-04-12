import { create } from 'zustand'
import {
  DEFAULT_APP_SETTINGS,
  normalizeCommandAlias,
  normalizeAppSettings,
  normalizeLanguage,
  normalizeUsername,
  type AppSettings,
  type UnhandledDropBehavior
} from '../../../shared/app-settings'
import i18n from '../i18n'
import { createLogger } from '../../../shared/logger'
import { useBoardStore } from './board'

type AppSettingsState = AppSettings & {
  isHydrated: boolean
  loadAppSettings: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
  updateUnhandledDrop: (behavior: UnhandledDropBehavior) => Promise<void>
  updateWarnLargeImport: (warn: boolean) => Promise<void>
  updateLanguage: (lang: string) => Promise<void>
  updateCommandAlias: (commandId: string, alias: string) => Promise<void>
}

const logger = createLogger('app-settings')

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
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateUnhandledDrop: async (behavior) => {
    const next: AppSettings = { ...get(), files: { ...get().files, unhandledDrop: behavior } }
    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateWarnLargeImport: async (warn) => {
    const next: AppSettings = { ...get(), files: { ...get().files, warnLargeImport: warn } }
    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateLanguage: async (lang) => {
    const normalized = normalizeLanguage(lang)
    const next: AppSettings = { ...get(), language: normalized }
    set(next)
    await i18n.changeLanguage(normalized)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    await window.api.setLanguage(normalized)
    if (!result.ok) logger.error('failed to persist app settings')
  },

  updateCommandAlias: async (commandId, alias) => {
    const normalizedCommandId = commandId.trim()
    if (!normalizedCommandId) return

    const normalizedAlias = normalizeCommandAlias(alias)
    const existingAliases = { ...get().commands.aliases }

    for (const [existingCommandId, existingAlias] of Object.entries(existingAliases)) {
      if (existingCommandId !== normalizedCommandId && existingAlias === normalizedAlias) {
        delete existingAliases[existingCommandId]
      }
    }

    if (normalizedAlias) {
      existingAliases[normalizedCommandId] = normalizedAlias
    } else {
      delete existingAliases[normalizedCommandId]
    }

    const next: AppSettings = {
      ...get(),
      commands: {
        aliases: existingAliases
      }
    }

    set(next)
    const result = await window.api.saveAppSettings(next)
    set({ ...normalizeAppSettings(result.settings) })
    if (!result.ok) logger.error('failed to persist app settings')
  }
}))
