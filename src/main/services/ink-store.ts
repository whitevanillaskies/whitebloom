import { createHash } from 'crypto'
import { constants } from 'fs'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  createEmptyInkAcetate,
  createEmptyInkWorkspaceIndex,
  createInkTargetId,
  CURRENT_INK_VERSION,
  INK_ACETATE_DIRECTORY,
  INK_ACETATE_FILE_EXTENSION,
  INK_WORKSPACE_INDEX_FILENAME,
  type InkAcetate,
  type InkSurfaceBinding,
  type InkStroke,
  type InkTargetIndexEntry,
  type InkWorkspaceIndex
} from '../../shared/ink'

// Queues are used only for write serialization; the resolved value is never
// consumed from the map, so Promise<unknown> avoids awkward casts across
// operations with different return types.
const writeQueues = new Map<string, Promise<unknown>>()

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function getInkIndexPath(workspaceRoot: string): string {
  return join(workspaceRoot, INK_WORKSPACE_INDEX_FILENAME)
}

function buildQueueKey(workspaceRoot: string, targetId: string): string {
  return `${workspaceRoot}::${targetId}`
}

function buildAcetateRelativePath(targetId: string): string {
  const hash = createHash('sha1').update(targetId).digest('hex')
  return `${INK_ACETATE_DIRECTORY}/${hash}${INK_ACETATE_FILE_EXTENSION}`
}

function resolveAcetatePath(workspaceRoot: string, relativePath: string): string {
  return join(workspaceRoot, relativePath.replace(/\//g, '\\'))
}

function normalizeInkWorkspaceIndex(value: unknown): InkWorkspaceIndex {
  if (!value || typeof value !== 'object') {
    return createEmptyInkWorkspaceIndex()
  }

  const candidate = value as Partial<InkWorkspaceIndex>
  return {
    version: CURRENT_INK_VERSION,
    acetates: Array.isArray(candidate.acetates)
      ? candidate.acetates.filter((entry) => entry && typeof entry.id === 'string')
      : [],
    targets: Array.isArray(candidate.targets)
      ? candidate.targets.filter((entry) => entry && typeof entry.id === 'string')
      : []
  }
}

function normalizeInkAcetate(value: unknown): InkAcetate | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<InkAcetate>
  if (!candidate.id || !candidate.target || !Array.isArray(candidate.strokes)) {
    return null
  }

  const nowIso = new Date().toISOString()
  return {
    version: CURRENT_INK_VERSION,
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : undefined,
    target: candidate.target,
    strokes: candidate.strokes as InkStroke[],
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : nowIso,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso
  }
}

async function readInkIndex(workspaceRoot: string): Promise<InkWorkspaceIndex> {
  const indexPath = getInkIndexPath(workspaceRoot)
  if (!(await pathExists(indexPath))) {
    return createEmptyInkWorkspaceIndex()
  }

  return normalizeInkWorkspaceIndex(JSON.parse(await readFile(indexPath, 'utf-8')))
}

async function writeInkIndex(workspaceRoot: string, index: InkWorkspaceIndex): Promise<void> {
  await writeFile(getInkIndexPath(workspaceRoot), JSON.stringify(index, null, 2), 'utf-8')
}

async function readAcetateAtPath(acetatePath: string): Promise<InkAcetate | null> {
  if (!(await pathExists(acetatePath))) return null
  return normalizeInkAcetate(JSON.parse(await readFile(acetatePath, 'utf-8')))
}

async function writeAcetateAtPath(acetatePath: string, acetate: InkAcetate): Promise<void> {
  await mkdir(dirname(acetatePath), { recursive: true })
  await writeFile(acetatePath, JSON.stringify(acetate, null, 2), 'utf-8')
}

function ensureTargetEntry(
  index: InkWorkspaceIndex,
  binding: InkSurfaceBinding,
  acetateId: string
): InkTargetIndexEntry {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const existing = index.targets.find((entry) => entry.id === targetId)
  if (existing) {
    existing.resource = binding.resource
    existing.surfaceType = binding.surfaceType
    existing.acetateIds = existing.acetateIds.includes(acetateId)
      ? existing.acetateIds
      : [acetateId, ...existing.acetateIds]
    return existing
  }

  const next: InkTargetIndexEntry = {
    id: targetId,
    surfaceType: binding.surfaceType,
    resource: binding.resource,
    acetateIds: [acetateId]
  }
  index.targets.push(next)
  return next
}

async function deleteInkStrokeImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  strokeId: string
): Promise<InkAcetate | null> {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const targetEntry = index.targets.find((entry) => entry.id === targetId)
  const acetateId = targetEntry?.acetateIds[0]
  if (!acetateId) return null

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (!acetateEntry) return null

  const acetatePath = resolveAcetatePath(workspaceRoot, acetateEntry.relativePath)
  const current = await readAcetateAtPath(acetatePath)
  if (!current) return null

  const nowIso = new Date().toISOString()
  const nextAcetate: InkAcetate = {
    ...current,
    strokes: current.strokes.filter((s) => s.id !== strokeId),
    updatedAt: nowIso
  }

  await writeAcetateAtPath(acetatePath, nextAcetate)
  acetateEntry.updatedAt = nowIso
  await writeInkIndex(workspaceRoot, index)
  return nextAcetate
}

