import { FileText, Folder, Plus, StickyNote } from 'lucide-react'
import type { DramaticBloomItem, DramaticBloomProject } from './model'
import { isDramaticBloomContainer } from './model'

type DramaticBloomMainContentProps = {
  project: DramaticBloomProject
  selectedId: string
  surfaceId: string
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
  onPatchItem: (id: string, patch: Partial<DramaticBloomItem>) => void
}

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
  onAddItem
}: {
  item: Extract<DramaticBloomItem, { type: 'folder' | 'card' }>
  project: DramaticBloomProject
  selectedId: string
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
}) {
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
              className={`drb-content-card${selectedId === child.id ? ' drb-content-card--selected' : ''}`}
              type="button"
              onClick={() => onSelect(child.id)}
              onDoubleClick={() => onOpen(child.id)}
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

export function DramaticBloomMainContent({
  project,
  selectedId,
  surfaceId,
  onSelect,
  onOpen,
  onAddItem,
  onPatchItem
}: DramaticBloomMainContentProps) {
  const surfaceItem = project.items[surfaceId] ?? project.items[project.rootId]

  if (isDramaticBloomContainer(surfaceItem)) {
    return (
      <FolderSurface
        item={surfaceItem}
        project={project}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpen={onOpen}
        onAddItem={onAddItem}
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
