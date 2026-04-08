import { rename } from 'fs/promises'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { createEmptyGardenState, normalizeGardenState, type GardenState } from '../../shared/arrangements'
import { createLogger } from '../../shared/logger'

const GARDEN_FILENAME = '.garden'
const GARDEN_TEMP_FILENAME = '.garden.tmp'
const logger = createLogger('garden-store')

export function getGardenPath(workspaceRoot: string): string {
  return join(workspaceRoot, GARDEN_FILENAME)
}

function getGardenTempPath(workspaceRoot: string): string {
  return join(workspaceRoot, GARDEN_TEMP_FILENAME)
}

function isGardenStateDocument(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function readGardenState(workspaceRoot: string): Promise<GardenState> {
  const gardenPath = getGardenPath(workspaceRoot)

  try {
    const json = await readFile(gardenPath, 'utf-8')
    const parsed = JSON.parse(json) as unknown

    if (!isGardenStateDocument(parsed)) {
      logger.warn(`falling back to empty state for ${gardenPath}: invalid garden schema`)
      return createEmptyGardenState()
    }

    return normalizeGardenState(parsed)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.warn(`falling back to empty state for ${gardenPath}:`, error)
    }
    return createEmptyGardenState()
  }
}

export async function writeGardenState(
  workspaceRoot: string,
  state: GardenState
): Promise<GardenState> {
  const normalizedState = normalizeGardenState(state)
  const gardenPath = getGardenPath(workspaceRoot)
  const tempPath = getGardenTempPath(workspaceRoot)

  await mkdir(dirname(gardenPath), { recursive: true })

  try {
    await writeFile(tempPath, JSON.stringify(normalizedState, null, 2), 'utf-8')
    await rename(tempPath, gardenPath)
    return normalizedState
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}