export async function deleteInkStroke(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  strokeId: string
): Promise<InkAcetate | null> {
  const queueKey = buildQueueKey(workspaceRoot, createInkTargetId(binding.surfaceType, binding.resource))
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null)
  const next = previous
    .catch(() => null)
    .then(async () => await deleteInkStrokeImmediate(workspaceRoot, binding, strokeId))

  writeQueues.set(queueKey, next)

  try {
    return await next
  } finally {
    if (writeQueues.get(queueKey) === next) writeQueues.delete(queueKey)
  }
}

export async function loadInkAcetate(
  workspaceRoot: string,
  binding: InkSurfaceBinding
): Promise<InkAcetate | null> {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const targetEntry = index.targets.find((entry) => entry.id === targetId)
  const acetateId = targetEntry?.acetateIds[0]
  if (!acetateId) return null

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (!acetateEntry) return null

  return await readAcetateAtPath(resolveAcetatePath(workspaceRoot, acetateEntry.relativePath))
}

async function appendInkStrokeImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  stroke: InkStroke
): Promise<InkAcetate> {
  await mkdir(join(workspaceRoot, INK_ACETATE_DIRECTORY), { recursive: true })

  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const existingTarget = index.targets.find((entry) => entry.id === targetId)
  const acetateId = existingTarget?.acetateIds[0] ?? createHash('sha1').update(targetId).digest('hex')
  const relativePath =
    index.acetates.find((entry) => entry.id === acetateId)?.relativePath ??
    buildAcetateRelativePath(targetId)
  const acetatePath = resolveAcetatePath(workspaceRoot, relativePath)
  const nowIso = new Date().toISOString()

  const current =
    (await readAcetateAtPath(acetatePath)) ??
    createEmptyInkAcetate(
      acetateId,
      {
        ...binding,
        targetId
      },
      nowIso
    )

  const nextAcetate: InkAcetate = {
    ...current,
    target: {
      ...binding,
      targetId
    },
    strokes: [...current.strokes, stroke],
    updatedAt: nowIso
  }

  await writeAcetateAtPath(acetatePath, nextAcetate)

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (acetateEntry) {
    acetateEntry.targetId = targetId
    acetateEntry.surfaceType = binding.surfaceType
    acetateEntry.coordinateSpace = binding.coordinateSpace
    acetateEntry.relativePath = relativePath
    acetateEntry.updatedAt = nowIso
    acetateEntry.name = nextAcetate.name
  } else {
    index.acetates.push({
      id: acetateId,
      name: nextAcetate.name,
      targetId,
      surfaceType: binding.surfaceType,
      coordinateSpace: binding.coordinateSpace,
      relativePath,
      createdAt: nextAcetate.createdAt,
      updatedAt: nowIso
    })
  }

  ensureTargetEntry(index, binding, acetateId)
  await writeInkIndex(workspaceRoot, index)
  return nextAcetate
}

export async function appendInkStroke(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  stroke: InkStroke
): Promise<InkAcetate> {
  const queueKey = buildQueueKey(
    workspaceRoot,
    createInkTargetId(binding.surfaceType, binding.resource)
  )
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null as unknown as InkAcetate)
  const next = previous
    .catch(() => null as unknown as InkAcetate)
    .then(async () => await appendInkStrokeImmediate(workspaceRoot, binding, stroke))

  writeQueues.set(queueKey, next)

  try {
    return await next
  } finally {
    if (writeQueues.get(queueKey) === next) {
      writeQueues.delete(queueKey)
    }
  }
}
