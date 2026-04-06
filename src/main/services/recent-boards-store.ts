import { constants } from 'fs'
import { access, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getAppDataRoot } from './app-storage'
import { findWorkspaceRootForBoard } from './workspace-files'
import { getThumbnailUri } from './board-thumbnails'

const STORE_FILENAME = 'recent-boards.json'
const STORE_VERSION = 1
const MAX_RECENT = 20

type StoredEntry = {
  path: string
  openedAt: number
}

type StoreShape = {
  version: number
  boards: StoredEntry[]
}

export type RecentBoardItem = {
  path: string
  openedAt: number
  workspaceRoot?: string
  thumbnailUri?: string
}

function getStorePath(): string {
  return join(getAppDataRoot(), STORE_FILENAME)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readStore(): Promise<StoreShape> {
  const storePath = getStorePath()
  if (!(await pathExists(storePath))) {
    return { version: STORE_VERSION, boards: [] }
  }

  try {
    const raw = JSON.parse(await readFile(storePath, 'utf-8'))
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.boards)) {
      return { version: STORE_VERSION, boards: [] }
    }

    const boards: StoredEntry[] = raw.boards
      .filter(
        (entry: unknown) =>
          entry !== null &&
          typeof entry === 'object' &&
          typeof (entry as StoredEntry).path === 'string' &&
          typeof (entry as StoredEntry).openedAt === 'number'
      )
      .map((entry: StoredEntry) => ({ path: entry.path, openedAt: entry.openedAt }))

    return { version: STORE_VERSION, boards }
  } catch {
    return { version: STORE_VERSION, boards: [] }
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await writeFile(getStorePath(), JSON.stringify(store, null, 2), 'utf-8')
}

/**
 * Records a board open, upserting the path with the current timestamp.
 * Silently no-ops on failure — never throws.
 */
export async function recordBoardOpen(boardPath: string): Promise<void> {
  try {
    const store = await readStore()
    const filtered = store.boards.filter((entry) => entry.path !== boardPath)
    const updated: StoreShape = {
      version: STORE_VERSION,
      boards: [{ path: boardPath, openedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT)
    }
    await writeStore(updated)
  } catch (error) {
    console.error('[recent-boards] failed to record board open:', error)
  }
}

/**
 * Returns recent boards sorted by openedAt descending.
 * Thumbnail URIs are derived at read time — not stored in the JSON.
 * Entries for boards that no longer exist on disk are excluded from the result.
 */
export async function listRecentBoards(): Promise<RecentBoardItem[]> {
  const store = await readStore()

  const items = await Promise.all(
    store.boards.map(async (entry): Promise<RecentBoardItem | null> => {
      if (!(await pathExists(entry.path))) return null

      const workspaceRoot = await findWorkspaceRootForBoard(entry.path)
      const thumbnailUri =
        workspaceRoot !== null
          ? (await getThumbnailUri(entry.path, workspaceRoot)) ?? undefined
          : undefined

      return {
        path: entry.path,
        openedAt: entry.openedAt,
        workspaceRoot: workspaceRoot ?? undefined,
        thumbnailUri
      }
    })
  )

  return items.filter((item): item is RecentBoardItem => item !== null)
}
