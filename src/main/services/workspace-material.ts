import { readdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, extname, join, parse, relative } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import type { Board, BoardNode } from '../../renderer/src/shared/types'
import type { ArrangementsMaterial } from '../../shared/arrangements'
import { resolveResource } from '../resource-uri'
import { readWorkspace } from './workspace-files'

const BLOSSOMS_DIRECTORY_NAME = 'blossoms'
const RES_DIRECTORY_NAME = 'res'
const BOARD_FILE_SUFFIX = '.wb.json'
const EXTERNAL_MATERIAL_REGISTRY_FILENAME = '.links'
const CURRENT_EXTERNAL_MATERIAL_REGISTRY_VERSION = 1
const SKIPPED_DIRECTORY_NAMES = new Set(['.thumbs', '.wbthumbs', '.inbox-snapshots'])

type ExternalMaterialRecord = {
  key: string
  displayName?: string
}

type ExternalMaterialRegistry = {
  version: number
  materials: ExternalMaterialRecord[]
}

function toPosixPath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/')
}

function toWlocKey(workspaceRoot: string, absolutePath: string): string {
  const relativePath = toPosixPath(relative(workspaceRoot, absolutePath))
  return `wloc:${relativePath}`
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function getDisplayName(fileName: string, extension: string): string {
  if (extension === '.wb.json') {
    return fileName.replace(/\.wb\.json$/i, '')
  }

  return parse(fileName).name || fileName
}

function normalizeExtension(fileName: string): string | null {
  if (fileName.toLowerCase().endsWith('.wb.json')) {
    return '.wb.json'
  }

  const extension = extname(fileName)
  return extension.length > 0 ? extension.toLowerCase() : null
}

function isFileLinkedMaterialKey(value: string): boolean {
  return value.startsWith('file:///')
}

function isWebLinkedMaterialKey(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function isExternalMaterialKey(value: string): boolean {
  const normalized = value.trim()
  return isFileLinkedMaterialKey(normalized) || isWebLinkedMaterialKey(normalized)
}

function normalizeExternalMaterialRecord(value: unknown): ExternalMaterialRecord | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as { key?: unknown; displayName?: unknown }
  const key = normalizeOptionalText(candidate.key)
  if (!key || !isExternalMaterialKey(key)) return null

  const displayName = normalizeOptionalText(candidate.displayName)
  return displayName ? { key, displayName } : { key }
}

function normalizeExternalMaterialRegistry(value: unknown): ExternalMaterialRecord[] {
  if (!value || typeof value !== 'object') return []

  const candidate = value as { materials?: unknown }
  if (!Array.isArray(candidate.materials)) return []

  const records = new Map<string, ExternalMaterialRecord>()
  for (const entry of candidate.materials) {
    const record = normalizeExternalMaterialRecord(entry)
    if (!record) continue
    records.set(record.key, record)
  }

  return [...records.values()].sort((left, right) =>
    left.key.localeCompare(right.key, undefined, { sensitivity: 'base' })
  )
}

function getExternalMaterialRegistryPath(workspaceRoot: string): string {
  return join(workspaceRoot, EXTERNAL_MATERIAL_REGISTRY_FILENAME)
}

async function readExternalMaterialRegistry(
  workspaceRoot: string
): Promise<ExternalMaterialRecord[]> {
  try {
    const raw = await readFile(getExternalMaterialRegistryPath(workspaceRoot), 'utf-8')
    return normalizeExternalMaterialRegistry(JSON.parse(raw) as ExternalMaterialRegistry)
  } catch {
    return []
  }
}

function serializeExternalMaterialRegistry(records: ExternalMaterialRecord[]): string {
  const uniqueRecords = [...records]
    .sort((left, right) => left.key.localeCompare(right.key, undefined, { sensitivity: 'base' }))
    .map((record) =>
      record.displayName
        ? { key: record.key, displayName: record.displayName }
        : { key: record.key }
    )

  return JSON.stringify(
    {
      version: CURRENT_EXTERNAL_MATERIAL_REGISTRY_VERSION,
      materials: uniqueRecords
    } satisfies ExternalMaterialRegistry,
    null,
    2
  )
}

async function writeExternalMaterialRegistry(
  workspaceRoot: string,
  records: ExternalMaterialRecord[]
): Promise<void> {
  const registryPath = getExternalMaterialRegistryPath(workspaceRoot)
  const normalizedRecords = normalizeExternalMaterialRegistry({ materials: records })

  if (normalizedRecords.length === 0) {
    await rm(registryPath, { force: true })
    return
  }

  const nextContents = serializeExternalMaterialRegistry(normalizedRecords)

  try {
    const previousContents = await readFile(registryPath, 'utf-8')
    if (previousContents === nextContents) return
  } catch {
    // Missing registry is fine; it will be created below.
  }

  await writeFile(registryPath, nextContents, 'utf-8')
}

function upsertExternalMaterialRecord(
  records: Map<string, ExternalMaterialRecord>,
  key: string,
  displayName?: string
): void {
  const normalizedKey = key.trim()
  if (!isExternalMaterialKey(normalizedKey)) return

  const normalizedDisplayName = normalizeOptionalText(displayName)
  const existing = records.get(normalizedKey)
  records.set(
    normalizedKey,
    normalizedDisplayName
      ? { key: normalizedKey, displayName: normalizedDisplayName }
      : existing?.displayName
        ? { key: normalizedKey, displayName: existing.displayName }
        : { key: normalizedKey }
  )
}

function createMaterial(
  kind: ArrangementsMaterial['kind'],
  key: string,
  fileName: string
): ArrangementsMaterial {
  const extension = normalizeExtension(fileName)
  return {
    key,
    kind,
    displayName: getDisplayName(fileName, extension ?? ''),
    extension
  }
}

async function collectFilesRecursively(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue
      files.push(...(await collectFilesRecursively(absolutePath)))
      continue
    }

    if (!entry.isFile()) continue
    files.push(absolutePath)
  }

  return files
}

