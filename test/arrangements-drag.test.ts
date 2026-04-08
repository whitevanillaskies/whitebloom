import { describe, expect, it } from 'vitest'
import {
  createArrangementsMaterialDropCommands,
  type ArrangementsMaterialDragPayload
} from '../src/renderer/src/components/arrangements/arrangementsDrag'

describe('arrangements drag semantics', () => {
  it('resolves desktop drops into explicit move-to-desktop commands', () => {
    const payload: ArrangementsMaterialDragPayload = {
      materialKeys: ['a', 'b'],
      primaryMaterialKey: 'a',
      source: { kind: 'bin', binId: 'bin-1' }
    }

    const commands = createArrangementsMaterialDropCommands(
      {
        pointer: {
          pointerId: 1,
          pointerType: 'mouse',
          screen: { x: 210, y: 170 }
        },
        target: {
          id: 'desktop',
          hostId: 'arrangements-desktop',
          acceptedPayloadKinds: ['arrangements-material'],
          bounds: { x: 10, y: 20, width: 800, height: 600 },
          meta: {
            type: 'desktop',
            camera: { x: 0, y: 0, zoom: 1 }
          },
          registeredAt: 1
        }
      },
      payload
    )

    expect(commands).toEqual([
      {
        kind: 'move-to-desktop',
        materialKey: 'a',
        position: { x: 200, y: 150 }
      },
      {
        kind: 'move-to-desktop',
        materialKey: 'b',
        position: { x: 222, y: 150 }
      }
    ])
  })

  it('treats dropping into the same bin as a no-op', () => {
    const payload: ArrangementsMaterialDragPayload = {
      materialKeys: ['a'],
      primaryMaterialKey: 'a',
      source: { kind: 'bin', binId: 'bin-1' }
    }

    const commands = createArrangementsMaterialDropCommands(
      {
        pointer: {
          pointerId: 1,
          pointerType: 'mouse',
          screen: { x: 50, y: 50 }
        },
        target: {
          id: 'bin-1',
          hostId: 'arrangements-desktop',
          acceptedPayloadKinds: ['arrangements-material'],
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          meta: {
            type: 'bin',
            binId: 'bin-1'
          },
          registeredAt: 1
        }
      },
      payload
    )

    expect(commands).toEqual([])
  })

  it('treats dropping into the same set as a no-op', () => {
    const payload: ArrangementsMaterialDragPayload = {
      materialKeys: ['a'],
      primaryMaterialKey: 'a',
      source: { kind: 'set', setId: 'set-1' }
    }

    const commands = createArrangementsMaterialDropCommands(
      {
        pointer: {
          pointerId: 1,
          pointerType: 'mouse',
          screen: { x: 50, y: 50 }
        },
        target: {
          id: 'set-1',
          hostId: 'arrangements-desktop',
          acceptedPayloadKinds: ['arrangements-material'],
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          meta: {
            type: 'set',
            setId: 'set-1'
          },
          registeredAt: 1
        }
      },
      payload
    )

    expect(commands).toEqual([])
  })

  it('preserves the pointer grab offset when moving a desktop item back onto the desktop', () => {
    const payload: ArrangementsMaterialDragPayload = {
      materialKeys: ['a'],
      primaryMaterialKey: 'a',
      source: { kind: 'desktop' },
      desktopDrag: {
        pointerOffset: { x: 30, y: 18 }
      }
    }

    const commands = createArrangementsMaterialDropCommands(
      {
        pointer: {
          pointerId: 1,
          pointerType: 'mouse',
          screen: { x: 210, y: 170 }
        },
        target: {
          id: 'desktop',
          hostId: 'arrangements-desktop',
          acceptedPayloadKinds: ['arrangements-material'],
          bounds: { x: 10, y: 20, width: 800, height: 600 },
          meta: {
            type: 'desktop',
            camera: { x: 0, y: 0, zoom: 1 }
          },
          registeredAt: 1
        }
      },
      payload
    )

    expect(commands).toEqual([
      {
        kind: 'move-to-desktop',
        materialKey: 'a',
        position: { x: 170, y: 132 }
      }
    ])
  })
})
