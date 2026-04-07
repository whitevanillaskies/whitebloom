import { readdir, readFile, rm } from 'fs/promises'
import { basename, extname, join, parse, relative } from 'path'
import { pathToFileURL } from 'url'
import type { Board, BoardNode } from '../../renderer/src/shared/types'
import type { ArrangementsMaterial } from '../../shared/arrangements'
import { resolveResource } from '../resource-uri'
import { readWorkspace } from './workspace-files'

const BLOSSOMS_DIRECTORY_NAME = 'blossoms'
const RES_DIRECTORY_NAME = 'res'
const SKIPPED_DIRECTORY_NAMES = new Set(['.thumbs', '.wbthumbs', '.inbox-snapshots'])

function toPosixPath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/')
}

function toWlocKey(workspaceRoot: string, absolutePath: string): string {
  const relativePath = toPosixPath(relative(workspaceRoot, absolutePath))
  return `wloc:${relativePath}`
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

function collectLinkedResourceUris(board: Board): string[] {
  const linkedUris: string[] = []

  for (const node of board.nodes) {
    const resource = (node as BoardNode).resource
    if (typeof resource !== 'string') continue
    const trimmedResource = resource.trim()
    if (!trimmedResource.startsWith('file:///')) continue
    linkedUris.push(trimmedResource)
  }

  return linkedUris
}

async function collectLinkedMaterials(boardPaths: string[]): Promise<ArrangementsMaterial[]> {
  const linkedMaterials = new Map<string, ArrangementsMaterial>()

  for (const boardPath of boardPaths) {
    try {
      const board = JSON.parse(await readFile(boardPath, 'utf-8')) as Board
      for (const uri of collectLinkedResourceUris(board)) {
        if (linkedMaterials.has(uri)) continue

        const fileName = basename(new URL(uri).pathname)
        linkedMaterials.set(uri, createMaterial('linked', uri, fileName))
      }
    } catch {
      // Ignore invalid boards for now. Enumeration should stay best-effort.
    }
  }

  return [...linkedMaterials.values()]
}

export async function findBoardsReferencingMaterial(
  workspaceRoot: string,
  materialKey: string
): Promise<string[]> {
  const workspace = await readWorkspace(workspaceRoot)
  const referencingBoards: string[] = []

  for (const boardPath of workspace.boards) {
    try {
      const board = JSON.parse(await readFile(boardPath, 'utf-8')) as Board
      const referencesMaterial = board.nodes.some((node) => {
        const resource = (node as BoardNode).resource
        return typeof resource === 'string' && resource.trim() === materialKey
      })

      if (referencesMaterial) {
        referencingBoards.push(boardPath)
      }
    } catch {
      // Invalid board files are ignored for best-effort reference checks.
    }
  }

  return referencingBoards
}

export async function emptyArrangementsTrash(
  workspaceRoot: string,
  materialKeys: string[]
): Promise<void> {
  await Promise.all(
    materialKeys.map(async (materialKey) => {
      try {
        const absolutePath = resolveResource(materialKey, workspaceRoot)
        await rm(absolutePath, { force: true, recursive: false })
      } catch {
        // Missing paths or unsupported keys should not abort the rest of the trash empty pass.
      }
    })
  )
}

export async function enumerateWorkspaceMaterial(workspaceRoot: string): Promise<ArrangementsMaterial[]> {
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
  const linkedMaterials = await collectLinkedMaterials(workspace.boards)

  const materials = [
    ...boardMaterials,
    ...blossomMaterials,
    ...resourceMaterials,
    ...linkedMaterials
  ]

  materials.sort((left, right) => left.key.localeCompare(right.key, undefined, { sensitivity: 'base' }))
  return materials
}

export function toLinkedFileUri(absolutePath: string): string {
  return pathToFileURL(absolutePath).toString()
}
