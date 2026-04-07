export const DEFAULT_USERNAME = 'anon'

export type UnhandledDropBehavior = 'import' | 'link' | 'ask'

export type AppSettings = {
  user: {
    username: string
  }
  files: {
    /** What to do when a file with no registered module handler is dropped onto the canvas. */
    unhandledDrop: UnhandledDropBehavior
    /** Show a warning dialog before importing files larger than the threshold. */
    warnLargeImport: boolean
  }
  language: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  user: {
    username: DEFAULT_USERNAME
  },
  files: {
    unhandledDrop: 'link',
    warnLargeImport: true
  },
  language: 'en'
}

export function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_USERNAME

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : DEFAULT_USERNAME
}

function normalizeUnhandledDrop(value: unknown): UnhandledDropBehavior {
  if (value === 'import' || value === 'link' || value === 'ask') return value
  return DEFAULT_APP_SETTINGS.files.unhandledDrop
}

export function normalizeLanguage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_APP_SETTINGS.language
  return value.split('-')[0].toLowerCase()
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return {
      user: { ...DEFAULT_APP_SETTINGS.user },
      files: { ...DEFAULT_APP_SETTINGS.files },
      language: DEFAULT_APP_SETTINGS.language
    }
  }

  const candidate = value as {
    user?: { username?: unknown }
    files?: { unhandledDrop?: unknown; warnLargeImport?: unknown }
    language?: unknown
  }
  return {
    user: {
      username: normalizeUsername(candidate.user?.username)
    },
    files: {
      unhandledDrop: normalizeUnhandledDrop(candidate.files?.unhandledDrop),
      warnLargeImport:
        candidate.files?.warnLargeImport === false
          ? false
          : DEFAULT_APP_SETTINGS.files.warnLargeImport
    },
    language: normalizeLanguage(candidate.language)
  }
}
