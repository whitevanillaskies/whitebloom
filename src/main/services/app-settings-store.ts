import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { normalizeAppSettings, type AppSettings } from '../../shared/app-settings'

function getAppSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function readAppSettings(): Promise<AppSettings> {
  try {
    const json = await readFile(getAppSettingsPath(), 'utf-8')
    return normalizeAppSettings(JSON.parse(json))
  } catch {
    return normalizeAppSettings(undefined)
  }
}

export async function writeAppSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeAppSettings(settings)
  const filePath = getAppSettingsPath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}
