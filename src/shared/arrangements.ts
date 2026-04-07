export const CURRENT_GARDEN_VERSION = 1
export const SYSTEM_TRASH_BIN_ID = 'trash'
export const DEFAULT_GARDEN_CAMERA = { x: 0, y: 0, zoom: 1 } as const

export type ArrangementsMaterialKey = string
export type ArrangementsMaterialKind = 'board' | 'blossom' | 'resource' | 'linked'

export type ArrangementsMaterial = {
  key: ArrangementsMaterialKey
  kind: ArrangementsMaterialKind
  displayName: string
  extension: string | null
}

export type GardenPoint = {
  x: number
  y: number
}

export type GardenCameraState = GardenPoint & {
  zoom: number
}

export type GardenBin = {
  id: string
  name: string
  kind: 'user' | 'system'
}

export type GardenSetNode = {
  id: string
  name: string
  children: GardenSetNode[]
}

export type GardenMembership = {
  materialKey: ArrangementsMaterialKey
  setId: string
}

export type GardenState = {
  version: number
  bins: GardenBin[]
  sets: GardenSetNode[]
  memberships: GardenMembership[]
  binAssignments: Record<ArrangementsMaterialKey, string>
  desktopPlacements: Record<string, GardenPoint>
  cameraState: GardenCameraState
  trashContents: ArrangementsMaterialKey[]
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizePoint(value: unknown): GardenPoint | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as { x?: unknown; y?: unknown }
  const x = normalizeFiniteNumber(candidate.x, Number.NaN)
  const y = normalizeFiniteNumber(candidate.y, Number.NaN)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  return { x, y }
}

function normalizeCameraState(value: unknown): GardenCameraState {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_GARDEN_CAMERA }
  }

  const candidate = value as { x?: unknown; y?: unknown; zoom?: unknown }
  const x = normalizeFiniteNumber(candidate.x, DEFAULT_GARDEN_CAMERA.x)
  const y = normalizeFiniteNumber(candidate.y, DEFAULT_GARDEN_CAMERA.y)
  const zoom = normalizeFiniteNumber(candidate.zoom, DEFAULT_GARDEN_CAMERA.zoom)

  return {
    x,
    y,
    zoom: zoom > 0 ? zoom : DEFAULT_GARDEN_CAMERA.zoom
  }
}

function normalizeBin(value: unknown): GardenBin | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as { id?: unknown; name?: unknown; kind?: unknown }
  const id = normalizeNonEmptyString(candidate.id)
  const kind = candidate.kind === 'system' ? 'system' : candidate.kind === 'user' ? 'user' : null
  if (!id || !kind) return null

  const defaultName = id === SYSTEM_TRASH_BIN_ID ? 'Trash' : undefined
  const name = normalizeNonEmptyString(candidate.name) ?? defaultName
  if (!name) return null

  return { id, name, kind }
}

function normalizeBins(value: unknown): GardenBin[] {
  const bins = Array.isArray(value) ? value.map(normalizeBin).filter((bin) => bin !== null) : []
  const uniqueBins: GardenBin[] = []
  const seenIds = new Set<string>()

  for (const bin of bins) {
    if (seenIds.has(bin.id)) continue
    seenIds.add(bin.id)
    uniqueBins.push(bin)
  }

  const normalizedBins = uniqueBins
    .filter((bin) => bin.id !== SYSTEM_TRASH_BIN_ID)
    .map((bin) => ({ ...bin }))

  normalizedBins.unshift({
    id: SYSTEM_TRASH_BIN_ID,
    name: 'Trash',
    kind: 'system'
  })

  return normalizedBins
}

function normalizeSetTree(value: unknown, seenIds: Set<string>): GardenSetNode[] {
  if (!Array.isArray(value)) return []

  const sets: GardenSetNode[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue

    const candidate = entry as { id?: unknown; name?: unknown; children?: unknown }
    const id = normalizeNonEmptyString(candidate.id)
    const name = normalizeNonEmptyString(candidate.name)
    if (!id || !name || seenIds.has(id)) continue

    seenIds.add(id)
    sets.push({
      id,
      name,
      children: normalizeSetTree(candidate.children, seenIds)
    })
  }

  return sets
}

