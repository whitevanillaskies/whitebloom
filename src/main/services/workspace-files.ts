import { constants } from 'fs'
import { access, copyFile, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, parse } from 'path'

export type WorkspaceConfig = {
  version: number
  name?: string
  brief?: string
}

export type Workspace = {
  config: WorkspaceConfig
  rootPath: string
  boards: string[]
}

type EmptyBoard = {
  version: number
  name?: string
  nodes: []
  edges: []
}

const WORKSPACE_CONFIG_FILENAME = '.wbconfig'
const BOARD_FILE_SUFFIX = '.wb.json'
const DEFAULT_BOARD_STEM = 'board'
const RES_DIRECTORY_NAME = 'res'
const CURRENT_WORKSPACE_CONFIG_VERSION = 1
const CURRENT_BOARD_VERSION = 3

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeWorkspaceConfig(value: unknown): WorkspaceConfig {
  if (!value || typeof value !== 'object') {
    return { version: CURRENT_WORKSPACE_CONFIG_VERSION }
  }

  const candidate = value as { name?: unknown; brief?: unknown }
  return {
    version: CURRENT_WORKSPACE_CONFIG_VERSION,
    name: normalizeOptionalText(candidate.name),
    brief: normalizeOptionalText(candidate.brief)
  }
}

function createEmptyBoard(name?: string): EmptyBoard {
  const normalizedName = normalizeOptionalText(name)
  return {
    version: CURRENT_BOARD_VERSION,
    ...(normalizedName ? { name: normalizedName } : {}),
    nodes: [],
    edges: []
  }
}

function isBoardFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(BOARD_FILE_SUFFIX)
}

function sanitizeBoardStem(name: string): string {
  const trimmed = name.trim()
  const candidate = (trimmed.length > 0 ? trimmed : DEFAULT_BOARD_STEM)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/g, '')
    .trim()

  return candidate.length > 0 ? candidate : DEFAULT_BOARD_STEM
}

function sanitizeResourceFileName(fileName: string): string {
  const parsed = parse(fileName)
  const baseName = parsed.name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/g, '')
    .trim()
  const extension = extname(fileName)

  return `${baseName || 'resource'}${extension}`
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function ensureUniqueBoardPath(workspaceRoot: string, boardStem: string): Promise<string> {
  const normalizedStem = sanitizeBoardStem(boardStem)
  let suffix = 1
  let candidatePath = join(workspaceRoot, `${normalizedStem}${BOARD_FILE_SUFFIX}`)

  while (await pathExists(candidatePath)) {
    suffix += 1
    candidatePath = join(workspaceRoot, `${normalizedStem} ${suffix}${BOARD_FILE_SUFFIX}`)
  }

  return candidatePath
}

async function ensureUniqueFilePath(directoryPath: string, fileName: string): Promise<string> {
  const normalizedName = sanitizeResourceFileName(fileName)
  const parsedName = parse(normalizedName)
  let suffix = 1
  let candidatePath = join(directoryPath, normalizedName)

  while (await pathExists(candidatePath)) {
    suffix += 1
    candidatePath = join(directoryPath, `${parsedName.name} ${suffix}${parsedName.ext}`)
  }

  return candidatePath
}

export function getWorkspaceConfigPath(workspaceRoot: string): string {
  return join(workspaceRoot, WORKSPACE_CONFIG_FILENAME)
}

export async function findWorkspaceRootForBoard(boardPath: string): Promise<string | null> {
  const workspaceRoot = dirname(boardPath)
  return (await pathExists(getWorkspaceConfigPath(workspaceRoot))) ? workspaceRoot : null
}

export async function createWorkspace(workspaceRoot: string): Promise<void> {
  await mkdir(workspaceRoot, { recursive: true })

  const configPath = getWorkspaceConfigPath(workspaceRoot)
  const config = (await pathExists(configPath))
    ? normalizeWorkspaceConfig(JSON.parse(await readFile(configPath, 'utf-8')))
    : normalizeWorkspaceConfig(undefined)

  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export async function readWorkspace(workspaceRoot: string): Promise<Workspace> {
  const configPath = getWorkspaceConfigPath(workspaceRoot)
  const json = await readFile(configPath, 'utf-8')
  const config = normalizeWorkspaceConfig(JSON.parse(json))
  const entries = await readdir(workspaceRoot, { withFileTypes: true })

  const boards = entries
    .filter((entry) => entry.isFile() && isBoardFileName(entry.name))
    .map((entry) => join(workspaceRoot, entry.name))
    .sort((left, right) =>
      basename(left).localeCompare(basename(right), undefined, { sensitivity: 'base' })
    )

  return { config, rootPath: workspaceRoot, boards }
}

export async function readBoard(boardPath: string): Promise<string> {
  return await readFile(boardPath, 'utf-8')
}

export async function writeBoard(boardPath: string, json: string): Promise<void> {
  await mkdir(dirname(boardPath), { recursive: true })
  await writeFile(boardPath, json, 'utf-8')
}

export async function createBoard(workspaceRoot: string, name: string): Promise<string> {
  const configPath = getWorkspaceConfigPath(workspaceRoot)
  if (!(await pathExists(configPath))) {
    throw new Error(`Workspace config not found: ${configPath}`)
  }

  const boardPath = await ensureUniqueBoardPath(workspaceRoot, name)
  await writeFile(boardPath, JSON.stringify(createEmptyBoard(name), null, 2), 'utf-8')
  return boardPath
}

export async function copyWorkspaceResource(
  workspaceRoot: string,
  sourcePath: string
): Promise<string> {
  const configPath = getWorkspaceConfigPath(workspaceRoot)
  if (!(await pathExists(configPath))) {
    throw new Error(`Workspace config not found: ${configPath}`)
  }

  const resourceDirectory = join(workspaceRoot, RES_DIRECTORY_NAME)
  await mkdir(resourceDirectory, { recursive: true })

  const targetPath = await ensureUniqueFilePath(resourceDirectory, basename(sourcePath))
  await copyFile(sourcePath, targetPath)

  return `wloc:${RES_DIRECTORY_NAME}/${basename(targetPath)}`
}

export async function createQuickboard(boardPath: string): Promise<void> {
  await mkdir(dirname(boardPath), { recursive: true })
  await writeFile(boardPath, JSON.stringify(createEmptyBoard(), null, 2), 'utf-8')
}
