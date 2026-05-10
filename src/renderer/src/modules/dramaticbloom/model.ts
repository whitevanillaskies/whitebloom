export const DRAMATIC_BLOOM_SCHEMA_VERSION = 1

export type DramaticBloomItemType = 'folder' | 'card' | 'note'
export type DramaticBloomNoteType = 'plain' | 'book'
export type DramaticBloomCardType = 'generic'

export type DramaticBloomProject = {
  schemaVersion: typeof DRAMATIC_BLOOM_SCHEMA_VERSION
  project: {
    title: string
    author?: string
    notes: string
    tags: string[]
  }
  rootId: string
  selectedId?: string
  items: Record<string, DramaticBloomItem>
}

export type DramaticBloomBaseItem = {
  id: string
  type: DramaticBloomItemType
  title: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type DramaticBloomFolder = DramaticBloomBaseItem & {
  type: 'folder'
  description: string
  children: string[]
}

export type DramaticBloomCard = DramaticBloomBaseItem & {
  type: 'card'
  cardType: DramaticBloomCardType
  code: string
  outline: string
  notes: string
  children: string[]
}

export type DramaticBloomNote = DramaticBloomBaseItem & {
  type: 'note'
  noteType: DramaticBloomNoteType
  description: string
  content: string
}

export type DramaticBloomItem = DramaticBloomFolder | DramaticBloomCard | DramaticBloomNote
export type DramaticBloomContainer = DramaticBloomFolder | DramaticBloomCard
export type DramaticBloomDropPosition = 'before' | 'after' | 'inside'

export type DramaticBloomMoveInput = {
  draggedId: string
  targetId: string
  position: DramaticBloomDropPosition
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

export function isDramaticBloomContainer(
  item: DramaticBloomItem | undefined
): item is DramaticBloomContainer {
  return item?.type === 'folder' || item?.type === 'card'
}

export function canDramaticBloomItemContain(
  parent: DramaticBloomItem | undefined,
  child: DramaticBloomItem | undefined
): parent is DramaticBloomContainer {
  if (!parent || !child) return false
  if (parent.type === 'folder') return true
  if (parent.type === 'card') return child.type === 'note'
  return false
}

export function findDramaticBloomParentId(
  project: DramaticBloomProject,
  itemId: string
): string | null {
  for (const item of Object.values(project.items)) {
    if (!isDramaticBloomContainer(item)) continue
    if (item.children.includes(itemId)) return item.id
  }
  return null
}

export function isDramaticBloomDescendant(
  project: DramaticBloomProject,
  possibleDescendantId: string,
  ancestorId: string
): boolean {
  const ancestor = project.items[ancestorId]
  if (!isDramaticBloomContainer(ancestor)) return false

  for (const childId of ancestor.children) {
    if (childId === possibleDescendantId) return true
    if (isDramaticBloomDescendant(project, possibleDescendantId, childId)) return true
  }

  return false
}

function resolveMoveDestination(
  project: DramaticBloomProject,
  input: DramaticBloomMoveInput
): { parentId: string; index: number } | null {
  const target = project.items[input.targetId]
  if (!target) return null

  if (input.position === 'inside') {
    if (!isDramaticBloomContainer(target)) return null
    return { parentId: target.id, index: target.children.length }
  }

  const parentId = findDramaticBloomParentId(project, target.id)
  if (!parentId) return null
  const parent = project.items[parentId]
  if (!isDramaticBloomContainer(parent)) return null

  const targetIndex = parent.children.indexOf(target.id)
  if (targetIndex === -1) return null

  return {
    parentId,
    index: input.position === 'before' ? targetIndex : targetIndex + 1
  }
}

export function canMoveDramaticBloomItem(
  project: DramaticBloomProject,
  input: DramaticBloomMoveInput
): boolean {
  const dragged = project.items[input.draggedId]
  if (!dragged || dragged.id === project.rootId || dragged.id === input.targetId) return false

  const destination = resolveMoveDestination(project, input)
  if (!destination) return false

  const destinationParent = project.items[destination.parentId]
  if (!canDramaticBloomItemContain(destinationParent, dragged)) return false
  if (destination.parentId === dragged.id) return false
  if (isDramaticBloomDescendant(project, destination.parentId, dragged.id)) return false

  const sourceParentId = findDramaticBloomParentId(project, dragged.id)
  if (!sourceParentId) return false

  return true
}

export function moveDramaticBloomItem(
  project: DramaticBloomProject,
  input: DramaticBloomMoveInput
): DramaticBloomProject {
  if (!canMoveDramaticBloomItem(project, input)) return project

  const dragged = project.items[input.draggedId]
  const sourceParentId = findDramaticBloomParentId(project, dragged.id)
  const destination = resolveMoveDestination(project, input)
  if (!sourceParentId || !destination) return project

  const sourceParent = project.items[sourceParentId]
  const destinationParent = project.items[destination.parentId]
  if (!isDramaticBloomContainer(sourceParent) || !isDramaticBloomContainer(destinationParent)) {
    return project
  }

  const timestamp = now()
  const sourceChildren = sourceParent.children.filter((childId) => childId !== dragged.id)
  let destinationIndex = destination.index

  if (sourceParent.id === destinationParent.id) {
    const originalIndex = sourceParent.children.indexOf(dragged.id)
    if (originalIndex !== -1 && originalIndex < destinationIndex) destinationIndex -= 1
  }

  const baseDestinationChildren =
    sourceParent.id === destinationParent.id ? sourceChildren : destinationParent.children
  const nextDestinationChildren = [
    ...baseDestinationChildren.slice(0, destinationIndex),
    dragged.id,
    ...baseDestinationChildren.slice(destinationIndex)
  ]

  return {
    ...project,
    selectedId: dragged.id,
    items: {
      ...project.items,
      [sourceParent.id]: {
        ...sourceParent,
        children:
          sourceParent.id === destinationParent.id ? nextDestinationChildren : sourceChildren,
        updatedAt: timestamp
      },
      [destinationParent.id]: {
        ...destinationParent,
        children: nextDestinationChildren,
        updatedAt: timestamp
      }
    }
  }
}

export function createDefaultDramaticBloomProject(): DramaticBloomProject {
  const timestamp = now()
  const rootId = createId('root')

  return {
    schemaVersion: DRAMATIC_BLOOM_SCHEMA_VERSION,
    project: {
      title: 'Untitled Dramatic Work',
      notes: '',
      tags: []
    },
    rootId,
    selectedId: rootId,
    items: {
      [rootId]: {
        id: rootId,
        type: 'folder',
        title: '',
        description: '',
        children: [],
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }
  }
}

export function serializeDramaticBloomProject(project: DramaticBloomProject): string {
  return JSON.stringify(project, null, 2)
}

export function parseDramaticBloomProject(raw: string): DramaticBloomProject {
  if (!raw.trim()) return createDefaultDramaticBloomProject()

  try {
    const parsed = JSON.parse(raw) as Partial<DramaticBloomProject>
    if (
      parsed.schemaVersion !== DRAMATIC_BLOOM_SCHEMA_VERSION ||
      !parsed.rootId ||
      !parsed.items ||
      !parsed.items[parsed.rootId]
    ) {
      return createDefaultDramaticBloomProject()
    }

    let rootId = parsed.rootId
    let items = { ...parsed.items } as Record<string, DramaticBloomItem>

    // Migration: old projects used a visible root folder. Wrap it in an
    // invisible root so that top-level folders can be added as siblings.
    const rootItem = items[rootId]
    if (rootItem && rootItem.type === 'folder' && rootItem.title.trim() !== '') {
      const newRootId = createId('root')
      items[newRootId] = {
        id: newRootId,
        type: 'folder',
        title: '',
        description: '',
        children: [rootId],
        tags: [],
        createdAt: rootItem.createdAt,
        updatedAt: now()
      }
      rootId = newRootId
    }

    const nextRootItem = items[rootId]
    if (nextRootItem && nextRootItem.type === 'folder' && nextRootItem.children.length === 1) {
      const onlyChildId = nextRootItem.children[0]
      const onlyChild = items[onlyChildId]
      if (
        onlyChild?.type === 'folder' &&
        onlyChild.title === 'Draft' &&
        onlyChild.description === 'Scenes, cards, and notes that shape the story.'
      ) {
        items = {
          ...items,
          [rootId]: {
            ...nextRootItem,
            children: [...onlyChild.children],
            updatedAt: now()
          }
        }
        delete items[onlyChildId]
      }
    }

    items = Object.fromEntries(
      Object.entries(items).map(([id, item]) => [
        id,
        item.type === 'note' ? { ...item, description: item.description ?? '' } : item
      ])
    ) as Record<string, DramaticBloomItem>

    return {
      schemaVersion: DRAMATIC_BLOOM_SCHEMA_VERSION,
      project: {
        title: parsed.project?.title || 'Untitled Dramatic Work',
        author: parsed.project?.author,
        notes: parsed.project?.notes ?? '',
        tags: Array.isArray(parsed.project?.tags) ? parsed.project.tags : []
      },
      rootId,
      selectedId: parsed.selectedId && items[parsed.selectedId] ? parsed.selectedId : rootId,
      items
    }
  } catch {
    return createDefaultDramaticBloomProject()
  }
}

export function createDramaticBloomItem(type: DramaticBloomItemType): DramaticBloomItem {
  const timestamp = now()
  const id = createId(type)

  if (type === 'folder') {
    return {
      id,
      type,
      title: 'New Folder',
      description: '',
      children: [],
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  if (type === 'card') {
    return {
      id,
      type,
      cardType: 'generic',
      code: '',
      title: 'New Card',
      outline: '',
      notes: '',
      children: [],
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  return {
    id,
    type,
    noteType: 'plain',
    title: 'New Note',
    description: '',
    content: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
