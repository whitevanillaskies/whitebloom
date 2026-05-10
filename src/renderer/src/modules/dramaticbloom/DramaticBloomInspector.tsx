import { FileText, Folder, StickyNote } from 'lucide-react'
import type { DramaticBloomItem, DramaticBloomProject } from './model'

type DramaticBloomInspectorProps = {
  project: DramaticBloomProject
  selectedId: string
  onPatchProject: (patch: Partial<DramaticBloomProject['project']>) => void
  onPatchItem: (id: string, patch: Partial<DramaticBloomItem>) => void
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function joinTags(tags: string[]): string {
  return tags.join(', ')
}

export function DramaticBloomInspector({
  project,
  selectedId,
  onPatchProject,
  onPatchItem
}: DramaticBloomInspectorProps) {
  const selectedItem = project.items[selectedId]

  if (!selectedItem || selectedItem.id === project.rootId) {
    return (
      <aside className="drb-inspector">
        <p className="drb-inspector__label">Project</p>
        <label>
          Title
          <input
            value={project.project.title}
            onChange={(event) => onPatchProject({ title: event.target.value })}
          />
        </label>
        <label>
          Author
          <input
            value={project.project.author ?? ''}
            onChange={(event) => onPatchProject({ author: event.target.value })}
          />
        </label>
        <label>
          Work notes
          <textarea
            value={project.project.notes}
            onChange={(event) => onPatchProject({ notes: event.target.value })}
          />
        </label>
      </aside>
    )
  }

  return (
    <aside className="drb-inspector">
      <p className="drb-inspector__label">
        {selectedItem.type === 'folder' ? <Folder size={13} /> : null}
        {selectedItem.type === 'card' ? <StickyNote size={13} /> : null}
        {selectedItem.type === 'note' ? <FileText size={13} /> : null}
        {selectedItem.type}
      </p>
      <label>
        Title
        <input
          value={selectedItem.title}
          onChange={(event) => onPatchItem(selectedItem.id, { title: event.target.value })}
        />
      </label>
      <label>
        Tags
        <input
          value={joinTags(selectedItem.tags)}
          onChange={(event) => onPatchItem(selectedItem.id, { tags: splitTags(event.target.value) })}
        />
      </label>
      {selectedItem.type === 'folder' ? (
        <label>
          Description
          <textarea
            value={selectedItem.description}
            onChange={(event) => onPatchItem(selectedItem.id, { description: event.target.value })}
          />
        </label>
      ) : null}
      {selectedItem.type === 'card' ? (
        <>
          <label>
            Code
            <input
              value={selectedItem.code}
              onChange={(event) => onPatchItem(selectedItem.id, { code: event.target.value })}
            />
          </label>
          <label>
            Outline
            <textarea
              value={selectedItem.outline}
              onChange={(event) => onPatchItem(selectedItem.id, { outline: event.target.value })}
            />
          </label>
          <label>
            Stuff
            <textarea
              value={selectedItem.notes}
              onChange={(event) => onPatchItem(selectedItem.id, { notes: event.target.value })}
            />
          </label>
        </>
      ) : null}
      {selectedItem.type === 'note' ? (
        <label>
          Note type
          <select
            value={selectedItem.noteType}
            onChange={(event) =>
              onPatchItem(selectedItem.id, { noteType: event.target.value as 'plain' | 'book' })
            }
          >
            <option value="plain">Plain text</option>
            <option value="book">Book</option>
          </select>
        </label>
      ) : null}
    </aside>
  )
}
