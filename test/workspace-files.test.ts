import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  copyWorkspaceResource,
  createBoard,
  createWorkspace,
  readWorkspace
} from '../src/main/services/workspace-files'

const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'whitebloom-tests-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('workspace-files', () => {
  it('creates a workspace config and keeps .gitignore stable across repeated setup', async () => {
    const workspaceRoot = await createTempRoot()

    await createWorkspace(workspaceRoot)
    await createWorkspace(workspaceRoot)

    const configJson = JSON.parse(await readFile(join(workspaceRoot, '.wbconfig'), 'utf-8')) as {
      version: number
    }
    const gitignore = await readFile(join(workspaceRoot, '.gitignore'), 'utf-8')
    const thumbEntries = gitignore.split(/\r?\n/).filter((line) => line.trim() === '.wbthumbs/')

    expect(configJson.version).toBe(1)
    expect(thumbEntries).toHaveLength(1)
  })

  it('sanitizes board names, deduplicates collisions, and returns sorted workspace boards', async () => {
    const workspaceRoot = await createTempRoot()
    await createWorkspace(workspaceRoot)

    const firstBoardPath = await createBoard(workspaceRoot, '  ..My:/ Board??  ')
    const secondBoardPath = await createBoard(workspaceRoot, 'My Board')
    const workspace = await readWorkspace(workspaceRoot)

    expect(basename(firstBoardPath)).toBe('My Board.wb.json')
    expect(basename(secondBoardPath)).toBe('My Board 2.wb.json')
    expect(workspace.boards.map((boardPath) => basename(boardPath))).toEqual([
      'My Board 2.wb.json',
      'My Board.wb.json'
    ])
  })

  it('copies imported resources into res and avoids filename collisions', async () => {
    const workspaceRoot = await createTempRoot()
    await createWorkspace(workspaceRoot)

    const sourceA = join(workspaceRoot, 'photo.png')
    const sourceB = join(workspaceRoot, 'nested', 'photo.png')
    await writeFile(sourceA, 'image-a', 'utf-8')
    await mkdir(join(workspaceRoot, 'nested'), { recursive: true })
    await writeFile(sourceB, 'image-b', 'utf-8')

    const resourceA = await copyWorkspaceResource(workspaceRoot, sourceA)
    const resourceB = await copyWorkspaceResource(workspaceRoot, sourceB)

    expect(resourceA).toBe('wloc:res/photo.png')
    expect(resourceB).toBe('wloc:res/photo 2.png')
    await expect(stat(join(workspaceRoot, 'res', 'photo.png'))).resolves.toBeTruthy()
    await expect(stat(join(workspaceRoot, 'res', 'photo 2.png'))).resolves.toBeTruthy()
  })
})
