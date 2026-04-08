import { describe, expect, it } from 'vitest'
import { createMicaHostCoordinator } from '../src/renderer/src/mica/hostCoordinator'

type TestRoute =
  | {
      kind: 'bin-view'
      payload: { binId: string }
    }
  | {
      kind: 'inspector'
      payload: { materialKey: string }
    }

type TestUiState = {
  searchQuery: string
}

describe('mica host coordinator', () => {
  it('can be driven outside React while preserving host policy rules', () => {
    const coordinator = createMicaHostCoordinator<TestRoute, TestUiState>({
      hostId: 'arrangements-desktop',
      placementMode: 'screen-space',
      windowLimit: 'single',
      allowedKinds: ['bin-view']
    })

    const opened = coordinator.open({
      kind: 'bin-view',
      payload: { binId: 'bin-1' },
      geometry: {
        x: 10,
        y: 20,
        width: 400,
        height: 320
      },
      uiState: {
        searchQuery: ''
      }
    })

    expect(opened?.hostId).toBe('arrangements-desktop')
    expect(coordinator.getSnapshot().state.windows).toHaveLength(1)

    const blocked = coordinator.open({
      kind: 'inspector',
      payload: { materialKey: 'wloc:res/test.png' },
      geometry: {
        x: 30,
        y: 40,
        width: 280,
        height: 180
      },
      uiState: {
        searchQuery: 'ignored'
      }
    })

    expect(blocked).toBeNull()
    expect(coordinator.getSnapshot().state.windows).toHaveLength(1)
  })

  it('supports retargeting and movement through a pure coordinator snapshot', () => {
    const coordinator = createMicaHostCoordinator<TestRoute, TestUiState>({
      hostId: 'arrangements-desktop',
      placementMode: 'screen-space',
      windowLimit: 'single',
      allowedKinds: ['bin-view']
    })

    const opened = coordinator.open({
      id: 'window-1',
      kind: 'bin-view',
      payload: { binId: 'bin-1' },
      geometry: {
        x: 10,
        y: 20,
        width: 400,
        height: 320
      },
      uiState: {
        searchQuery: ''
      }
    })

    expect(opened?.payload.binId).toBe('bin-1')

    coordinator.retarget(
      'window-1',
      {
        kind: 'bin-view',
        payload: { binId: 'bin-2' }
      },
      {
        uiState: (current) => ({
          ...current,
          searchQuery: 'fresh'
        })
      }
    )
    coordinator.move('window-1', { x: 80, y: 120 })

    const snapshot = coordinator.getSnapshot()
    expect(snapshot.state.activeWindowId).toBe('window-1')
    expect(snapshot.state.windows[0]).toMatchObject({
      payload: { binId: 'bin-2' },
      uiState: { searchQuery: 'fresh' },
      geometry: {
        x: 80,
        y: 120,
        width: 400,
        height: 320
      }
    })
  })

  it('returns a stable snapshot reference until state changes', () => {
    const coordinator = createMicaHostCoordinator<TestRoute, TestUiState>({
      hostId: 'arrangements-desktop',
      placementMode: 'screen-space',
      windowLimit: 'single',
      allowedKinds: ['bin-view']
    })

    const initialSnapshot = coordinator.getSnapshot()
    expect(coordinator.getSnapshot()).toBe(initialSnapshot)

    coordinator.open({
      id: 'window-1',
      kind: 'bin-view',
      payload: { binId: 'bin-1' },
      geometry: {
        x: 10,
        y: 20,
        width: 400,
        height: 320
      },
      uiState: {
        searchQuery: ''
      }
    })

    const updatedSnapshot = coordinator.getSnapshot()
    expect(updatedSnapshot).not.toBe(initialSnapshot)
    expect(coordinator.getSnapshot()).toBe(updatedSnapshot)
  })
})
