import { app } from 'electron'
import { constants } from 'fs'
import { access, mkdir, readFile, readdir, unlink, writeFile } from 'fs/promises'
import { basename, dirname, join, resolve as resolvePath, sep } from 'path'

const APP_BOARDS_DIRECTORY_NAME = 'boards'
const APP_RES_DIRECTORY_NAME = 'res'
const APP_TRASH_DIRECTORY_NAME = 'trash'
const BOARD_FILE_SUFFIX = '.wb.json'
const CURRENT_BOARD_VERSION = 3

type EmptyBoard = {
  version: number
  transient?: true
  nodes: []
  edges: []
}

function createEmptyBoard(transient = false): EmptyBoard {
  return {
    version: CURRENT_BOARD_VERSION,
    ...(transient ? { transient: true as const } : {}),
    nodes: [],
    edges: []
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function isBoardFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(BOARD_FILE_SUFFIX)
}

function isPathInsideDirectory(filePath: string, directoryPath: string): boolean {
  const normalizedFilePath = resolvePath(filePath)
  const normalizedDirectoryPath = resolvePath(directoryPath)
  const directoryPrefix = normalizedDirectoryPath.endsWith(sep)
    ? normalizedDirectoryPath
    : `${normalizedDirectoryPath}${sep}`

  return (
    normalizedFilePath === normalizedDirectoryPath || normalizedFilePath.startsWith(directoryPrefix)
  )
}

function buildQuickboardFileName(timestamp: number, suffix: number): string {
  return suffix === 0
    ? `quickboard-${timestamp}${BOARD_FILE_SUFFIX}`
    : `quickboard-${timestamp}-${suffix}${BOARD_FILE_SUFFIX}`
}

function buildTrashFileName(fileName: string, suffix: number): string {
  if (suffix === 0) return fileName

  return fileName.replace(/(\.wb\.json)$/i, ` ${suffix}$1`)
}

export function getAppDataRoot(): string {
  return app.getPath('userData')
}

export function getAppBoardsDirectory(): string {
  return join(getAppDataRoot(), APP_BOARDS_DIRECTORY_NAME)
}

export function getAppResourcesDirectory(): string {
  return join(getAppDataRoot(), APP_RES_DIRECTORY_NAME)
}

export function getAppTrashDirectory(): string {
  return join(getAppDataRoot(), APP_TRASH_DIRECTORY_NAME)
}

export async function ensureAppStorageDirectories(): Promise<void> {
  await mkdir(getAppBoardsDirectory(), { recursive: true })
  await mkdir(getAppResourcesDirectory(), { recursive: true })
  await mkdir(getAppTrashDirectory(), { recursive: true })
}

export async function createTransientQuickboard(): Promise<string> {
  await ensureAppStorageDirectories()

  const boardsDirectory = getAppBoardsDirectory()
  const timestamp = Date.now()
  let suffix = 0
  let boardPath = join(boardsDirectory, buildQuickboardFileName(timestamp, suffix))

  while (await pathExists(boardPath)) {
    suffix += 1
    boardPath = join(boardsDirectory, buildQuickboardFileName(timestamp, suffix))
  }

  await writeFile(boardPath, JSON.stringify(createEmptyBoard(true), null, 2), 'utf-8')
  return boardPath
}

export async function promoteTransientBoard(
  transientPath: string,
  targetPath: string,
  json: string
): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, json, 'utf-8')

  if (transientPath !== targetPath && (await pathExists(transientPath))) {
    await unlink(transientPath)
  }
}

export async function listTransientBoards(): Promise<string[]> {
  await ensureAppStorageDirectories()

  const boardsDirectory = getAppBoardsDirectory()
  const entries = await readdir(boardsDirectory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && isBoardFileName(entry.name))
    .map((entry) => join(boardsDirectory, entry.name))
    .sort((left, right) =>
      basename(right).localeCompare(basename(left), undefined, { sensitivity: 'base' })
    )
}

export async function trashBoard(boardPath: string): Promise<string> {
  await ensureAppStorageDirectories()

  if (!isBoardFileName(basename(boardPath))) {
    throw new Error(`Not a Whitebloom board path: ${boardPath}`)
  }

  if (!(await pathExists(boardPath))) {
    throw new Error(`Board path does not exist: ${boardPath}`)
  }

  const trashDirectory = getAppTrashDirectory()
  if (isPathInsideDirectory(boardPath, trashDirectory)) {
    return boardPath
  }

  const boardJson = await readFile(boardPath, 'utf-8')
  let suffix = 0
  let trashPath = join(trashDirectory, buildTrashFileName(basename(boardPath), suffix))

  while (await pathExists(trashPath)) {
    suffix += 1
    trashPath = join(trashDirectory, buildTrashFileName(basename(boardPath), suffix))
  }

  await writeFile(trashPath, boardJson, 'utf-8')
  await unlink(boardPath)
  return trashPath
}
