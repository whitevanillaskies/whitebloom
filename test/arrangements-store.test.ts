import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyGardenState, SYSTEM_TRASH_BIN_ID } from '../src/shared/arrangements'
import { useArrangementsStore } from '../src/renderer/src/stores/arrangements'
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace'

function resetWorkspaceStore(): void {
  useWorkspaceStore.setState({
    root: null,
    config: null,
    boards: []
  })
}

function resetArrangementsStore(): void {
  const empty = createEmptyGardenState()
  useArrangementsStore.setState({
    materials: [],
    bins: empty.bins,
    sets: empty.sets,
    memberships: empty.memberships,
    binAssignments: empty.binAssignments,
    desktopPlacements: empty.desktopPlacements,
    cameraState: empty.cameraState,
    activeBinView: null,
    isHydrated: false
  })
}

beforeEach(() => {
  resetWorkspaceStore()
  resetArrangementsStore()

  vi.stubGlobal('window', {
    api: {
      readArrangements: vi.fn(async () => ({ ok: true, state: createEmptyGardenState() })),
      saveArrangements: vi.fn(async (_workspaceRoot: string, state: unknown) => ({ ok: true, state })),
      enumerateArrangementsMaterial: vi.fn(async () => ({ ok: true, materials: [] })),
      emptyArrangementsTrash: vi.fn(async () => ({ ok: true }))
    }
  })
})

