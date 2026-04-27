import { readdir, stat } from 'fs/promises'
import { basename, join, relative } from 'path'
import { pathToFileURL } from 'url'
import { resolveResource } from '../resource-uri'

const DEFAULT_RESULT_LIMIT = 40
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  '.whitebloom'
])

export type ObsidianVaultSearchInput = {
  resource: string
  label?: string
}

export type ObsidianVaultDocumentMatch = {
  vaultResource: string
  vaultLabel?: string
  resource: string
  title: string
  relativePath: string
}

export type ObsidianVaultSearchResult = {
  ok: boolean
  matches: ObsidianVaultDocumentMatch[]
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function isMarkdownFile(fileName: string): boolean {
  const normalized = fileName.toLowerCase()
  return normalized.endsWith('.md') || normalized.endsWith('.markdown')
}

async function isObsidianVault(absolutePath: string): Promise<boolean> {
  try {
    return (await stat(join(absolutePath, '.obsidian'))).isDirectory()
  } catch {
    return false
  }
}

async function collectMatchingMarkdownFiles(
  vaultPath: string,
  directoryPath: string,
  query: string,
  matches: string[],
  signal?: AbortSignal,
  limit = DEFAULT_RESULT_LIMIT
): Promise<void> {
  if (signal?.aborted || matches.length >= limit) return

  let entries
  try {
    entries = await readdir(directoryPath, { withFileTypes: true })
  } catch {
    return
  }

  entries.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  )

  for (const entry of entries) {
    if (signal?.aborted || matches.length >= limit) return

    const absolutePath = join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue
      await collectMatchingMarkdownFiles(vaultPath, absolutePath, query, matches, signal, limit)
      continue
    }

    if (!entry.isFile() || !isMarkdownFile(entry.name)) continue

    const title = basename(entry.name).replace(/\.(md|markdown)$/i, '')
    const relativePath = relative(vaultPath, absolutePath).replace(/\\/g, '/')
    const haystack = `${title} ${relativePath}`.toLowerCase()
    if (!haystack.includes(query)) continue

    matches.push(absolutePath)
  }
}

export async function searchObsidianVaultDocuments(
  vaults: ObsidianVaultSearchInput[],
  query: string,
  signal?: AbortSignal,
  limit = DEFAULT_RESULT_LIMIT
): Promise<ObsidianVaultSearchResult> {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery || vaults.length === 0) return { ok: true, matches: [] }

  const matches: ObsidianVaultDocumentMatch[] = []

  for (const vault of vaults) {
    if (signal?.aborted || matches.length >= limit) break

    let vaultPath: string
    try {
      vaultPath = resolveResource(vault.resource, '')
    } catch {
      continue
    }

    if (!(await isObsidianVault(vaultPath))) continue

    const vaultMatches: string[] = []
    await collectMatchingMarkdownFiles(
      vaultPath,
      vaultPath,
      normalizedQuery,
      vaultMatches,
      signal,
      limit - matches.length
    )

    for (const absolutePath of vaultMatches) {
      const relativePath = relative(vaultPath, absolutePath).replace(/\\/g, '/')
      const title = basename(absolutePath).replace(/\.(md|markdown)$/i, '')
      matches.push({
        vaultResource: vault.resource,
        ...(vault.label ? { vaultLabel: vault.label } : {}),
        resource: pathToFileURL(absolutePath).toString(),
        title,
        relativePath
      })
    }
  }

  matches.sort((left, right) => {
    const titleCompare = left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
    if (titleCompare !== 0) return titleCompare
    return left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' })
  })

  return { ok: true, matches }
}