function collectSetIds(sets: GardenSetNode[], output: Set<string>): Set<string> {
  for (const set of sets) {
    output.add(set.id)
    collectSetIds(set.children, output)
  }
  return output
}

function normalizeMemberships(value: unknown, validSetIds: Set<string>): GardenMembership[] {
  if (!Array.isArray(value)) return []

  const memberships: GardenMembership[] = []
  const seenPairs = new Set<string>()

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue

    const candidate = entry as { materialKey?: unknown; setId?: unknown }
    const materialKey = normalizeNonEmptyString(candidate.materialKey)
    const setId = normalizeNonEmptyString(candidate.setId)
    if (!materialKey || !setId || !validSetIds.has(setId)) continue

    const pairKey = `${materialKey}::${setId}`
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)
    memberships.push({ materialKey, setId })
  }

  return memberships
}

function normalizeDesktopPlacements(value: unknown): Record<string, GardenPoint> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const placements: Record<string, GardenPoint> = {}
  for (const [key, position] of Object.entries(value)) {
    const normalizedKey = normalizeNonEmptyString(key)
    const normalizedPoint = normalizePoint(position)
    if (!normalizedKey || !normalizedPoint) continue
    placements[normalizedKey] = normalizedPoint
  }

  return placements
}

function normalizeTrashContents(value: unknown): ArrangementsMaterialKey[] {
  if (!Array.isArray(value)) return []

  const contents: ArrangementsMaterialKey[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    const materialKey = normalizeNonEmptyString(entry)
    if (!materialKey || seen.has(materialKey)) continue
    seen.add(materialKey)
    contents.push(materialKey)
  }

  return contents
}

function normalizeBinAssignments(
  value: unknown,
  validBins: Set<string>,
  trashContents: ArrangementsMaterialKey[]
): Record<ArrangementsMaterialKey, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const trashedKeys = new Set(trashContents)
  const assignments: Record<ArrangementsMaterialKey, string> = {}

  for (const [materialKey, binIdValue] of Object.entries(value)) {
    const normalizedMaterialKey = normalizeNonEmptyString(materialKey)
    const normalizedBinId = normalizeNonEmptyString(binIdValue)
    if (!normalizedMaterialKey || !normalizedBinId) continue
    if (trashedKeys.has(normalizedMaterialKey)) continue
    if (normalizedBinId === SYSTEM_TRASH_BIN_ID) continue
    if (!validBins.has(normalizedBinId)) continue
    assignments[normalizedMaterialKey] = normalizedBinId
  }

  return assignments
}

export function createEmptyGardenState(): GardenState {
  return {
    version: CURRENT_GARDEN_VERSION,
    bins: [{ id: SYSTEM_TRASH_BIN_ID, name: 'Trash', kind: 'system' }],
    sets: [],
    memberships: [],
    binAssignments: {},
    desktopPlacements: {},
    cameraState: { ...DEFAULT_GARDEN_CAMERA },
    trashContents: []
  }
}

export function normalizeGardenState(value: unknown): GardenState {
  if (!value || typeof value !== 'object') {
    return createEmptyGardenState()
  }

  const candidate = value as {
    bins?: unknown
    sets?: unknown
    memberships?: unknown
    binAssignments?: unknown
    desktopPlacements?: unknown
    cameraState?: unknown
    trashContents?: unknown
  }

  const bins = normalizeBins(candidate.bins)
  const sets = normalizeSetTree(candidate.sets, new Set<string>())
  const validSetIds = collectSetIds(sets, new Set<string>())
  const trashContents = normalizeTrashContents(candidate.trashContents)
  const validUserBinIds = new Set(
    bins.filter((bin) => bin.id !== SYSTEM_TRASH_BIN_ID).map((bin) => bin.id)
  )

  return {
    version: CURRENT_GARDEN_VERSION,
    bins,
    sets,
    memberships: normalizeMemberships(candidate.memberships, validSetIds),
    binAssignments: normalizeBinAssignments(
      candidate.binAssignments,
      validUserBinIds,
      trashContents
    ),
    desktopPlacements: normalizeDesktopPlacements(candidate.desktopPlacements),
    cameraState: normalizeCameraState(candidate.cameraState),
    trashContents
  }
}
