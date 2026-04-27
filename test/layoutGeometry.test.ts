import { describe, expect, it } from 'vitest'
import {
  alignNodes,
  computeSmartGuideSnap,
  constrainDeltaAlongStraightConnections,
  distributeNodes,
  getSelectionBounds,
  gridifyNodes,
  layoutNodesInGrid,
  smartStraightenNodes,
  type LayoutNode
} from '../src/renderer/src/canvas/layoutGeometry'

const node = (id: string, x: number, y: number, w = 40, h = 20): LayoutNode => ({
  id,
  position: { x, y },
  size: { w, h }
})

describe('layoutGeometry', () => {
  it('computes selection bounds across nodes', () => {
    expect(getSelectionBounds([node('a', 10, 20), node('b', 80, 5, 10, 30)])).toEqual({
      left: 10,
      top: 5,
      right: 90,
      bottom: 40,
      centerX: 50,
      centerY: 22.5,
      width: 80,
      height: 35
    })
  })

  it('snaps a moving selection to nearby target centers and reports guides', () => {
    const snap = computeSmartGuideSnap({
      movingNodes: [node('moving', 0, 0, 50, 20)],
      stationaryNodes: [node('target', 95, 100, 50, 20)],
      proposedDelta: { x: 96, y: 103 },
      threshold: 6
    })

    expect(snap.delta).toEqual({ x: 95, y: 100 })
    expect(snap.guides).toEqual([
      expect.objectContaining({
        axis: 'x',
        source: 'start',
        target: 'start',
        targetNodeId: 'target',
        value: 95
      }),
      expect.objectContaining({
        axis: 'y',
        source: 'start',
        target: 'start',
        targetNodeId: 'target',
        value: 100
      })
    ])
  })

  it('aligns nodes against selection extremes and centers', () => {
    const nodes = [node('a', 10, 20, 40, 20), node('b', 90, 40, 20, 20)]

    expect(alignNodes(nodes, 'right')).toEqual(
      new Map([
        ['a', { x: 70, y: 20 }],
        ['b', { x: 90, y: 40 }]
      ])
    )
    expect(alignNodes(nodes, 'vertical-center')).toEqual(
      new Map([
        ['a', { x: 10, y: 30 }],
        ['b', { x: 90, y: 30 }]
      ])
    )
  })

  it('distributes node centers along an axis', () => {
    const positions = distributeNodes([node('a', 0, 0), node('b', 100, 0), node('c', 260, 0)], 'x')

    expect(positions).toEqual(
      new Map([
        ['a', { x: 0, y: 0 }],
        ['b', { x: 130, y: 0 }],
        ['c', { x: 260, y: 0 }]
      ])
    )
  })

  it('snaps node positions to a grid', () => {
    expect(gridifyNodes([node('a', 13, 37), node('b', 62, 88)], 25)).toEqual(
      new Map([
        ['a', { x: 25, y: 25 }],
        ['b', { x: 50, y: 100 }]
      ])
    )
  })

  it('lays out nodes into a regular grid preserving spatial order', () => {
    const positions = layoutNodesInGrid(
      [node('a', 100, 0, 50, 20), node('b', 0, 0, 30, 20), node('c', 40, 80, 40, 20)],
      { columns: 2, gapX: 10, gapY: 5 }
    )

    expect(positions).toEqual(
      new Map([
        ['b', { x: 0, y: 0 }],
        ['a', { x: 60, y: 0 }],
        ['c', { x: 0, y: 25 }]
      ])
    )
  })

  it('straightens connected near-horizontal and near-vertical groups', () => {
    const nodes = [
      node('a', 0, 3, 20, 20),
      node('b', 100, -3, 20, 20),
      node('c', 300, 0, 20, 20),
      node('d', 304, 120, 20, 20)
    ]
    const positions = smartStraightenNodes(
      nodes,
      [
        { from: 'a', to: 'b' },
        { from: 'c', to: 'd' }
      ],
      { threshold: 10 }
    )

    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('b')).toEqual({ x: 100, y: 0 })
    expect(positions.get('c')).toEqual({ x: 302, y: 0 })
    expect(positions.get('d')).toEqual({ x: 302, y: 120 })
  })

  it('constrains drag deltas along straight connected neighbors', () => {
    const nodes = [node('a', 0, 0), node('b', 100, 4)]
    const constraint = constrainDeltaAlongStraightConnections({
      nodeIds: ['a'],
      nodes,
      edges: [{ from: 'a', to: 'b' }],
      proposedDelta: { x: 12, y: 50 },
      threshold: 8
    })

    expect(constraint).toEqual({
      axis: 'horizontal',
      delta: { x: 12, y: 0 }
    })
  })
})
