import { useState, type DragEvent } from 'react'
import { FileText, Folder, Plus, StickyNote } from 'lucide-react'
import type { DramaticBloomItem, DramaticBloomProject } from './model'
import {
  canMoveDramaticBloomItem,
  isDramaticBloomContainer,
  type DramaticBloomCard,
  type DramaticBloomMoveInput
} from './model'

type DramaticBloomMainContentProps = {
  project: DramaticBloomProject
  selectedId: string
  surfaceId: string
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
  onMoveItem: (input: DramaticBloomMoveInput) => void
  onPatchItem: (id: string, patch: Partial<DramaticBloomItem>) => void
}

type ContentDropIntent = DramaticBloomMoveInput

const CONTENT_DRAG_MIME = 'application/x-whitebloom-dramaticbloom-content-item'

function getTileIcon(item: DramaticBloomItem) {
  if (item.type === 'folder') return <Folder size={34} strokeWidth={1.4} />
  if (item.type === 'card') return <StickyNote size={18} strokeWidth={1.7} />
  return <FileText size={18} strokeWidth={1.7} />
}

function FolderSurface({
  item,
  project,
  selectedId,
  onSelect,
  onOpen,
  onAddItem,
  onMoveItem
}: {
  item: Extract<DramaticBloomItem, { type: 'folder' | 'card' }>
  project: DramaticBloomProject
  selectedId: string
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
  onMoveItem: (input: DramaticBloomMoveInput) => void
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<ContentDropIntent | null>(null)

  function getDropPosition(event: DragEvent): 'before' | 'after' {
    const rect = event.currentTarget.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    return event.clientX < midpoint ? 'before' : 'after'
  }

  function readDraggedId(event: DragEvent): string | null {
    return draggedId || event.dataTransfer.getData(CONTENT_DRAG_MIME) || null
  }

  function isSameSurfaceChild(id: string): boolean {
    return item.children.includes(id)
  }

  function handleDragStart(id: string, event: DragEvent): void {
    setDraggedId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(CONTENT_DRAG_MIME, id)
  }

  function handleDragEnd(): void {
    setDraggedId(null)
    setDropIntent(null)
  }

  function handleDragOver(targetId: string, event: DragEvent): void {
    const nextDraggedId = readDraggedId(event)
    if (!nextDraggedId || !isSameSurfaceChild(nextDraggedId) || !isSameSurfaceChild(targetId)) return

    const intent = {
      draggedId: nextDraggedId,
      targetId,
      position: getDropPosition(event)
    }

    if (!canMoveDramaticBloomItem(project, intent)) {
      if (dropIntent?.targetId === targetId) setDropIntent(null)
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIntent(intent)
  }

  function handleDrop(targetId: string, event: DragEvent): void {
    const nextDraggedId = readDraggedId(event)
    if (!nextDraggedId || !isSameSurfaceChild(nextDraggedId) || !isSameSurfaceChild(targetId)) return

    const intent = {
      draggedId: nextDraggedId,
      targetId,
      position: getDropPosition(event)
    }

    if (!canMoveDramaticBloomItem(project, intent)) return

    event.preventDefault()
    onMoveItem(intent)
    setDraggedId(null)
    setDropIntent(null)
  }

  return (
    <section className="drb-main">
      <header className="drb-main__header">
        <div className="drb-main__folder-mark">{item.type === 'folder' ? <Folder /> : <StickyNote />}</div>
        <div>
          <h2>{item.id === project.rootId ? project.project.title : item.title}</h2>
          {'description' in item && item.description ? <p>{item.description}</p> : null}
        </div>
        <div className="drb-main__actions">
          <button type="button" onClick={() => onAddItem(item.id, 'folder')}>
            <Plus size={15} strokeWidth={1.8} />
            Folder
          </button>
          <button type="button" onClick={() => onAddItem(item.id, 'card')}>
            <Plus size={15} strokeWidth={1.8} />
            Card
          </button>
          <button type="button" onClick={() => onAddItem(item.id, 'note')}>
            <Plus size={15} strokeWidth={1.8} />
            Note
          </button>
        </div>
      </header>
      <div className="drb-main__grid">
        {item.children.map((childId) => {
          const child = project.items[childId]
          if (!child) return null

          const summary =
            child.type === 'folder'
              ? child.description
              : child.type === 'card'
                ? child.outline
                : child.content

          return (
            <button
              key={child.id}
              className={[
                'drb-content-card',
                selectedId === child.id ? 'drb-content-card--selected' : '',
                draggedId === child.id ? 'drb-content-card--dragging' : '',
                dropIntent?.targetId === child.id
                  ? `drb-content-card--drop-${dropIntent.position}`
                  : ''
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              draggable
              onClick={() => onSelect(child.id)}
              onDoubleClick={() => onOpen(child.id)}
              onDragStart={(event) => handleDragStart(child.id, event)}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => handleDragOver(child.id, event)}
              onDrop={(event) => handleDrop(child.id, event)}
            >
              <span className="drb-content-card__handle">••</span>
              <span className="drb-content-card__icon">{getTileIcon(child)}</span>
              <strong>{child.title}</strong>
              <span className="drb-content-card__type">{child.type}</span>
              {summary ? <span className="drb-content-card__summary">{summary}</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CardSurface({
  item,
  onAddItem,
  onPatchItem
}: {
  item: DramaticBloomCard
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
  onPatchItem: (id: string, patch: Partial<DramaticBloomItem>) => void
}) {
  return (
    <section className="drb-main drb-main--card">
      <div className="drb-card-editor__actions">
        <button type="button" onClick={() => onAddItem(item.id, 'note')}>
          <Plus size={15} strokeWidth={1.8} />
          Note
        </button>
      </div>
      <div className="drb-card-editor">
        <input
          className="drb-card-editor__title"
          value={item.title}
          onChange={(event) => onPatchItem(item.id, { title: event.target.value })}
        />
        <textarea
          className="drb-card-editor__outline"
          value={item.outline}
          spellCheck
          placeholder="Outline"
          onChange={(event) => onPatchItem(item.id, { outline: event.target.value })}
        />
        <section className="drb-card-editor__metadata">
          <p>Metadata</p>
        </section>
        <label className="drb-card-editor__notes">
          <span>Writer's Notes</span>
          <textarea
            value={item.notes}
            spellCheck
            placeholder="Loose notes"
            onChange={(event) => onPatchItem(item.id, { notes: event.target.value })}
          />
        </label>
      </div>
    </section>
  )
}

export function DramaticBloomMainContent({
  project,
  selectedId,
  surfaceId,
  onSelect,
  onOpen,
  onAddItem,
  onMoveItem,
  onPatchItem
}: DramaticBloomMainContentProps) {
  const surfaceItem = project.items[surfaceId] ?? project.items[project.rootId]

  if (surfaceItem.type === 'card') {
    return <CardSurface item={surfaceItem} onAddItem={onAddItem} onPatchItem={onPatchItem} />
  }

  if (isDramaticBloomContainer(surfaceItem)) {
    return (
      <FolderSurface
        item={surfaceItem}
        project={project}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpen={onOpen}
        onAddItem={onAddItem}
        onMoveItem={onMoveItem}
      />
    )
  }

  const selectedItem = surfaceItem

  return (
    <section className="drb-main drb-main--note">
      <input
        className="drb-note-title"
        value={selectedItem.title}
        onChange={(event) => onPatchItem(selectedItem.id, { title: event.target.value })}
      />
      <textarea
        className="drb-note-body"
        value={selectedItem.content}
        spellCheck
        onChange={(event) => onPatchItem(selectedItem.id, { content: event.target.value })}
      />
    </section>
  )
}
