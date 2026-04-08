import { beforeEach, describe, expect, it } from 'vitest'
import { MICA_DRAG_COORDINATE_SPACE, useMicaDragStore } from '../src/renderer/src/mica/drag'

function resetMicaDragStore(): void {
  useMicaDragStore.getState().reset()
}

beforeEach(() => {
  resetMicaDragStore()
})

describe('mica drag store', () => {
  it('starts and updates a screen-space drag session', () => {
    useMicaDragStore.getState().registerDropTarget(
      {
        id: 'desktop-target',
        hostId: 'arrangements-desktop',
        acceptedPayloadKinds: ['arrangements-material'],
        bounds: {
          x: 100,
          y: 150,
          width: 100,
          height: 100
        }
      },
      10
    )

    const session = useMicaDragStore.getState().startDrag({
      sessionId: 'drag-1',
      payload: {
        kind: 'arrangements-material',
        data: { materialKeys: ['wloc:res/test.png'] }
      },
      source: {
        context: 'desktop',
        data: { hostId: 'arrangements-desktop' }
      },
      pointer: {
        pointerId: 7,
        pointerType: 'mouse',
        screen: { x: 120, y: 180 },
        client: { x: 20, y: 30 }
      },
      startedAt: 1234
    })

    expect(session.coordinateSpace).toBe(MICA_DRAG_COORDINATE_SPACE)
    expect(session.origin).toEqual({ x: 120, y: 180 })
    expect(useMicaDragStore.getState().session?.payload.kind).toBe('arrangements-material')
    expect(useMicaDragStore.getState().activeTargetId).toBe('desktop-target')

    useMicaDragStore.getState().updateDrag({
      pointerId: 7,
      pointerType: 'mouse',
      screen: { x: 160, y: 220 },
      client: { x: 60, y: 70 }
    })

    expect(useMicaDragStore.getState().session?.pointer.screen).toEqual({ x: 160, y: 220 })
    expect(useMicaDragStore.getState().activeTargetId).toBe('desktop-target')
  })

  it('tracks hover state separately from the active session and clears it on completion', () => {
    useMicaDragStore.getState().startDrag({
      sessionId: 'drag-2',
      payload: {
        kind: 'arrangements-material',
        data: { materialKeys: ['wloc:res/test.png'] }
      },
      source: {
        context: 'bin',
        data: { binId: 'bin-1' }
      },
      pointer: {
        pointerId: 11,
        pointerType: 'mouse',
        screen: { x: 12, y: 24 }
      }
    })

    useMicaDragStore.getState().setHoverTarget('target-bin-2', 999)
    expect(useMicaDragStore.getState().hover).toEqual({
      targetId: 'target-bin-2',
      enteredAt: 999
    })

    const completed = useMicaDragStore.getState().completeDrag()

    expect(completed?.id).toBe('drag-2')
    expect(useMicaDragStore.getState().session).toBeNull()
    expect(useMicaDragStore.getState().hover).toEqual({
      targetId: null,
      enteredAt: null
    })
  })

  it('registers and updates drop target descriptors without losing registration metadata', () => {
    useMicaDragStore.getState().registerDropTarget(
      {
        id: 'desktop-target',
        hostId: 'arrangements-desktop',
        acceptedPayloadKinds: ['arrangements-material'],
        bounds: {
          x: 10,
          y: 20,
          width: 300,
          height: 200
        }
      },
      500
    )

    useMicaDragStore.getState().updateDropTarget('desktop-target', {
      bounds: {
        x: 15,
        y: 25,
        width: 320,
        height: 240
      },
      disabled: true
    })

    expect(useMicaDragStore.getState().targets['desktop-target']).toEqual({
      id: 'desktop-target',
      hostId: 'arrangements-desktop',
      acceptedPayloadKinds: ['arrangements-material'],
      bounds: {
        x: 15,
        y: 25,
        width: 320,
        height: 240
      },
      disabled: true,
      registeredAt: 500
    })
  })

  it('hit-tests only compatible targets and prefers the most recently registered overlap', () => {
    useMicaDragStore.getState().registerDropTarget(
      {
        id: 'older-target',
        hostId: 'arrangements-desktop',
        acceptedPayloadKinds: ['arrangements-material'],
        bounds: {
          x: 0,
          y: 0,
          width: 120,
          height: 120
        }
      },
      100
    )

    useMicaDragStore.getState().registerDropTarget(
      {
        id: 'newer-target',
        hostId: 'arrangements-desktop',
        acceptedPayloadKinds: ['arrangements-material'],
        bounds: {
          x: 0,
          y: 0,
          width: 120,
          height: 120
        }
      },
      200
    )

    useMicaDragStore.getState().registerDropTarget(
      {
        id: 'board-target',
        hostId: 'arrangements-desktop',
        acceptedPayloadKinds: ['board-node'],
        bounds: {
          x: 0,
          y: 0,
          width: 120,
          height: 120
        }
      },
      300
    )

    useMicaDragStore.getState().startDrag({
      sessionId: 'drag-3',
      payload: {
        kind: 'arrangements-material',
        data: { materialKeys: ['wloc:res/test.png'] }
      },
      source: {
        context: 'desktop'
      },
      pointer: {
        pointerId: 2,
        pointerType: 'mouse',
        screen: { x: 40, y: 40 }
      }
    })

    expect(useMicaDragStore.getState().hitTestTargets().targetId).toBe('newer-target')
    expect(useMicaDragStore.getState().activeTargetId).toBe('newer-target')

    useMicaDragStore.getState().updateDropTarget('newer-target', {
      disabled: true
    })

    expect(useMicaDragStore.getState().hitTestTargets().targetId).toBe('older-target')
    expect(useMicaDragStore.getState().activeTargetId).toBe('older-target')
  })
})