async function collectBoardFilesRecursively(workspaceRoot: string): Promise<string[]> {
  const entries = await readdir(workspaceRoot, { withFileTypes: true })
  const boardPaths: string[] = []

  for (const entry of entries) {
    const absolutePath = join(workspaceRoot, entry.name)

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue
      boardPaths.push(...(await collectBoardFilesRecursively(absolutePath)))
      continue
    }

    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith(BOARD_FILE_SUFFIX)) continue
    boardPaths.push(absolutePath)
  }

  return boardPaths
}

async function collectWorkspaceOwnedMaterials(
  workspaceRoot: string,
  directoryName: typeof BLOSSOMS_DIRECTORY_NAME | typeof RES_DIRECTORY_NAME,
  kind: Extract<ArrangementsMaterial['kind'], 'blossom' | 'resource'>
): Promise<ArrangementsMaterial[]> {
  const directoryPath = join(workspaceRoot, directoryName)

  try {
    const files = await collectFilesRecursively(directoryPath)
    return files.map((absolutePath) =>
      createMaterial(kind, toWlocKey(workspaceRoot, absolutePath), basename(absolutePath))
    )
  } catch {
    return []
  }
}

function collectExternalMaterialRecords(board: Board): ExternalMaterialRecord[] {
  const records = new Map<string, ExternalMaterialRecord>()
  for (const node of board.nodes) {
    const resource = (node as BoardNode).resource
    if (typeof resource !== 'string') continue
    const trimmedResource = resource.trim()
    if (!isExternalMaterialKey(trimmedResource)) continue
    upsertExternalMaterialRecord(
      records,
      trimmedResource,
      typeof node.label === 'string' ? node.label : undefined
    )
  }

  return [...records.values()]
}

function createLinkedMaterial(record: ExternalMaterialRecord): ArrangementsMaterial | null {
  const key = record.key.trim()
  const displayNameOverride = normalizeOptionalText(record.displayName)

  if (isFileLinkedMaterialKey(key)) {
    try {
      const absolutePath = fileURLToPath(key)
      const fileName = basename(absolutePath)
      const extension = normalizeExtension(fileName)

      return {
        key,
        kind: 'linked',
        displayName: displayNameOverride ?? getDisplayName(fileName, extension ?? ''),
        extension
      }
    } catch {
      return null
    }
  }

  if (!isWebLinkedMaterialKey(key)) return null

  try {
    const url = new URL(key)
    const path = url.pathname.replace(/\/+$/, '')
    const lastSegment = path.split('/').filter(Boolean).pop()
    const decodedSegment = lastSegment ? decodeURIComponent(lastSegment) : null
    const extension = decodedSegment ? normalizeExtension(decodedSegment) : null

    return {
      key,
      kind: 'linked',
      displayName:
        displayNameOverride ??
        (decodedSegment ? getDisplayName(decodedSegment, extension ?? '') : url.hostname),
      extension
    }
  } catch {
    return {
      key,
      kind: 'linked',
      displayName: displayNameOverride ?? key,
      extension: null
    }
  }
}

