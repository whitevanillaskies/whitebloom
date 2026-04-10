import { getRegisteredCommandsForRuntimeContext } from './registry'
import {
  executeCommandById,
  isRegisteredCommandAvailable,
  resolveExecutableCommandById,
  resolveExecutableCommandByName
} from './runtime'
import type {
  WhitebloomCommandContext,
  WhitebloomCommandContextKey,
  WhitebloomCommandExecutionOptions,
  WhitebloomCommandSearchOptions,
  WhitebloomCommandSearchResult,
  WhitebloomRegisteredCommandForContext,
  WhitebloomVirtualCommandNamespace
} from './types'

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function splitCommandId(id: string): string[] {
  return id.split('.').map((segment) => segment.trim()).filter(Boolean)
}

function matchesNamespace(id: string, namespace?: string): boolean {
  if (!namespace) return true

  const idSegments = splitCommandId(id)
  const namespaceSegments = splitCommandId(namespace)

  if (namespaceSegments.length === 0) return true
  if (namespaceSegments.length > idSegments.length) return false

  return namespaceSegments.every((segment, index) => idSegments[index] === segment)
}

function sortByCoreId<TKind extends WhitebloomCommandContextKey>(
  left: WhitebloomRegisteredCommandForContext<TKind>,
  right: WhitebloomRegisteredCommandForContext<TKind>
): number {
  return left.command.core.id.localeCompare(right.command.core.id)
}

function applySearchLimit<T>(results: T[], limit?: number): T[] {
  return typeof limit === 'number' ? results.slice(0, Math.max(0, limit)) : results
}

export function resolveCommandById<TKind extends WhitebloomCommandContextKey>(
  id: string,
  context: WhitebloomCommandContext<TKind>
): WhitebloomRegisteredCommandForContext<TKind> | undefined {
  const entry = resolveExecutableCommandById(id, context)
  if (!entry) return undefined
  return isRegisteredCommandAvailable(entry, context) ? entry : undefined
}

export function resolveCommandByName<TKind extends WhitebloomCommandContextKey>(
  name: string,
  context: WhitebloomCommandContext<TKind>
): WhitebloomRegisteredCommandForContext<TKind> | undefined {
  const entry = resolveExecutableCommandByName(name, context)
  if (!entry) return undefined
  return isRegisteredCommandAvailable(entry, context) ? entry : undefined
}

export function searchCoreCommands<TKind extends WhitebloomCommandContextKey>(
  query: string,
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandSearchOptions = {}
): WhitebloomCommandSearchResult<TKind>[] {
  const normalizedQuery = normalizeSearchValue(query)
  const results: WhitebloomCommandSearchResult<TKind>[] = []

  for (const entry of getRegisteredCommandsForRuntimeContext(context)) {
    if (!isRegisteredCommandAvailable(entry, context)) continue
    if (!matchesNamespace(entry.command.core.id, options.namespace)) continue

    const normalizedId = normalizeSearchValue(entry.command.core.id)
    if (!normalizedQuery || normalizedId.includes(normalizedQuery)) {
      results.push({ entry, matchedBy: 'core-id' })
      continue
    }

    const matchesAlias =
      entry.command.core.aliases?.some((alias) => normalizeSearchValue(alias).includes(normalizedQuery)) ?? false

    if (matchesAlias) {
      results.push({ entry, matchedBy: 'core-alias' })
    }
  }

  results.sort((left, right) => sortByCoreId(left.entry, right.entry))
  return applySearchLimit(results, options.limit)
}

export function searchPresentedCommands<TKind extends WhitebloomCommandContextKey>(
  query: string,
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandSearchOptions = {}
): WhitebloomCommandSearchResult<TKind>[] {
  const normalizedQuery = normalizeSearchValue(query)
  const results: WhitebloomCommandSearchResult<TKind>[] = []

  for (const entry of getRegisteredCommandsForRuntimeContext(context)) {
    if (!isRegisteredCommandAvailable(entry, context)) continue
    if (!matchesNamespace(entry.command.core.id, options.namespace)) continue

    const presentation = entry.command.presentations?.find(
      (candidate) => candidate.context === context.kind
    ) as WhitebloomCommandSearchResult<TKind>['presentation']
    if (!presentation) continue

    const normalizedTitle = normalizeSearchValue(presentation.title)
    if (!normalizedQuery || normalizedTitle.includes(normalizedQuery)) {
      results.push({ entry, matchedBy: 'presentation-title', presentation })
      continue
    }

    const normalizedSubtitle = normalizeSearchValue(presentation.subtitle ?? '')
    if (normalizedSubtitle.includes(normalizedQuery)) {
      results.push({ entry, matchedBy: 'presentation-subtitle', presentation })
    }
  }

  results.sort((left, right) => {
    const leftTitle = left.presentation?.title ?? left.entry.command.core.id
    const rightTitle = right.presentation?.title ?? right.entry.command.core.id
    return leftTitle.localeCompare(rightTitle)
  })

  return applySearchLimit(results, options.limit)
}

export function listVirtualCommandNamespaces<TKind extends WhitebloomCommandContextKey>(
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandSearchOptions = {}
): WhitebloomVirtualCommandNamespace<TKind>[] {
  const namespaceMap = new Map<string, WhitebloomVirtualCommandNamespace<TKind>>()
  const namespaceSegments = splitCommandId(options.namespace ?? '')
  const depth = namespaceSegments.length

  for (const entry of getRegisteredCommandsForRuntimeContext(context)) {
    if (!isRegisteredCommandAvailable(entry, context)) continue
    if (!matchesNamespace(entry.command.core.id, options.namespace)) continue

    const segments = splitCommandId(entry.command.core.id)
    const nextSegment = segments[depth]
    if (!nextSegment) continue

    const namespaceId = [...namespaceSegments, nextSegment].join('.')
    const existing = namespaceMap.get(namespaceId)

    if (existing) {
      existing.entries.push(entry)
      existing.commandCount += 1
      existing.hasDirectCommand ||= segments.length === depth + 1
      existing.hasChildren ||= segments.length > depth + 1
      continue
    }

    namespaceMap.set(namespaceId, {
      id: namespaceId,
      segment: nextSegment,
      parentId: namespaceSegments.length > 0 ? namespaceSegments.join('.') : null,
      depth: depth + 1,
      hasDirectCommand: segments.length === depth + 1,
      hasChildren: segments.length > depth + 1,
      commandCount: 1,
      entries: [entry]
    })
  }

  const results = Array.from(namespaceMap.values()).sort((left, right) => left.segment.localeCompare(right.segment))
  return applySearchLimit(results, options.limit)
}

export async function invokeCommandById<
  TKind extends WhitebloomCommandContextKey,
  TArgs = unknown,
  TResult = unknown
>(
  id: string,
  args: TArgs,
  context: WhitebloomCommandContext<TKind>,
  options: WhitebloomCommandExecutionOptions = {}
): Promise<TResult> {
  const result = await executeCommandById<TKind, TArgs, TResult>(id, args, context, options)
  if (!result.ok) {
    throw result.error ?? new Error(result.message ?? `Command execution failed: ${id}`)
  }

  return result.result
}
