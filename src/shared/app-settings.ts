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
  commands: {
    aliases: Record<string, string>
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
  commands: {
    aliases: {}
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

export function normalizeCommandAlias(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) return undefined
  if (!/^[a-z0-9._-]+$/.test(normalized)) return undefined
  return normalized
}

function normalizeCommandAliases(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}

  const entries = Object.entries(value as Record<string, unknown>)
  const normalized: Record<string, string> = {}

  for (const [commandId, aliasValue] of entries) {
    const trimmedCommandId = commandId.trim()
    const alias = normalizeCommandAlias(aliasValue)
    if (!trimmedCommandId || !alias) continue
    normalized[trimmedCommandId] = alias
  }

  return normalized
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return {
      user: { ...DEFAULT_APP_SETTINGS.user },
      files: { ...DEFAULT_APP_SETTINGS.files },
      commands: { ...DEFAULT_APP_SETTINGS.commands },
      language: DEFAULT_APP_SETTINGS.language
    }
  }

  const candidate = value as {
    user?: { username?: unknown }
    files?: { unhandledDrop?: unknown; warnLargeImport?: unknown }
    commands?: { aliases?: unknown }
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
    commands: {
      aliases: normalizeCommandAliases(candidate.commands?.aliases)
    },
    language: normalizeLanguage(candidate.language)
  }
}
