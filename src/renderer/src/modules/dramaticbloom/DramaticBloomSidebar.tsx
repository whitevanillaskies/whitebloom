import { FileText, Folder, Library, Plus, StickyNote } from 'lucide-react'
import type { DramaticBloomItem, DramaticBloomProject } from './model'
import { isDramaticBloomContainer } from './model'

type DramaticBloomSidebarProps = {
  project: DramaticBloomProject
  selectedId: string
  onSelect: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
}

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
  onSelect,
  onAddItem
}: {
  id: string
  depth: number
  project: DramaticBloomProject
  selectedId: string
  onSelect: (id: string) => void
  onAddItem: (parentId: string, type: DramaticBloomItem['type']) => void
}) {
  const item = project.items[id]
  if (!item) return null

  const canContain = isDramaticBloomContainer(item)

  return (
    <li className="drb-sidebar__item">
      <div
        className={`drb-sidebar__row${selectedId === item.id ? ' drb-sidebar__row--selected' : ''}`}
        style={{ paddingLeft: 10 + depth * 16 }}
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
              onSelect={onSelect}
              onAddItem={onAddItem}
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
  onAddItem
}: DramaticBloomSidebarProps) {
  return (
    <aside className="drb-sidebar">
      <div className="drb-sidebar__header">
        <div>
          <p className="drb-sidebar__label">Work</p>
          <h1>{project.project.title}</h1>
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
        <SidebarItem
          id={project.rootId}
          depth={0}
          project={project}
          selectedId={selectedId}
          onSelect={onSelect}
          onAddItem={onAddItem}
        />
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
