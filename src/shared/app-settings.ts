export const DEFAULT_USERNAME = 'anon'

export type AppSettings = {
  user: {
    username: string
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  user: {
    username: DEFAULT_USERNAME
  }
}

export function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_USERNAME

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : DEFAULT_USERNAME
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return {
      user: { ...DEFAULT_APP_SETTINGS.user }
    }
  }

  const candidate = value as { user?: { username?: unknown } }
  return {
    user: {
      username: normalizeUsername(candidate.user?.username)
    }
  }
}
