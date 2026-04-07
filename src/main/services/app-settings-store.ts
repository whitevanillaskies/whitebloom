import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  normalizeAppSettings,
  normalizeLanguage,
  type AppSettings
} from '../../shared/app-settings'

function getAppSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function readAppSettings(): Promise<AppSettings> {
  let raw: unknown = undefined
  try {
    const json = await readFile(getAppSettingsPath(), 'utf-8')
    raw = JSON.parse(json)
  } catch {
    // ignore
  }

  const settings = normalizeAppSettings(raw)

  // First launch or upgrade from pre-i18n build: no language stored → detect from system locale.
  const hasLanguage = raw !== null && typeof raw === 'object' && 'language' in (raw as object)
  if (!hasLanguage) {
    settings.language = normalizeLanguage(app.getLocale())
    await writeAppSettings(settings).catch(() => {})
  }

  return settings
}

export async function writeAppSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeAppSettings(settings)
  const filePath = getAppSettingsPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}
