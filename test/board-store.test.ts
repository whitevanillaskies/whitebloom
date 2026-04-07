import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_USERNAME } from '../src/shared/app-settings'
import { useBoardStore } from '../src/renderer/src/stores/board'
import { CURRENT_BOARD_VERSION, makeLexicalContent, type Board } from '@renderer/shared/types'

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

describe('board store', () => {
  beforeEach(() => {
    resetBoardStore()
  })

  it('deletes connected edges when a node is removed and marks persistent boards dirty', () => {
    useBoardStore.getState().addNode({
      id: 'a',
      kind: 'leaf',
      type: 'text',
      position: { x: 0, y: 0 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('one')
    })
    useBoardStore.getState().addNode({
      id: 'b',
      kind: 'leaf',
      type: 'text',
      position: { x: 50, y: 10 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('two')
    })
    useBoardStore.getState().addEdge({ id: 'edge-1', from: 'a', to: 'b' })
    useBoardStore.getState().markSaved()

    useBoardStore.getState().deleteNode('a')

    const state = useBoardStore.getState()
    expect(state.nodes.map((node) => node.id)).toEqual(['b'])
    expect(state.edges).toEqual([])
    expect(state.isDirty).toBe(true)
  })

  it('does not mark transient boards dirty when mutating state', () => {
    useBoardStore.getState().setBoardPersistence('wbapp:boards/temp.wb.json', true)

    useBoardStore.getState().addNode({
      id: 'temp-node',
      kind: 'leaf',
      type: 'text',
      position: { x: 0, y: 0 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('draft')
    })

    const state = useBoardStore.getState()
    expect(state.transient).toBe(true)
    expect(state.isDirty).toBe(false)
  })

  it('treats explicit wrapWidth null as a real update when editing text nodes', () => {
    useBoardStore.getState().addNode({
      id: 'text-1',
      kind: 'leaf',
      type: 'text',
      position: { x: 0, y: 0 },
      size: { w: 200, h: 60 },
      content: makeLexicalContent('alpha'),
      widthMode: 'fixed',
      wrapWidth: 240
    })
    useBoardStore.getState().markSaved()

    useBoardStore.getState().updateNodeText('text-1', {
      content: makeLexicalContent('beta'),
      widthMode: 'auto',
      wrapWidth: null
    })

    const node = useBoardStore.getState().nodes[0]
    expect(node.content).toContain('beta')
    expect(node.widthMode).toBe('auto')
    expect(node.wrapWidth).toBeNull()
    expect(useBoardStore.getState().isDirty).toBe(true)
  })

  it('loads legacy boards, upgrades version, and hydrates missing authorship metadata', () => {
    const legacyBoard = {
      version: 2,
      nodes: [
        {
          id: 'legacy-node',
          kind: 'leaf',
          type: 'text',
          position: { x: 10, y: 20 },
          size: { w: 100, h: 30 },
          content: makeLexicalContent('legacy')
        }
      ],
      edges: []
    } as Board

    useBoardStore.getState().loadBoard(legacyBoard, 'D:/boards/legacy.wb.json')

    const state = useBoardStore.getState()
    expect(state.version).toBe(CURRENT_BOARD_VERSION)
    expect(state.path).toBe('D:/boards/legacy.wb.json')
    expect(state.isDirty).toBe(false)
    expect(state.nodes[0].createdBy).toBe(DEFAULT_USERNAME)
    expect(state.nodes[0].updatedBy).toBe(DEFAULT_USERNAME)
    expect(state.nodes[0].created.length).toBeGreaterThan(0)
    expect(state.nodes[0].updatedAt.length).toBeGreaterThan(0)
  })
})
