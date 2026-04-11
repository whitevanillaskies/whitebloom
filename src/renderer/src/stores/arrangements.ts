import { create } from 'zustand'
import type {
  ArrangementsMaterial,
  ArrangementsMaterialKey,
  GardenBin,
  GardenCameraState,
  GardenMembership,
  GardenPoint,
  GardenSetNode
} from '../../../shared/arrangements'
import { createEmptyGardenState, CURRENT_GARDEN_VERSION, SYSTEM_TRASH_BIN_ID } from '../../../shared/arrangements'
import { useWorkspaceStore } from './workspace'

type ArrangementsState = {
  materials: ArrangementsMaterial[]
  bins: GardenBin[]
  sets: GardenSetNode[]
  memberships: GardenMembership[]
  binAssignments: Record<ArrangementsMaterialKey, string>
  desktopPlacements: Record<string, GardenPoint>
  cameraState: GardenCameraState
  pendingRenameTarget: { kind: 'bin' | 'set'; id: string } | null
  isHydrated: boolean
  loadArrangements: () => Promise<boolean>
  saveArrangements: () => Promise<boolean>
  assignToBin: (materialKey: ArrangementsMaterialKey, binId: string) => void
  removeFromBin: (materialKey: ArrangementsMaterialKey) => void
  addToSet: (materialKey: ArrangementsMaterialKey, setId: string) => void
  removeFromSet: (materialKey: ArrangementsMaterialKey, setId: string) => void
  moveMaterialOnDesktop: (materialKey: ArrangementsMaterialKey, position: GardenPoint) => void
  moveBinOnDesktop: (binId: string, position: GardenPoint) => void
  sendToTrash: (materialKey: ArrangementsMaterialKey) => void
  emptyTrash: () => Promise<boolean>
  createBin: (name: string) => string | null
  createBinAtPoint: (position: GardenPoint, name?: string) => Promise<string | null>
  createBinAtViewportCenter: (
    viewport: { width: number; height: number },
    name?: string
  ) => Promise<string | null>
  renameBin: (binId: string, name: string) => Promise<boolean>
  deleteBin: (binId: string) => void
  createSet: (name: string, parentSetId?: string | null) => string | null
  createRootSet: (name?: string) => Promise<string | null>
  createChildSet: (parentSetId: string, name?: string) => Promise<string | null>
  renameSet: (setId: string, name: string) => Promise<boolean>
  deleteSet: (setId: string) => void
  markPendingRenameTarget: (target: { kind: 'bin' | 'set'; id: string } | null) => void
  setCamera: (cameraState: GardenCameraState) => void
  clearArrangements: () => void
}

function getEmptyArrangementsState(): Omit<ArrangementsState, keyof Pick<ArrangementsState,
  | 'loadArrangements'
  | 'saveArrangements'
  | 'assignToBin'
  | 'removeFromBin'
  | 'addToSet'
  | 'removeFromSet'
  | 'moveMaterialOnDesktop'
  | 'moveBinOnDesktop'
  | 'sendToTrash'
  | 'emptyTrash'
  | 'createBin'
  | 'createBinAtPoint'
  | 'createBinAtViewportCenter'
  | 'renameBin'
  | 'deleteBin'
  | 'createSet'
  | 'createRootSet'
  | 'createChildSet'
  | 'renameSet'
  | 'deleteSet'
  | 'markPendingRenameTarget'
  | 'setCamera'
  | 'clearArrangements'
>> {
  const emptyGarden = createEmptyGardenState()
  return {
    materials: [],
    bins: emptyGarden.bins,
    sets: emptyGarden.sets,
    memberships: emptyGarden.memberships,
    binAssignments: emptyGarden.binAssignments,
    desktopPlacements: emptyGarden.desktopPlacements,
    cameraState: emptyGarden.cameraState,
    pendingRenameTarget: null,
    isHydrated: false
  }
}

function toBinPlacementKey(binId: string): string {
  return `bin:${binId}`
}

function collectSetIds(sets: GardenSetNode[], output: Set<string> = new Set<string>()): Set<string> {
  for (const set of sets) {
    output.add(set.id)
    collectSetIds(set.children, output)
  }
  return output
}

function collectSetIdsFromNode(setNode: GardenSetNode, output: Set<string> = new Set<string>()): Set<string> {
  output.add(setNode.id)
  for (const child of setNode.children) {
    collectSetIdsFromNode(child, output)
  }
  return output
}

