import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { enumerateWorkspaceMaterial, toLinkedFileUri } from '../src/main/services/workspace-material'
import { createWorkspace } from '../src/main/services/workspace-files'

const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'whitebloom-material-tests-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('workspace-material', () => {
  it('enumerates boards, blossoms, resources, and linked file references', async () => {
    const workspaceRoot = await createTempRoot()
    await createWorkspace(workspaceRoot)

    await mkdir(join(workspaceRoot, 'blossoms'), { recursive: true })
    await mkdir(join(workspaceRoot, 'res', '.thumbs'), { recursive: true })
    await mkdir(join(workspaceRoot, 'res', 'nested'), { recursive: true })

    const linkedAbsolutePath = join(workspaceRoot, 'external-assets', 'reference.pdf')
    await mkdir(join(workspaceRoot, 'external-assets'), { recursive: true })
    await writeFile(linkedAbsolutePath, 'linked', 'utf-8')

    await writeFile(
      join(workspaceRoot, 'project board.wb.json'),
      JSON.stringify({
        version: 3,
        name: 'Project board',
        nodes: [
          {
            id: 'node-1',
            kind: 'bud',
            type: 'markdown',
            position: { x: 0, y: 0 },
            size: { w: 10, h: 10 },
            created: '2026-01-01T00:00:00.000Z',
            createdBy: 'anon',
            updatedAt: '2026-01-01T00:00:00.000Z',
            updatedBy: 'anon',
            resource: toLinkedFileUri(linkedAbsolutePath)
          }
        ],
        edges: []
      }),
      'utf-8'
    )

    await writeFile(join(workspaceRoot, 'blossoms', 'notes.md'), '# Notes', 'utf-8')
    await writeFile(join(workspaceRoot, 'res', 'diagram.png'), 'img', 'utf-8')
    await writeFile(join(workspaceRoot, 'res', 'nested', 'sheet.xlsx'), 'xls', 'utf-8')
    await writeFile(join(workspaceRoot, 'res', '.thumbs', 'diagram-thumb.png'), 'thumb', 'utf-8')

    const materials = await enumerateWorkspaceMaterial(workspaceRoot)

    expect(materials).toEqual([
      {
        key: toLinkedFileUri(linkedAbsolutePath),
        kind: 'linked',
        displayName: 'reference',
        extension: '.pdf'
      },
      {
        key: 'wloc:blossoms/notes.md',
        kind: 'blossom',
        displayName: 'notes',
        extension: '.md'
      },
      {
        key: 'wloc:project board.wb.json',
        kind: 'board',
        displayName: 'project board',
        extension: '.wb.json'
      },
      {
        key: 'wloc:res/diagram.png',
        kind: 'resource',
        displayName: 'diagram',
        extension: '.png'
      },
      {
        key: 'wloc:res/nested/sheet.xlsx',
        kind: 'resource',
        displayName: 'sheet',
        extension: '.xlsx'
      }
    ])
  })

  it('ignores malformed boards during linked material collection', async () => {
    const workspaceRoot = await createTempRoot()
    await createWorkspace(workspaceRoot)
    await writeFile(join(workspaceRoot, 'broken.wb.json'), '{not json', 'utf-8')

    await expect(enumerateWorkspaceMaterial(workspaceRoot)).resolves.toEqual([
      {
        key: 'wloc:broken.wb.json',
        kind: 'board',
        displayName: 'broken',
        extension: '.wb.json'
      }
    ])
  })
})
