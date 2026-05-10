import { useState, type DragEvent } from 'react'
import { FileText, Folder, Library, Plus, StickyNote } from 'lucide-react'
import type { DramaticBloomItem, DramaticBloomProject } from './model'
import {
  canMoveDramaticBloomItem,
  isDramaticBloomContainer,
  type DramaticBloomDropPosition,
  type DramaticBloomMoveInput
} from './model'

type DramaticBloomSidebarProps = {
  project: DramaticBloomProject
  selectedId: string
  onSelect: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
  onMoveItem: (input: DramaticBloomMoveInput) => void
}

type SidebarDropIntent = DramaticBloomMoveInput

const SIDEBAR_DRAG_MIME = 'application/x-whitebloom-dramaticbloom-sidebar-item'

function getItemIcon(item: DramaticBloomItem) {
  if (item.type === 'folder') return <Folder size={14} strokeWidth={1.7} />
  if (item.type === 'card') return <StickyNote size={14} strokeWidth={1.7} />
  return <FileText size={14} strokeWidth={1.7} />
}

function SidebarItem({
  id,
  depth,
  project,
  selectedId,
  draggedId,
  dropIntent,
  onSelect,
  onAddItem,
  onDragStartItem,
  onDragEndItem,
  onDragOverItem,
  onDropItem
}: {
  id: string
  depth: number
  project: DramaticBloomProject
  selectedId: string
  draggedId: string | null
  dropIntent: SidebarDropIntent | null
  onSelect: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
  onDragStartItem: (id: string, event: DragEvent) => void
  onDragEndItem: () => void
  onDragOverItem: (id: string, event: DragEvent) => void
  onDropItem: (id: string, event: DragEvent) => void
}) {
  const item = project.items[id]
  if (!item) return null

  const canContain = isDramaticBloomContainer(item)

  return (
    <li className="drb-sidebar__item">
      <div
        className={[
          'drb-sidebar__row',
          selectedId === item.id ? 'drb-sidebar__row--selected' : '',
          draggedId === item.id ? 'drb-sidebar__row--dragging' : '',
          dropIntent?.targetId === item.id ? `drb-sidebar__row--drop-${dropIntent.position}` : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 10 + depth * 16 }}
        draggable={item.id !== project.rootId}
        onDragStart={(event) => onDragStartItem(item.id, event)}
        onDragEnd={onDragEndItem}
        onDragOver={(event) => onDragOverItem(item.id, event)}
        onDrop={(event) => onDropItem(item.id, event)}
      >
        <button className="drb-sidebar__select" type="button" onClick={() => onSelect(item.id)}>
          <span className="drb-sidebar__icon">{getItemIcon(item)}</span>
          <span className="drb-sidebar__title">{item.title}</span>
        </button>
        {canContain ? (
          <button
            className="drb-sidebar__row-action"
            type="button"
            title="Add card"
            onClick={() => onAddItem(item.id, 'card')}
          >
            <Plus size={13} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
      {canContain && item.children.length > 0 ? (
        <ol className="drb-sidebar__children">
          {item.children.map((childId) => (
            <SidebarItem
              key={childId}
              id={childId}
              depth={depth + 1}
              project={project}
              selectedId={selectedId}
              draggedId={draggedId}
              dropIntent={dropIntent}
              onSelect={onSelect}
              onAddItem={onAddItem}
              onDragStartItem={onDragStartItem}
              onDragEndItem={onDragEndItem}
              onDragOverItem={onDragOverItem}
              onDropItem={onDropItem}
            />
          ))}
        </ol>
      ) : null}
    </li>
  )
}

export function DramaticBloomSidebar({
  project,
  selectedId,
  onSelect,
  onAddItem,
  onMoveItem
}: DramaticBloomSidebarProps) {
  const rootItem = project.items[project.rootId]
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<SidebarDropIntent | null>(null)

  function getDropPosition(targetId: string, event: DragEvent): DramaticBloomDropPosition {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = rect.height === 0 ? 0.5 : (event.clientY - rect.top) / rect.height
    const target = project.items[targetId]

    if (ratio < 0.28) return 'before'
    if (ratio > 0.72) return 'after'
    if (isDramaticBloomContainer(target)) return 'inside'
    return 'after'
  }

  function readDraggedId(event: DragEvent): string | null {
    return (
      draggedId ||
      event.dataTransfer.getData(SIDEBAR_DRAG_MIME) ||
      event.dataTransfer.getData('text/plain') ||
      null
    )
  }

  function handleDragStartItem(id: string, event: DragEvent): void {
    setDraggedId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(SIDEBAR_DRAG_MIME, id)
    event.dataTransfer.setData('text/plain', id)
  }

  function handleDragEndItem(): void {
    setDraggedId(null)
    setDropIntent(null)
  }

  function handleDragOverItem(targetId: string, event: DragEvent): void {
    const nextDraggedId = readDraggedId(event)
    if (!nextDraggedId) return

    const intent = {
      draggedId: nextDraggedId,
      targetId,
      position: getDropPosition(targetId, event)
    }

    if (!canMoveDramaticBloomItem(project, intent)) {
      if (dropIntent?.targetId === targetId) setDropIntent(null)
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIntent(intent)
  }

  function handleDropItem(targetId: string, event: DragEvent): void {
    const nextDraggedId = readDraggedId(event)
    if (!nextDraggedId) return

    const intent = {
      draggedId: nextDraggedId,
      targetId,
      position: getDropPosition(targetId, event)
    }

    if (!canMoveDramaticBloomItem(project, intent)) return

    event.preventDefault()
    onMoveItem(intent)
    setDraggedId(null)
    setDropIntent(null)
  }

  function handleRootDragOver(event: DragEvent): void {
    const nextDraggedId = readDraggedId(event)
    if (!nextDraggedId) return

    const intent = {
      draggedId: nextDraggedId,
      targetId: project.rootId,
      position: 'inside' as const
    }

    if (!canMoveDramaticBloomItem(project, intent)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIntent(intent)
  }

  function handleRootDrop(event: DragEvent): void {
    const nextDraggedId = readDraggedId(event)
    if (!nextDraggedId) return

    const intent = {
      draggedId: nextDraggedId,
      targetId: project.rootId,
      position: 'inside' as const
    }

    if (!canMoveDramaticBloomItem(project, intent)) return

    event.preventDefault()
    onMoveItem(intent)
    setDraggedId(null)
    setDropIntent(null)
  }

  return (
    <aside className="drb-sidebar">
      <div className="drb-sidebar__header">
        <div>
          <p className="drb-sidebar__label">Work</p>
          <h1
            className={[
              'drb-sidebar__project-title',
              selectedId === project.rootId ? 'drb-sidebar__project-title--selected' : '',
              dropIntent?.targetId === project.rootId ? 'drb-sidebar__project-title--drop-inside' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(project.rootId)}
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
          >
            {project.project.title}
          </h1>
        </div>
        <button
          className="drb-icon-button"
          type="button"
          title="Add folder"
          onClick={() => onAddItem(project.rootId, 'folder')}
        >
          <Plus size={16} strokeWidth={1.8} />
        </button>
      </div>
      <ol className="drb-sidebar__tree">
        {rootItem && rootItem.type !== 'note'
          ? rootItem.children.map((childId) => (
              <SidebarItem
                key={childId}
                id={childId}
                depth={0}
                project={project}
                selectedId={selectedId}
                draggedId={draggedId}
                dropIntent={dropIntent}
                onSelect={onSelect}
                onAddItem={onAddItem}
                onDragStartItem={handleDragStartItem}
                onDragEndItem={handleDragEndItem}
                onDragOverItem={handleDragOverItem}
                onDropItem={handleDropItem}
              />
            ))
          : null}
      </ol>
      <div className="drb-sidebar__registries">
        <button type="button">
          <Library size={14} strokeWidth={1.7} />
          Characters
        </button>
        <button type="button">
          <Folder size={14} strokeWidth={1.7} />
          Locations
        </button>
      </div>
    </aside>
  )
}