function insertSetNode(
  sets: GardenSetNode[],
  parentSetId: string,
  nextSet: GardenSetNode
): GardenSetNode[] {
  let changed = false

  const result = sets.map((setNode) => {
    if (setNode.id === parentSetId) {
      changed = true
      return { ...setNode, children: [...setNode.children, nextSet] }
    }

    const nextChildren = insertSetNode(setNode.children, parentSetId, nextSet)
    if (nextChildren === setNode.children) return setNode

    changed = true
    return { ...setNode, children: nextChildren }
  })

  return changed ? result : sets
}

function removeSetNode(
  sets: GardenSetNode[],
  setId: string
): { nextSets: GardenSetNode[]; removed: GardenSetNode | null } {
  for (const setNode of sets) {
    if (setNode.id === setId) {
      return {
        nextSets: sets.filter((candidate) => candidate.id !== setId),
        removed: setNode
      }
    }
  }

  let removed: GardenSetNode | null = null
  const nextSets = sets.map((setNode) => {
    const result = removeSetNode(setNode.children, setId)
    if (!result.removed) return setNode
    removed = result.removed
    return { ...setNode, children: result.nextSets }
  })

  return removed ? { nextSets, removed } : { nextSets: sets, removed: null }
}

function renameSetNode(
  sets: GardenSetNode[],
  setId: string,
  name: string
): GardenSetNode[] {
  let changed = false

  const nextSets = sets.map((setNode) => {
    if (setNode.id === setId) {
      changed = true
      return {
        ...setNode,
        name
      }
    }

    const nextChildren = renameSetNode(setNode.children, setId, name)
    if (nextChildren === setNode.children) return setNode

    changed = true
    return {
      ...setNode,
      children: nextChildren
    }
  })

  return changed ? nextSets : sets
}

function buildPersistedGardenState(state: ArrangementsState) {
  return {
    version: CURRENT_GARDEN_VERSION,
    bins: state.bins,
    sets: state.sets,
    memberships: state.memberships,
    binAssignments: Object.fromEntries(
      Object.entries(state.binAssignments).filter(([, binId]) => binId !== SYSTEM_TRASH_BIN_ID)
    ) as Record<ArrangementsMaterialKey, string>,
    desktopPlacements: state.desktopPlacements,
    cameraState: state.cameraState,
    trashContents: state.materials
      .map((material) => material.key)
      .filter((materialKey) => state.binAssignments[materialKey] === SYSTEM_TRASH_BIN_ID)
  }
}

function getTrashContents(state: Pick<ArrangementsState, 'binAssignments'>): ArrangementsMaterialKey[] {
  return Object.entries(state.binAssignments)
    .filter(([, binId]) => binId === SYSTEM_TRASH_BIN_ID)
    .map(([materialKey]) => materialKey)
}

let arrangementsSavePromise: Promise<boolean> | null = null
let arrangementsSaveQueued = false

async function performArrangementsSave(): Promise<boolean> {
  const workspaceRoot = useWorkspaceStore.getState().root
  if (!workspaceRoot) return false

  const result = await window.api.saveArrangements(
    workspaceRoot,
    buildPersistedGardenState(useArrangementsStore.getState())
  )
  return result.ok
}

function requestArrangementsSave(): Promise<boolean> {
  if (arrangementsSavePromise) {
    arrangementsSaveQueued = true
    return arrangementsSavePromise
  }

  arrangementsSavePromise = (async () => {
    let lastResult = false

    try {
      do {
        arrangementsSaveQueued = false
        lastResult = await performArrangementsSave()
      } while (arrangementsSaveQueued)

      return lastResult
    } finally {
      arrangementsSavePromise = null
    }
  })()

  return arrangementsSavePromise
}

