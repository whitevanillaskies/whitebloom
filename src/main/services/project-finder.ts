import { app } from 'electron'
import { constants } from 'fs'
import { access, readdir, stat } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'

export type ProjectFinderSidebarLocation = {
  label: string
  path: string
  kind: 'drive' | 'location'
}

export type ProjectFinderDirectoryEntry = {
  name: string
  path: string
  kind: 'directory' | 'workspace' | 'board' | 'quickboard'
  workspaceRoot?: string
}

export type ProjectFinderShell = {
  defaultPath: string
  locations: ProjectFinderSidebarLocation[]
}

export type ProjectFinderDirectoryListing = {
  path: string
  parentPath: string | null
  isWorkspaceRoot: boolean
  isInsideWorkspace: boolean
  entries: ProjectFinderDirectoryEntry[]
}

const QUICKBOARD_SUFFIX = '.wb.json'
const WORKSPACE_CONFIG_FILENAME = '.wbconfig'

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function isDirectoryPath(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory()
  } catch {
    return false
  }
}

function normalizePathForKey(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath
}

function isNonNull<T>(value: T): value is NonNullable<T> {
  return value !== null
}

function dedupeLocations(items: ProjectFinderSidebarLocation[]): ProjectFinderSidebarLocation[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalizePathForKey(item.path)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function resolveSpecialPath(
  name: 'home' | 'desktop' | 'documents' | 'downloads'
): Promise<string | null> {
  try {
    const filePath = app.getPath(name)
    return (await isDirectoryPath(filePath)) ? filePath : null
  } catch {
    return null
  }
}

async function listWindowsDrives(): Promise<ProjectFinderSidebarLocation[]> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const checks = await Promise.all(
    letters.map(async (letter) => {
      const drivePath = `${letter}:\\`
      return (await isDirectoryPath(drivePath))
        ? {
            label: drivePath.replace(/\\$/, ''),
            path: drivePath,
            kind: 'drive' as const
          }
        : null
    })
  )

  return checks.filter(isNonNull)
}

async function listPosixRoots(): Promise<ProjectFinderSidebarLocation[]> {
  return (await isDirectoryPath('/'))
    ? [
        {
          label: process.platform === 'darwin' ? 'Macintosh HD' : '/',
          path: '/',
          kind: 'drive'
        }
      ]
    : []
}

export async function getProjectFinderShell(
  preferredPath?: string | null
): Promise<ProjectFinderShell> {
  const homePath = await resolveSpecialPath('home')
  const desktopPath = await resolveSpecialPath('desktop')
  const documentsPath = await resolveSpecialPath('documents')
  const downloadsPath = await resolveSpecialPath('downloads')

  const driveLocations =
    process.platform === 'win32' ? await listWindowsDrives() : await listPosixRoots()

  const expectedLocations = dedupeLocations(
    [
      homePath ? { label: 'Home', path: homePath, kind: 'location' as const } : null,
      desktopPath ? { label: 'Desktop', path: desktopPath, kind: 'location' as const } : null,
      documentsPath ? { label: 'Documents', path: documentsPath, kind: 'location' as const } : null,
      downloadsPath ? { label: 'Downloads', path: downloadsPath, kind: 'location' as const } : null
    ].filter(isNonNull)
  )

  const preferred = preferredPath ? resolve(preferredPath) : null
  const defaultPathCandidates = [
    preferred,
    process.platform === 'win32' ? documentsPath : homePath,
    desktopPath,
    documentsPath,
    downloadsPath,
    homePath,
    driveLocations[0]?.path ?? null
  ]

  const defaultPath =
    (
      await Promise.all(
        defaultPathCandidates.map(async (candidate) =>
          candidate && (await isDirectoryPath(candidate)) ? candidate : null
        )
      )
    ).find((candidate) => candidate !== null) ?? app.getPath('home')

  return {
    defaultPath,
    locations: [...driveLocations, ...expectedLocations]
  }
}

function compareEntries(
  left: ProjectFinderDirectoryEntry,
  right: ProjectFinderDirectoryEntry
): number {
  const order = {
    workspace: 0,
    directory: 1,
    board: 2,
    quickboard: 3
  } as const

  const byKind = order[left.kind] - order[right.kind]
  if (byKind !== 0) return byKind
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
}

function getParentPath(directoryPath: string): string | null {
  const resolvedPath = resolve(directoryPath)
  const parentPath = dirname(resolvedPath)
  return parentPath === resolvedPath ? null : parentPath
}

async function checkInsideWorkspace(directoryPath: string): Promise<boolean> {
  let current = dirname(resolve(directoryPath))
  while (true) {
    const parent = dirname(current)
    if (await pathExists(join(current, WORKSPACE_CONFIG_FILENAME))) return true
    if (parent === current) return false
    current = parent
  }
}

export async function listProjectFinderDirectory(
  directoryPath: string
): Promise<ProjectFinderDirectoryListing> {
  const resolvedPath = resolve(directoryPath)
  const entries = await readdir(resolvedPath, { withFileTypes: true })
  const [isWorkspaceRoot, isInsideWorkspace] = await Promise.all([
    pathExists(join(resolvedPath, WORKSPACE_CONFIG_FILENAME)),
    checkInsideWorkspace(resolvedPath)
  ])

  const mappedEntries = await Promise.all(
    entries.map(async (entry): Promise<ProjectFinderDirectoryEntry | null> => {
      if (entry.name.startsWith('.')) return null

      const entryPath = join(resolvedPath, entry.name)

      if (entry.isDirectory()) {
        const isWorkspace = await pathExists(join(entryPath, WORKSPACE_CONFIG_FILENAME))
        return {
          name: entry.name,
          path: entryPath,
          kind: isWorkspace ? 'workspace' : 'directory'
        }
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(QUICKBOARD_SUFFIX)) {
        return {
          name: basename(entry.name, QUICKBOARD_SUFFIX),
          path: entryPath,
          kind: isWorkspaceRoot ? 'board' : 'quickboard',
          workspaceRoot: isWorkspaceRoot ? resolvedPath : undefined
        }
      }

      return null
    })
  )

  return {
    path: resolvedPath,
    parentPath: getParentPath(resolvedPath),
    isWorkspaceRoot,
    isInsideWorkspace,
    entries: mappedEntries
      .filter((entry): entry is ProjectFinderDirectoryEntry => entry !== null)
      .sort(compareEntries)
  }
}