async function collectLinkedMaterials(
  workspaceRoot: string,
  boardPaths: string[]
): Promise<ArrangementsMaterial[]> {
  const linkedRecords = new Map(
    (await readExternalMaterialRegistry(workspaceRoot)).map(
      (record) => [record.key, record] as const
    )
  )

  for (const boardPath of boardPaths) {
    try {
      const board = JSON.parse(await readFile(boardPath, 'utf-8')) as Board
      for (const record of collectExternalMaterialRecords(board)) {
        upsertExternalMaterialRecord(linkedRecords, record.key, record.displayName)
      }
    } catch {
      // Ignore invalid boards for now. Enumeration should stay best-effort.
    }
  }

  const mergedRecords = [...linkedRecords.values()]
  await writeExternalMaterialRegistry(workspaceRoot, mergedRecords)

  return mergedRecords
    .map((record) => createLinkedMaterial(record))
    .filter((material): material is ArrangementsMaterial => material !== null)
}

export async function registerLinkedMaterials(
  workspaceRoot: string,
  records: ExternalMaterialRecord[]
): Promise<void> {
  const registry = new Map(
    (await readExternalMaterialRegistry(workspaceRoot)).map(
      (record) => [record.key, record] as const
    )
  )

  for (const record of records) {
    upsertExternalMaterialRecord(registry, record.key, record.displayName)
  }

  await writeExternalMaterialRegistry(workspaceRoot, [...registry.values()])
}

export async function findBoardsReferencingMaterial(
  workspaceRoot: string,
  materialKey: string
): Promise<string[]> {
  const normalizedMaterialKey = materialKey.trim()
  if (!normalizedMaterialKey) return []

  const boardPaths = await collectBoardFilesRecursively(workspaceRoot)
  const referencingBoards: string[] = []

  for (const boardPath of boardPaths) {
    try {
      const board = JSON.parse(await readFile(boardPath, 'utf-8')) as Board
      const referencesMaterial = board.nodes.some((node) => {
        const resource = (node as BoardNode).resource
        return typeof resource === 'string' && resource.trim() === normalizedMaterialKey
      })

      if (referencesMaterial) {
        referencingBoards.push(boardPath)
      }
    } catch {
      // Invalid board files are ignored for best-effort reference checks.
    }
  }

  referencingBoards.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  )
  return referencingBoards
}

export async function emptyArrangementsTrash(
  workspaceRoot: string,
  materialKeys: string[]
): Promise<void> {
  const externalMaterialKeys = new Set(
    materialKeys
      .map((materialKey) => materialKey.trim())
      .filter((materialKey) => isExternalMaterialKey(materialKey))
  )

  if (externalMaterialKeys.size > 0) {
    const persistedRecords = await readExternalMaterialRegistry(workspaceRoot)
    await writeExternalMaterialRegistry(
      workspaceRoot,
      persistedRecords.filter((record) => !externalMaterialKeys.has(record.key))
    )
  }

  await Promise.all(
    materialKeys.map(async (materialKey) => {
      const normalizedMaterialKey = materialKey.trim()
      if (!normalizedMaterialKey || isExternalMaterialKey(normalizedMaterialKey)) return

      try {
        const absolutePath = resolveResource(normalizedMaterialKey, workspaceRoot)
        await rm(absolutePath, { force: true, recursive: false })
      } catch {
        // Missing paths or unsupported keys should not abort the rest of the trash empty pass.
      }
    })
  )
}

export async function enumerateWorkspaceMaterial(
  workspaceRoot: string
): Promise<ArrangementsMaterial[]> {
  const workspace = await readWorkspace(workspaceRoot)

  const boardMaterials = workspace.boards.map((boardPath) =>
    createMaterial('board', toWlocKey(workspaceRoot, boardPath), basename(boardPath))
  )
  const blossomMaterials = await collectWorkspaceOwnedMaterials(
    workspaceRoot,
    BLOSSOMS_DIRECTORY_NAME,
    'blossom'
  )
  const resourceMaterials = await collectWorkspaceOwnedMaterials(
    workspaceRoot,
    RES_DIRECTORY_NAME,
    'resource'
  )
  const linkedMaterials = await collectLinkedMaterials(workspaceRoot, workspace.boards)

  const materials = [
    ...boardMaterials,
    ...blossomMaterials,
    ...resourceMaterials,
    ...linkedMaterials
  ]

  materials.sort((left, right) =>
    left.key.localeCompare(right.key, undefined, { sensitivity: 'base' })
  )
  return materials
}

export function toLinkedFileUri(absolutePath: string): string {
  return pathToFileURL(absolutePath).toString()
}