export const useArrangementsStore = create<ArrangementsState>((set, get) => ({
  ...getEmptyArrangementsState(),

  loadArrangements: async () => {
    const workspaceRoot = useWorkspaceStore.getState().root
    if (!workspaceRoot) {
      set(getEmptyArrangementsState())
      return false
    }

    const [materialsResult, stateResult] = await Promise.all([
      window.api.enumerateArrangementsMaterial(workspaceRoot),
      window.api.readArrangements(workspaceRoot)
    ])

    if (!materialsResult.ok || !stateResult.ok || !stateResult.state) {
      set({ ...getEmptyArrangementsState(), isHydrated: true })
      return false
    }

    const trashAssignments = Object.fromEntries(
      stateResult.state.trashContents.map((materialKey) => [materialKey, SYSTEM_TRASH_BIN_ID] as const)
    )

    set({
      materials: materialsResult.materials,
      bins: stateResult.state.bins,
      sets: stateResult.state.sets,
      memberships: stateResult.state.memberships,
      binAssignments: {
        ...stateResult.state.binAssignments,
        ...trashAssignments
      },
      desktopPlacements: stateResult.state.desktopPlacements,
      cameraState: stateResult.state.cameraState,
      isHydrated: true
    })

    return true
  },

  saveArrangements: async () => {
    return requestArrangementsSave()
  },

  assignToBin: (materialKey, binId) =>
    set((state) => {
      if (binId === SYSTEM_TRASH_BIN_ID) {
        return {
          binAssignments: {
            ...state.binAssignments,
            [materialKey]: SYSTEM_TRASH_BIN_ID
          }
        }
      }

      if (!state.bins.some((bin) => bin.id === binId && bin.kind === 'user')) return state
      return {
        binAssignments: {
          ...state.binAssignments,
          [materialKey]: binId
        }
      }
    }),

  removeFromBin: (materialKey) =>
    set((state) => {
      if (!(materialKey in state.binAssignments)) return state
      const nextAssignments = { ...state.binAssignments }
      delete nextAssignments[materialKey]
      return { binAssignments: nextAssignments }
    }),

  addToSet: (materialKey, setId) =>
    set((state) => {
      const validSetIds = collectSetIds(state.sets)
      if (!validSetIds.has(setId)) return state
      if (state.memberships.some((membership) => membership.materialKey === materialKey && membership.setId === setId)) {
        return state
      }

      return {
        memberships: [...state.memberships, { materialKey, setId }]
      }
    }),

  removeFromSet: (materialKey, setId) =>
    set((state) => ({
      memberships: state.memberships.filter(
        (membership) => !(membership.materialKey === materialKey && membership.setId === setId)
      )
    })),

  moveMaterialOnDesktop: (materialKey, position) =>
    set((state) => ({
      desktopPlacements: {
        ...state.desktopPlacements,
        [materialKey]: position
      }
    })),

  moveBinOnDesktop: (binId, position) =>
    set((state) => ({
      desktopPlacements: {
        ...state.desktopPlacements,
        [toBinPlacementKey(binId)]: position
      }
    })),

  sendToTrash: (materialKey) =>
    set((state) => ({
      binAssignments: {
        ...state.binAssignments,
        [materialKey]: SYSTEM_TRASH_BIN_ID
      }
    })),

  emptyTrash: async () => {
    const workspaceRoot = useWorkspaceStore.getState().root
    if (!workspaceRoot) return false

    const trashContents = getTrashContents(get())
    const result = await window.api.emptyArrangementsTrash(workspaceRoot, trashContents)
    if (!result.ok) return false

    set((state) => {
      const trashed = new Set(trashContents)
      const nextAssignments = { ...state.binAssignments }
      const nextPlacements = { ...state.desktopPlacements }

      for (const materialKey of trashContents) {
        delete nextAssignments[materialKey]
        delete nextPlacements[materialKey]
      }

      return {
        materials: state.materials.filter((material) => !trashed.has(material.key)),
        memberships: state.memberships.filter((membership) => !trashed.has(membership.materialKey)),
        binAssignments: nextAssignments,
        desktopPlacements: nextPlacements
      }
    })

    await get().saveArrangements()
    return true
  },

  createBin: (name) => {
    const normalizedName = name.trim()
    if (!normalizedName) return null

    const id = crypto.randomUUID()
    set((state) => ({
      bins: [...state.bins, { id, name: normalizedName, kind: 'user' }],
      pendingRenameTarget: {
        kind: 'bin',
        id
      }
    }))
    return id
  },

  createBinAtPoint: async (position, name = 'New Bin') => {
    const binId = get().createBin(name)
    if (!binId) return null

    set((state) => ({
      desktopPlacements: {
        ...state.desktopPlacements,
        [toBinPlacementKey(binId)]: position
      }
    }))

    await get().saveArrangements()
    return binId
  },

  createBinAtViewportCenter: async (viewport, name = 'New Bin') => {
    const { cameraState } = get()
    const center = {
      x: (viewport.width * 0.5 - cameraState.x) / cameraState.zoom,
      y: (viewport.height * 0.5 - cameraState.y) / cameraState.zoom
    }

    return get().createBinAtPoint(center, name)
  },

  renameBin: async (binId, name) => {
    const normalizedName = name.trim()
    if (!normalizedName) return false

    let renamed = false
    set((state) => {
      const existingBin = state.bins.find((bin) => bin.id === binId && bin.kind === 'user')
      if (!existingBin) return state

      renamed = true
      return {
        bins:
          existingBin.name === normalizedName
            ? state.bins
            : state.bins.map((bin) =>
                bin.id === binId
                  ? {
                      ...bin,
                      name: normalizedName
                    }
                  : bin
              ),
        pendingRenameTarget:
          state.pendingRenameTarget?.kind === 'bin' && state.pendingRenameTarget.id === binId
            ? null
            : state.pendingRenameTarget
      }
    })

    if (!renamed) return false
    await get().saveArrangements()
    return true
  },

  deleteBin: (binId) =>
    set((state) => {
      if (binId === SYSTEM_TRASH_BIN_ID) return state
      if (!state.bins.some((bin) => bin.id === binId)) return state

      const nextAssignments = Object.fromEntries(
        Object.entries(state.binAssignments).filter(([, assignedBinId]) => assignedBinId !== binId)
      ) as Record<ArrangementsMaterialKey, string>
      const nextPlacements = { ...state.desktopPlacements }
      delete nextPlacements[toBinPlacementKey(binId)]

      return {
        bins: state.bins.filter((bin) => bin.id !== binId),
        binAssignments: nextAssignments,
        desktopPlacements: nextPlacements,
        pendingRenameTarget:
          state.pendingRenameTarget?.kind === 'bin' && state.pendingRenameTarget.id === binId
            ? null
            : state.pendingRenameTarget
      }
    }),

  createSet: (name, parentSetId) => {
    const normalizedName = name.trim()
    if (!normalizedName) return null

    const nextSet: GardenSetNode = {
      id: crypto.randomUUID(),
      name: normalizedName,
      children: []
    }

    let created = false

    set((state) => {
      if (!parentSetId) {
        created = true
        return {
          sets: [...state.sets, nextSet],
          pendingRenameTarget: {
            kind: 'set',
            id: nextSet.id
          }
        }
      }

      const nextSets = insertSetNode(state.sets, parentSetId, nextSet)
      if (nextSets !== state.sets) {
        created = true
      }
      return nextSets === state.sets
        ? state
        : {
            sets: nextSets,
            pendingRenameTarget: {
              kind: 'set',
              id: nextSet.id
            }
          }
    })

    return created ? nextSet.id : null
  },

  createRootSet: async (name = 'New Set') => {
    const setId = get().createSet(name)
    if (!setId) return null

    await get().saveArrangements()
    return setId
  },

  createChildSet: async (parentSetId, name = 'New Set') => {
    const setId = get().createSet(name, parentSetId)
    if (!setId) return null

    await get().saveArrangements()
    return setId
  },

  renameSet: async (setId, name) => {
    const normalizedName = name.trim()
    if (!normalizedName) return false

    let renamed = false
    set((state) => {
      const nextSets = renameSetNode(state.sets, setId, normalizedName)
      if (nextSets === state.sets) return state

      renamed = true
      return {
        sets: nextSets,
        pendingRenameTarget:
          state.pendingRenameTarget?.kind === 'set' && state.pendingRenameTarget.id === setId
            ? null
            : state.pendingRenameTarget
      }
    })

    if (!renamed) return false
    await get().saveArrangements()
    return true
  },

  deleteSet: (setId) =>
    set((state) => {
      const { nextSets, removed } = removeSetNode(state.sets, setId)
      if (!removed) return state

      const removedSetIds = collectSetIdsFromNode(removed)
      return {
        sets: nextSets,
        memberships: state.memberships.filter((membership) => !removedSetIds.has(membership.setId)),
        pendingRenameTarget:
          state.pendingRenameTarget?.kind === 'set' && removedSetIds.has(state.pendingRenameTarget.id)
            ? null
            : state.pendingRenameTarget
      }
    }),

  markPendingRenameTarget: (target) => set({ pendingRenameTarget: target }),

  setCamera: (cameraState) => set({ cameraState }),

  clearArrangements: () => set(getEmptyArrangementsState())
}))

useArrangementsStore.subscribe((state, previousState) => {
  if (!state.isHydrated || !previousState.isHydrated) return

  const persistedSliceChanged =
    state.bins !== previousState.bins ||
    state.sets !== previousState.sets ||
    state.memberships !== previousState.memberships ||
    state.binAssignments !== previousState.binAssignments ||
    state.desktopPlacements !== previousState.desktopPlacements ||
    state.cameraState !== previousState.cameraState

  if (!persistedSliceChanged) return
  void requestArrangementsSave()
})
