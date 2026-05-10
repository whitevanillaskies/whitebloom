import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudEditorProps } from '../types'
import { DramaticBloomInspector } from './DramaticBloomInspector'
import { DramaticBloomMainContent } from './DramaticBloomMainContent'
import { DramaticBloomSidebar } from './DramaticBloomSidebar'
import {
  createDramaticBloomItem,
  parseDramaticBloomProject,
  serializeDramaticBloomProject,
  type DramaticBloomItem,
  type DramaticBloomProject
} from './model'
import './DramaticBloomEditor.css'

const AUTOSAVE_DELAY_MS = 500

function touchItem<T extends DramaticBloomItem>(item: T): T {
  return { ...item, updatedAt: new Date().toISOString() }
}

export function DramaticBloomEditor({ initialData, onSave, onClose }: BudEditorProps) {
  const [project, setProject] = useState(() => parseDramaticBloomProject(initialData))
  const [surfaceId, setSurfaceId] = useState(project.selectedId ?? project.rootId)
  const [chromeHidden, setChromeHidden] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingProjectRef = useRef(project)

  const selectedId = project.selectedId ?? project.rootId
  const selectedItem = project.items[selectedId] ?? project.items[project.rootId]
  const canHideChrome = selectedItem?.type === 'note'

  const scheduleSave = useCallback(
    (nextProject: DramaticBloomProject) => {
      pendingProjectRef.current = nextProject
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onSave(serializeDramaticBloomProject(nextProject)).catch(() => {})
        saveTimerRef.current = null
      }, AUTOSAVE_DELAY_MS)
    },
    [onSave]
  )

  const updateProject = useCallback(
    (updater: (previous: DramaticBloomProject) => DramaticBloomProject) => {
      setProject((previous) => {
        const nextProject = updater(previous)
        scheduleSave(nextProject)
        return nextProject
      })
    },
    [scheduleSave]
  )

  const flushAndClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    onSave(serializeDramaticBloomProject(pendingProjectRef.current)).catch(() => {})
    onClose()
  }, [onClose, onSave])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!canHideChrome && chromeHidden) setChromeHidden(false)
  }, [canHideChrome, chromeHidden])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        flushAndClose()
        return
      }

      if (event.key.toLowerCase() === 'f' && canHideChrome) {
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
          return
        }
        event.preventDefault()
        setChromeHidden((hidden) => !hidden)
      }
    },
    [canHideChrome, flushAndClose]
  )

  const handleSelect = useCallback(
    (id: string) => {
      updateProject((previous) => ({ ...previous, selectedId: id }))
    },
    [updateProject]
  )

  const handleOpen = useCallback(
    (id: string) => {
      setSurfaceId(id)
      updateProject((previous) => ({ ...previous, selectedId: id }))
    },
    [updateProject]
  )

  const handleAddItem = useCallback(
    (parentId: string, type: DramaticBloomItem['type']) => {
      updateProject((previous) => {
        const parent = previous.items[parentId]
        if (!parent || parent.type === 'note') return previous

        const item = createDramaticBloomItem(type)
        return {
          ...previous,
          selectedId: item.id,
          items: {
            ...previous.items,
            [parent.id]: touchItem({ ...parent, children: [...parent.children, item.id] }),
            [item.id]: item
          }
        }
      })
    },
    [updateProject]
  )

  const handlePatchProject = useCallback(
    (patch: Partial<DramaticBloomProject['project']>) => {
      updateProject((previous) => ({
        ...previous,
        project: {
          ...previous.project,
          ...patch
        }
      }))
    },
    [updateProject]
  )

  const handlePatchItem = useCallback(
    (id: string, patch: Partial<DramaticBloomItem>) => {
      updateProject((previous) => {
        const item = previous.items[id]
        if (!item) return previous
        return {
          ...previous,
          items: {
            ...previous.items,
            [id]: touchItem({ ...item, ...patch } as DramaticBloomItem)
          }
        }
      })
    },
    [updateProject]
  )

  const rootClassName = useMemo(
    () => `drb-editor${chromeHidden ? ' drb-editor--chrome-hidden' : ''}`,
    [chromeHidden]
  )

  return (
    <div className={rootClassName} onKeyDown={handleKeyDown}>
      {!chromeHidden ? (
        <DramaticBloomSidebar
          project={project}
          selectedId={selectedId}
          onSelect={handleOpen}
          onAddItem={handleAddItem}
        />
      ) : null}
      <DramaticBloomMainContent
        project={project}
        selectedId={selectedId}
        surfaceId={surfaceId}
        onSelect={handleSelect}
        onOpen={handleOpen}
        onAddItem={handleAddItem}
        onPatchItem={handlePatchItem}
      />
      {!chromeHidden ? (
        <DramaticBloomInspector
          project={project}
          selectedId={selectedId}
          onPatchProject={handlePatchProject}
          onPatchItem={handlePatchItem}
        />
      ) : null}
    </div>
  )
}
