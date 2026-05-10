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
  content: string
}

export type DramaticBloomItem = DramaticBloomFolder | DramaticBloomCard | DramaticBloomNote
export type DramaticBloomContainer = DramaticBloomFolder | DramaticBloomCard

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

export function createDefaultDramaticBloomProject(): DramaticBloomProject {
  const timestamp = now()
  const rootId = createId('folder')
  const cardId = createId('card')
  const noteId = createId('note')

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
        title: 'Draft',
        description: 'Scenes, cards, and notes that shape the story.',
        children: [cardId, noteId],
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp
      },
      [cardId]: {
        id: cardId,
        type: 'card',
        cardType: 'generic',
        code: '1.1',
        title: 'Opening Scene',
        outline: 'A first dramatic unit waiting to become specific.',
        notes: '',
        children: [],
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp
      },
      [noteId]: {
        id: noteId,
        type: 'note',
        noteType: 'plain',
        title: 'Notes',
        content: '',
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

    return {
      schemaVersion: DRAMATIC_BLOOM_SCHEMA_VERSION,
      project: {
        title: parsed.project?.title || 'Untitled Dramatic Work',
        author: parsed.project?.author,
        notes: parsed.project?.notes ?? '',
        tags: Array.isArray(parsed.project?.tags) ? parsed.project.tags : []
      },
      rootId: parsed.rootId,
      selectedId: parsed.selectedId && parsed.items[parsed.selectedId] ? parsed.selectedId : parsed.rootId,
      items: parsed.items as Record<string, DramaticBloomItem>
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
    content: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
