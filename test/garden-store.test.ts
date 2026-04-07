import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SYSTEM_TRASH_BIN_ID,
  createEmptyGardenState,
  normalizeGardenState
} from '../src/shared/arrangements'
import {
  getGardenPath,
  readGardenState,
  writeGardenState
} from '../src/main/services/garden-store'

const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'whitebloom-garden-tests-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('garden-store', () => {
  it('returns the empty default state when .garden is missing', async () => {
    const workspaceRoot = await createTempRoot()

    await expect(readGardenState(workspaceRoot)).resolves.toEqual(createEmptyGardenState())
  })

  it('falls back to the empty default state and warns when .garden is corrupt', async () => {
    const workspaceRoot = await createTempRoot()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeFile(getGardenPath(workspaceRoot), '{not valid json', 'utf-8')

    const state = await readGardenState(workspaceRoot)

    expect(state).toEqual(createEmptyGardenState())
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('falls back to the empty default state and warns when .garden has an invalid top-level shape', async () => {
    const workspaceRoot = await createTempRoot()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeFile(getGardenPath(workspaceRoot), '[]', 'utf-8')

    const state = await readGardenState(workspaceRoot)

    expect(state).toEqual(createEmptyGardenState())
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('normalizes invalid records and preserves valid arrangements data', async () => {
    const normalized = normalizeGardenState({
      version: 999,
      bins: [
        { id: 'refs', name: ' References ', kind: 'user' },
        { id: 'refs', name: 'Duplicate', kind: 'user' },
        { id: SYSTEM_TRASH_BIN_ID, name: 'Anything', kind: 'user' }
      ],
      sets: [
        {
          id: 'research',
          name: 'Research',
          children: [{ id: 'refs-set', name: 'Refs', children: [] }]
        }
      ],
      memberships: [
        { materialKey: 'wloc:blossoms/notes.md', setId: 'research' },
        { materialKey: 'wloc:blossoms/notes.md', setId: 'research' },
        { materialKey: 'wloc:blossoms/missing.md', setId: 'missing' }
      ],
      binAssignments: {
        'wloc:blossoms/notes.md': 'refs',
        'wloc:blossoms/trashed.md': SYSTEM_TRASH_BIN_ID,
        'wloc:blossoms/missing.md': 'missing'
      },
      desktopPlacements: {
        'wloc:blossoms/notes.md': { x: 120, y: 240 },
        bad: { x: 'nope', y: 0 }
      },
      cameraState: { x: 10, y: 20, zoom: -5 },
      trashContents: ['wloc:blossoms/trashed.md', 'wloc:blossoms/trashed.md']
    })

    expect(normalized.version).toBe(1)
    expect(normalized.bins).toEqual([
      { id: SYSTEM_TRASH_BIN_ID, name: 'Trash', kind: 'system' },
      { id: 'refs', name: 'References', kind: 'user' }
    ])
    expect(normalized.memberships).toEqual([
      { materialKey: 'wloc:blossoms/notes.md', setId: 'research' }
    ])
    expect(normalized.binAssignments).toEqual({
      'wloc:blossoms/notes.md': 'refs'
    })
    expect(normalized.desktopPlacements).toEqual({
      'wloc:blossoms/notes.md': { x: 120, y: 240 }
    })
    expect(normalized.cameraState).toEqual({ x: 10, y: 20, zoom: 1 })
    expect(normalized.trashContents).toEqual(['wloc:blossoms/trashed.md'])
  })

  it('writes normalized state through a temp file and persists .garden JSON', async () => {
    const workspaceRoot = await createTempRoot()

    const savedState = await writeGardenState(workspaceRoot, {
      version: 1,
      bins: [{ id: 'refs', name: 'Refs', kind: 'user' }],
      sets: [],
      memberships: [],
      binAssignments: {},
      desktopPlacements: {},
      cameraState: { x: 4, y: 5, zoom: 2 },
      trashContents: []
    })

    expect(savedState).toEqual({
      version: 1,
      bins: [
        { id: SYSTEM_TRASH_BIN_ID, name: 'Trash', kind: 'system' },
        { id: 'refs', name: 'Refs', kind: 'user' }
      ],
      sets: [],
      memberships: [],
      binAssignments: {},
      desktopPlacements: {},
      cameraState: { x: 4, y: 5, zoom: 2 },
      trashContents: []
    })

    const gardenJson = JSON.parse(await readFile(getGardenPath(workspaceRoot), 'utf-8')) as {
      version: number
      bins: Array<{ id: string }>
      cameraState: { zoom: number }
    }

    expect(gardenJson.version).toBe(1)
    expect(gardenJson.bins.map((bin) => bin.id)).toEqual([SYSTEM_TRASH_BIN_ID, 'refs'])
    expect(gardenJson.cameraState.zoom).toBe(2)
    await expect(readFile(join(workspaceRoot, '.garden.tmp'), 'utf-8')).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