describe('arrangements store', () => {
  it('loads materials and persisted garden state for the active workspace', async () => {
    useWorkspaceStore.setState({ root: 'D:/workspace' })
    ;(window.api.readArrangements as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      state: {
        ...createEmptyGardenState(),
        bins: [
          { id: SYSTEM_TRASH_BIN_ID, name: 'Trash', kind: 'system' },
          { id: 'refs', name: 'Refs', kind: 'user' }
        ],
        cameraState: { x: 12, y: 24, zoom: 1.5 },
        trashContents: ['wloc:res/old.png']
      }
    })
    ;(window.api.enumerateArrangementsMaterial as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      materials: [
        { key: 'wloc:board.wb.json', kind: 'board', displayName: 'board', extension: '.wb.json' },
        { key: 'wloc:res/old.png', kind: 'resource', displayName: 'old', extension: '.png' }
      ]
    })

    const ok = await useArrangementsStore.getState().loadArrangements()

    expect(ok).toBe(true)
    expect(useArrangementsStore.getState().isHydrated).toBe(true)
    expect(useArrangementsStore.getState().materials).toHaveLength(2)
    expect(useArrangementsStore.getState().binAssignments['wloc:res/old.png']).toBe(
      SYSTEM_TRASH_BIN_ID
    )
    expect(useArrangementsStore.getState().cameraState.zoom).toBe(1.5)
  })

  it('creates bins and sets, manages memberships, and keeps trash exclusive', () => {
    const binId = useArrangementsStore.getState().createBin('Inbox')
    expect(binId).toBeTruthy()
    if (!binId) throw new Error('Expected bin id')

    useArrangementsStore.setState({
      materials: [
        { key: 'wloc:res/file.png', kind: 'resource', displayName: 'file', extension: '.png' }
      ]
    })

    useArrangementsStore.getState().assignToBin('wloc:res/file.png', binId)
    expect(useArrangementsStore.getState().binAssignments['wloc:res/file.png']).toBe(binId)

    const setId = useArrangementsStore.getState().createSet('Research')
    expect(setId).toBeTruthy()
    if (!setId) throw new Error('Expected set id')

    useArrangementsStore.getState().addToSet('wloc:res/file.png', setId)
    useArrangementsStore.getState().sendToTrash('wloc:res/file.png')

    expect(useArrangementsStore.getState().binAssignments['wloc:res/file.png']).toBe(
      SYSTEM_TRASH_BIN_ID
    )
    expect(useArrangementsStore.getState().memberships).toEqual([
      { materialKey: 'wloc:res/file.png', setId }
    ])
  })

  it('returns null when asked to create a nested set under a missing parent', () => {
    const setId = useArrangementsStore.getState().createSet('Child set', 'missing-parent')

    expect(setId).toBeNull()
    expect(useArrangementsStore.getState().sets).toEqual([])
  })

  it('empties trash through IPC, removes trashed materials, and persists the new garden state', async () => {
    useWorkspaceStore.setState({ root: 'D:/workspace' })
    useArrangementsStore.setState({
      materials: [
        { key: 'wloc:res/keep.png', kind: 'resource', displayName: 'keep', extension: '.png' },
        { key: 'wloc:res/trash.png', kind: 'resource', displayName: 'trash', extension: '.png' }
      ],
      binAssignments: {
        'wloc:res/trash.png': SYSTEM_TRASH_BIN_ID,
        'wloc:res/keep.png': 'bin-1'
      },
      memberships: [{ materialKey: 'wloc:res/trash.png', setId: 'set-1' }],
      desktopPlacements: { 'wloc:res/trash.png': { x: 5, y: 6 } },
      activeBinView: SYSTEM_TRASH_BIN_ID
    })

    const ok = await useArrangementsStore.getState().emptyTrash()

    expect(ok).toBe(true)
    expect(window.api.emptyArrangementsTrash).toHaveBeenCalledWith('D:/workspace', [
      'wloc:res/trash.png'
    ])
    expect(window.api.saveArrangements).toHaveBeenCalled()
    expect(useArrangementsStore.getState().materials).toEqual([
      { key: 'wloc:res/keep.png', kind: 'resource', displayName: 'keep', extension: '.png' }
    ])
    expect(useArrangementsStore.getState().memberships).toEqual([])
    expect(useArrangementsStore.getState().activeBinView).toBeNull()
  })

  it('saves the persisted garden shape without duplicating trash assignments', async () => {
    useWorkspaceStore.setState({ root: 'D:/workspace' })
    useArrangementsStore.setState({
      materials: [
        { key: 'wloc:res/keep.png', kind: 'resource', displayName: 'keep', extension: '.png' },
        { key: 'wloc:res/trash.png', kind: 'resource', displayName: 'trash', extension: '.png' }
      ],
      bins: [
        { id: SYSTEM_TRASH_BIN_ID, name: 'Trash', kind: 'system' },
        { id: 'bin-1', name: 'Inbox', kind: 'user' }
      ],
      sets: [{ id: 'set-1', name: 'Research', children: [] }],
      memberships: [{ materialKey: 'wloc:res/keep.png', setId: 'set-1' }],
      binAssignments: {
        'wloc:res/keep.png': 'bin-1',
        'wloc:res/trash.png': SYSTEM_TRASH_BIN_ID
      },
      desktopPlacements: {
        'wloc:res/keep.png': { x: 10, y: 20 },
        'bin:bin-1': { x: 100, y: 200 }
      },
      cameraState: { x: 1, y: 2, zoom: 1.25 }
    })

    const ok = await useArrangementsStore.getState().saveArrangements()

    expect(ok).toBe(true)
    expect(window.api.saveArrangements).toHaveBeenCalledWith('D:/workspace', {
      version: 1,
      bins: [
        { id: SYSTEM_TRASH_BIN_ID, name: 'Trash', kind: 'system' },
        { id: 'bin-1', name: 'Inbox', kind: 'user' }
      ],
      sets: [{ id: 'set-1', name: 'Research', children: [] }],
      memberships: [{ materialKey: 'wloc:res/keep.png', setId: 'set-1' }],
      binAssignments: {
        'wloc:res/keep.png': 'bin-1'
      },
      desktopPlacements: {
        'wloc:res/keep.png': { x: 10, y: 20 },
        'bin:bin-1': { x: 100, y: 200 }
      },
      cameraState: { x: 1, y: 2, zoom: 1.25 },
      trashContents: ['wloc:res/trash.png']
    })
  })
})
