import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_USERNAME } from '../src/shared/app-settings'
import { useBoardStore } from '../src/renderer/src/stores/board'
import { CURRENT_BOARD_VERSION, type Board } from '@renderer/shared/types'

const boardsDir = join(process.cwd(), 'test', 'boards')

function resetBoardStore(): void {
  useBoardStore.setState({
    version: CURRENT_BOARD_VERSION,
    path: null,
    transient: undefined,
    name: undefined,
    brief: undefined,
    nodes: [],
    edges: [],
    viewport: undefined,
    activeUsername: DEFAULT_USERNAME,
    isDirty: false
  })
}

describe('board fixtures', () => {
  beforeEach(() => {
    resetBoardStore()
  })

  it('loads every board fixture through the board store without losing core shape', async () => {
    const boardFiles = (await readdir(boardsDir)).filter((fileName) =>
      fileName.endsWith('.wb.json')
    )

    expect(boardFiles.length).toBeGreaterThan(0)

    for (const fileName of boardFiles) {
      resetBoardStore()

      const raw = await readFile(join(boardsDir, fileName), 'utf-8')
      const board = JSON.parse(raw) as Board

      expect(Array.isArray(board.nodes), `${fileName} should contain nodes`).toBe(true)
      expect(Array.isArray(board.edges), `${fileName} should contain edges`).toBe(true)

      useBoardStore.getState().loadBoard(board, join('test', 'boards', fileName))

      const state = useBoardStore.getState()
      expect(state.version, `${fileName} should load as the current board version`).toBe(
        CURRENT_BOARD_VERSION
      )
      expect(state.nodes).toHaveLength(board.nodes.length)
      expect(state.edges).toHaveLength(board.edges.length)

      for (const node of state.nodes) {
        expect(typeof node.id, `${fileName} node id`).toBe('string')
        expect(typeof node.created, `${fileName} created timestamp`).toBe('string')
        expect(typeof node.updatedAt, `${fileName} updated timestamp`).toBe('string')
        expect(typeof node.createdBy, `${fileName} createdBy`).toBe('string')
        expect(typeof node.updatedBy, `${fileName} updatedBy`).toBe('string')
      }
    }
  })
})
