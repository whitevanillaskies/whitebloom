import type { ArrangementsMaterial } from '../../../../shared/arrangements'
import type { BoardNode } from '../../shared/types'
import { useArrangementsStore } from '../../stores/arrangements'
import { useBoardStore } from '../../stores/board'
import { useWorkspaceStore } from '../../stores/workspace'

const CURRENT_UNSAVED_BOARD_LABEL = 'Current unsaved board'

function getCurrentBoardReferenceLabel(boardPath: string | null): string {
  return boardPath?.trim() || CURRENT_UNSAVED_BOARD_LABEL
}

function getCurrentBoardReferencedMaterialKeys(): string[] {
  const nodes = useBoardStore.getState().nodes
  return [
    ...new Set(
      nodes
        .map((node) => {
          const resource = (node as BoardNode).resource
          return typeof resource === 'string' ? resource.trim() : ''
        })
        .filter((resource) => resource.length > 0)
    )
  ]
}

export async function getMaterialReferenceIndex(
  workspaceRoot: string,
  materialKeys?: string[]
): Promise<Record<string, string[]>> {
  const result = await window.api.getArrangementsReferenceIndex(workspaceRoot, materialKeys)
  return result.ok ? result.references : {}
}

export async function getLiveMaterialReferenceIndex(
  materialKeys?: string[]
): Promise<Record<string, string[]>> {
  const workspaceRoot = useWorkspaceStore.getState().root
  const currentBoardPath = useBoardStore.getState().path
  const normalizedFilter =
    materialKeys && materialKeys.length > 0
      ? new Set(materialKeys.map((materialKey) => materialKey.trim()).filter(Boolean))
      : null

  const persistedReferences = workspaceRoot
    ? await getMaterialReferenceIndex(workspaceRoot, materialKeys)
    : {}
  const mergedReferences = Object.fromEntries(
    Object.entries(persistedReferences).map(([materialKey, boardPaths]) => [
      materialKey,
      [...boardPaths]
    ])
  ) as Record<string, string[]>

  const currentBoardReferences = getCurrentBoardReferencedMaterialKeys()
  const currentBoardLabel = getCurrentBoardReferenceLabel(currentBoardPath)

  for (const materialKey of currentBoardReferences) {
    if (normalizedFilter && !normalizedFilter.has(materialKey)) continue
    const nextBoardPaths = new Set(mergedReferences[materialKey] ?? [])
    nextBoardPaths.add(currentBoardLabel)
    mergedReferences[materialKey] = [...nextBoardPaths].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    )
  }

  if (!normalizedFilter) return mergedReferences

  for (const materialKey of normalizedFilter) {
    if (!(materialKey in mergedReferences)) {
      mergedReferences[materialKey] = []
    }
  }

  return mergedReferences
}

function getBoardReferenceLabel(boardReference: string): string {
  if (boardReference === CURRENT_UNSAVED_BOARD_LABEL) return boardReference
  const normalized = boardReference.replace(/\\/g, '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  return fileName.replace(/\.wb\.json$/i, '') || fileName || boardReference
}

function buildReferencedMaterialsMessage(
  materials: ArrangementsMaterial[],
  referencesByMaterialKey: Record<string, string[]>,
  actionLabel: string
): string {
  const lines = materials
    .filter((material) => (referencesByMaterialKey[material.key] ?? []).length > 0)
    .slice(0, 6)
    .map((material) => {
      const boardLabels = (referencesByMaterialKey[material.key] ?? [])
        .slice(0, 3)
        .map(getBoardReferenceLabel)
      const suffix =
        boardLabels.length > 0 ? `: ${boardLabels.join(', ')}` : ''
      return `- ${material.displayName}${suffix}`
    })

  const remainingCount = materials.filter(
    (material) => (referencesByMaterialKey[material.key] ?? []).length > 0
  ).length - lines.length

  return [
    `Can't ${actionLabel} material${materials.length === 1 ? '' : 's'} that are still used by board${materials.length === 1 ? '' : 's'}.`,
    '',
    ...lines,
    ...(remainingCount > 0 ? [`- ${remainingCount} more...`] : [])
  ].join('\n')
}

export async function sendMaterialsToTrashWithReferenceGuard(
  materialKeys: string[]
): Promise<boolean> {
  const workspaceRoot = useWorkspaceStore.getState().root
  const { materials, sendToTrash } = useArrangementsStore.getState()
  const candidateMaterials = materials.filter((material) => materialKeys.includes(material.key))

  if (!workspaceRoot || candidateMaterials.length === 0) {
    for (const materialKey of materialKeys) {
      sendToTrash(materialKey)
    }
    return true
  }

  const referencesByMaterialKey = await getLiveMaterialReferenceIndex(materialKeys)
  const blockedMaterials = candidateMaterials.filter(
    (material) => (referencesByMaterialKey[material.key] ?? []).length > 0
  )

  if (blockedMaterials.length > 0) {
    window.alert(
      buildReferencedMaterialsMessage(blockedMaterials, referencesByMaterialKey, 'send to Trash')
    )
    return false
  }

  for (const materialKey of materialKeys) {
    sendToTrash(materialKey)
  }

  return true
}

export async function deleteMaterialsFromTrashWithReferenceGuard(
  materialKeys: string[]
): Promise<boolean> {
  const workspaceRoot = useWorkspaceStore.getState().root
  const { materials, deleteMaterialsFromTrash } = useArrangementsStore.getState()
  const candidateMaterials = materials.filter((material) => materialKeys.includes(material.key))

  if (!workspaceRoot || candidateMaterials.length === 0) return false

  const referencesByMaterialKey = await getLiveMaterialReferenceIndex(materialKeys)
  const blockedMaterials = candidateMaterials.filter(
    (material) => (referencesByMaterialKey[material.key] ?? []).length > 0
  )

  if (blockedMaterials.length > 0) {
    window.alert(
      buildReferencedMaterialsMessage(
        blockedMaterials,
        referencesByMaterialKey,
        'permanently delete'
      )
    )
    return false
  }

  const message = `Permanently delete ${candidateMaterials.length} item(s)? This cannot be undone.`
  if (!window.confirm(message)) return false

  return deleteMaterialsFromTrash(materialKeys)
}
