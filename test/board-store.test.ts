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

  it('sanitizes cluster children on load so only real nodes remain and membership stays exclusive', () => {
    const board = {
      version: CURRENT_BOARD_VERSION,
      nodes: [
        {
          id: 'node-a',
          kind: 'leaf',
          type: 'text',
          position: { x: 0, y: 0 },
          size: { w: 120, h: 40 },
          content: makeLexicalContent('alpha')
        },
        {
          id: 'node-b',
          kind: 'leaf',
          type: 'text',
          position: { x: 40, y: 20 },
          size: { w: 120, h: 40 },
          content: makeLexicalContent('beta')
        },
        {
          id: 'cluster-1',
          kind: 'cluster',
          type: null,
          position: { x: -20, y: -20 },
          size: { w: 240, h: 160 },
          label: 'One',
          color: 'blue',
          children: ['node-a', 'missing-node', 'node-a']
        },
        {
          id: 'cluster-2',
          kind: 'cluster',
          type: null,
          position: { x: 220, y: 0 },
          size: { w: 240, h: 160 },
          label: 'Two',
          color: 'pink',
          children: ['node-a', 'node-b']
        }
      ],
      edges: []
    } as Board

    useBoardStore.getState().loadBoard(board, 'D:/boards/clusters.wb.json')

    const state = useBoardStore.getState()
    const cluster1 = state.nodes.find((node) => node.id === 'cluster-1')
    const cluster2 = state.nodes.find((node) => node.id === 'cluster-2')

    expect(cluster1?.kind).toBe('cluster')
    expect(cluster2?.kind).toBe('cluster')
    if (cluster1?.kind !== 'cluster' || cluster2?.kind !== 'cluster') {
      throw new Error('Expected cluster nodes to load as clusters')
    }

    expect(cluster1.children).toEqual(['node-a'])
    expect(cluster2.children).toEqual(['node-b'])
  })

  it('removes deleted nodes from cluster membership', () => {
    useBoardStore.getState().addNode({
      id: 'node-a',
      kind: 'leaf',
      type: 'text',
      position: { x: 0, y: 0 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('alpha')
    })
    useBoardStore.getState().addNode({
      id: 'node-b',
      kind: 'leaf',
      type: 'text',
      position: { x: 40, y: 20 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('beta')
    })
    useBoardStore.getState().addCluster({
      id: 'cluster-1',
      kind: 'cluster',
      type: null,
      position: { x: -20, y: -20 },
      size: { w: 240, h: 160 },
      label: 'Main',
      color: 'blue',
      children: ['node-a', 'node-b']
    })
    useBoardStore.getState().markSaved()

    useBoardStore.getState().deleteNode('node-a')

    const cluster = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-1')
    expect(cluster?.kind).toBe('cluster')
    if (cluster?.kind !== 'cluster') {
      throw new Error('Expected cluster node to remain after deleting a child')
    }

    expect(cluster.children).toEqual(['node-b'])
    expect(useBoardStore.getState().isDirty).toBe(true)
  })

  it('reassigns a node to a new cluster exclusively', () => {
    useBoardStore.getState().addNode({
      id: 'node-a',
      kind: 'leaf',
      type: 'text',
      position: { x: 0, y: 0 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('alpha')
    })
    useBoardStore.getState().addCluster({
      id: 'cluster-1',
      kind: 'cluster',
      type: null,
      position: { x: -20, y: -20 },
      size: { w: 240, h: 160 },
      label: 'One',
      color: 'blue',
      children: ['node-a']
    })
    useBoardStore.getState().addCluster({
      id: 'cluster-2',
      kind: 'cluster',
      type: null,
      position: { x: 280, y: -20 },
      size: { w: 240, h: 160 },
      label: 'Two',
      color: 'pink',
      children: []
    })

    useBoardStore.getState().addNodeToCluster('cluster-2', 'node-a')

    const cluster1 = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-1')
    const cluster2 = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-2')
    expect(cluster1?.kind).toBe('cluster')
    expect(cluster2?.kind).toBe('cluster')
    if (cluster1?.kind !== 'cluster' || cluster2?.kind !== 'cluster') {
      throw new Error('Expected both clusters to remain')
    }

    expect(cluster1.children).toEqual([])
    expect(cluster2.children).toEqual(['node-a'])
  })

  it('assigns newly added nodes to the smallest containing cluster', () => {
    useBoardStore.getState().addCluster({
      id: 'cluster-outer',
      kind: 'cluster',
      type: null,
      position: { x: 0, y: 0 },
      size: { w: 400, h: 300 },
      label: 'Outer',
      color: 'blue',
      children: []
    })
    useBoardStore.getState().addCluster({
      id: 'cluster-inner',
      kind: 'cluster',
      type: null,
      position: { x: 100, y: 80 },
      size: { w: 180, h: 160 },
      label: 'Inner',
      color: 'pink',
      children: []
    })

    useBoardStore.getState().addNode({
      id: 'node-a',
      kind: 'leaf',
      type: 'text',
      position: { x: 120, y: 100 },
      size: { w: 80, h: 30 },
      content: makeLexicalContent('inside')
    })

    const outerCluster = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-outer')
    const innerCluster = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-inner')
    expect(outerCluster?.kind).toBe('cluster')
    expect(innerCluster?.kind).toBe('cluster')
    if (outerCluster?.kind !== 'cluster' || innerCluster?.kind !== 'cluster') {
      throw new Error('Expected both clusters to remain after adding a nested child')
    }

    expect(outerCluster.children).toEqual([])
    expect(innerCluster.children).toEqual(['node-a'])
  })

  it('lets explicit cluster assignment override inferred nested membership', () => {
    useBoardStore.getState().addCluster({
      id: 'cluster-outer',
      kind: 'cluster',
      type: null,
      position: { x: 0, y: 0 },
      size: { w: 400, h: 300 },
      label: 'Outer',
      color: 'blue',
      children: []
    })
    useBoardStore.getState().addCluster({
      id: 'cluster-inner',
      kind: 'cluster',
      type: null,
      position: { x: 100, y: 80 },
      size: { w: 180, h: 160 },
      label: 'Inner',
      color: 'pink',
      children: []
    })
    useBoardStore.getState().addNode({
      id: 'node-a',
      kind: 'leaf',
      type: 'text',
      position: { x: 120, y: 100 },
      size: { w: 80, h: 30 },
      content: makeLexicalContent('inside')
    })

    useBoardStore.getState().addNodeToCluster('cluster-outer', 'node-a')

    const outerCluster = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-outer')
    const innerCluster = useBoardStore.getState().nodes.find((node) => node.id === 'cluster-inner')
    expect(outerCluster?.kind).toBe('cluster')
    expect(innerCluster?.kind).toBe('cluster')
    if (outerCluster?.kind !== 'cluster' || innerCluster?.kind !== 'cluster') {
      throw new Error('Expected both clusters to remain after explicit reassignment')
    }

    expect(outerCluster.children).toEqual(['node-a'])
    expect(innerCluster.children).toEqual([])
  })

  it('translates a cluster and all of its children by the same delta', () => {
    useBoardStore.getState().addNode({
      id: 'node-a',
      kind: 'leaf',
      type: 'text',
      position: { x: 10, y: 20 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('alpha')
    })
    useBoardStore.getState().addNode({
      id: 'node-b',
      kind: 'leaf',
      type: 'text',
      position: { x: 90, y: 70 },
      size: { w: 120, h: 40 },
      content: makeLexicalContent('beta')
    })
    useBoardStore.getState().addCluster({
      id: 'cluster-1',
      kind: 'cluster',
      type: null,
      position: { x: 0, y: 0 },
      size: { w: 280, h: 180 },
      label: 'Main',
      color: 'green',
      children: ['node-a', 'node-b']
    })
    useBoardStore.getState().markSaved()

    useBoardStore.getState().translateCluster('cluster-1', 25, -10)

    const state = useBoardStore.getState()
    const cluster = state.nodes.find((node) => node.id === 'cluster-1')
    const nodeA = state.nodes.find((node) => node.id === 'node-a')
    const nodeB = state.nodes.find((node) => node.id === 'node-b')

    expect(cluster?.position).toEqual({ x: 25, y: -10 })
    expect(nodeA?.position).toEqual({ x: 35, y: 10 })
    expect(nodeB?.position).toEqual({ x: 115, y: 60 })
    expect(state.isDirty).toBe(true)
  })
})
