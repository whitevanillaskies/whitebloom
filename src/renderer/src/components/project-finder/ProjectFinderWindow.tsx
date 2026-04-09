import { useCallback, useEffect, useState } from 'react'
import {
  ChevronUp,
  Folder,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Sparkles,
  Zap
} from 'lucide-react'
import { MicaWindow } from '../../mica'
import { PetalButton } from '../petal'
import './ProjectFinderWindow.css'

export type ProjectFinderMode = 'open' | 'new-workspace'

type ProjectFinderSidebarLocation = {
  label: string
  path: string
  kind: 'drive' | 'location'
}

type ProjectFinderDirectoryEntry = {
  name: string
  path: string
  kind: 'directory' | 'workspace' | 'board' | 'quickboard'
  workspaceRoot?: string
}

type ProjectFinderWindowProps = {
  mode: ProjectFinderMode
  onClose: () => void
  preferredPath?: string | null
  busy?: boolean
  onOpenWorkspace: (workspaceRoot: string) => void
  onOpenBoard: (boardPath: string, workspaceRoot?: string) => void
  onCreateWorkspaceAtPath: (workspaceRoot: string) => void
}

export default function ProjectFinderWindow({
  mode,
  onClose,
  preferredPath,
  busy = false,
  onOpenWorkspace,
  onOpenBoard,
  onCreateWorkspaceAtPath
}: ProjectFinderWindowProps): React.JSX.Element {
  const isCreateMode = mode === 'new-workspace'
  const title = isCreateMode ? 'New Workspace' : 'Open'
  const [locations, setLocations] = useState<ProjectFinderSidebarLocation[]>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [entries, setEntries] = useState<ProjectFinderDirectoryEntry[]>([])
  const [isShellLoading, setIsShellLoading] = useState(true)
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isWorkspaceRoot, setIsWorkspaceRoot] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setIsShellLoading(true)
      const result = await window.api.getProjectFinderShell(preferredPath ?? null)
      if (cancelled) return

      if (!result.ok || !result.shell) {
        setErrorMessage('Unable to load locations.')
        setIsShellLoading(false)
        return
      }

      setLocations(result.shell.locations)
      setCurrentPath(result.shell.defaultPath)
      setErrorMessage(null)
      setIsShellLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [preferredPath])

  useEffect(() => {
    if (!currentPath) return

    let cancelled = false

    void (async () => {
      setIsDirectoryLoading(true)
      const result = await window.api.listProjectFinderDirectory(currentPath)
      if (cancelled) return

      if (!result.ok || !result.listing) {
        setEntries([])
        setParentPath(null)
        setErrorMessage('Unable to read this folder.')
        setIsDirectoryLoading(false)
        return
      }

      setEntries(result.listing.entries)
      setParentPath(result.listing.parentPath)
      setIsWorkspaceRoot(result.listing.isWorkspaceRoot)
      setCurrentPath(result.listing.path)
      setErrorMessage(null)
      setIsDirectoryLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [currentPath])

  const handleNavigate = useCallback((nextPath: string) => {
    setCurrentPath(nextPath)
  }, [])

  const handleActivateEntry = useCallback(
    (entry: ProjectFinderDirectoryEntry) => {
      if (entry.kind === 'directory') {
        handleNavigate(entry.path)
        return
      }

      if (entry.kind === 'workspace') {
        onOpenWorkspace(entry.path)
        return
      }

      if (entry.kind === 'board' || entry.kind === 'quickboard') {
        onOpenBoard(entry.path, entry.workspaceRoot)
      }
    },
    [handleNavigate, onOpenBoard, onOpenWorkspace]
  )

  const sidebar = (
    <div className="project-finder__sidebar-list">
      {locations.map((item) => (
        <button
          key={item.path}
          type="button"
          className={[
            'project-finder__sidebar-item',
            currentPath === item.path ? 'project-finder__sidebar-item--active' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => handleNavigate(item.path)}
        >
          {item.kind === 'drive' ? (
            <HardDrive size={14} strokeWidth={1.8} />
          ) : (
            <Folder size={14} strokeWidth={1.8} />
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )

  const content = isShellLoading ? (
    <div className="project-finder__status">
      <LoaderCircle size={18} strokeWidth={1.8} className="project-finder__spinner" />
      <span>Loading locations…</span>
    </div>
  ) : (
    <div className="project-finder__content">
      <div className="project-finder__toolbar">
        <button
          type="button"
          className="project-finder__toolbar-button"
          onClick={() => parentPath && handleNavigate(parentPath)}
          disabled={!parentPath || isDirectoryLoading}
        >
          <ChevronUp size={14} strokeWidth={1.8} />
          Up
        </button>
        <div className="project-finder__pathbar" title={currentPath ?? ''}>
          {currentPath ?? ''}
        </div>
      </div>

      {errorMessage ? (
        <div className="project-finder__status">
          <span>{errorMessage}</span>
        </div>
      ) : isDirectoryLoading ? (
        <div className="project-finder__status">
          <LoaderCircle size={18} strokeWidth={1.8} className="project-finder__spinner" />
          <span>Reading folder…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="project-finder__status">
          <span>Nothing to show here yet.</span>
        </div>
      ) : (
        <div className="project-finder__grid" role="listbox" aria-label="Project finder items">
          {entries.map((entry) => {
            const isNavigable = entry.kind === 'directory'
            return (
              <button
                key={entry.path}
                type="button"
                className={[
                  'project-finder__item',
                  `project-finder__item--${entry.kind}`
                ].join(' ')}
                onDoubleClick={() => handleActivateEntry(entry)}
                onClick={() => {
                  if (isNavigable) return
                }}
              >
                <div className="project-finder__item-icon-wrap">
                  <div className="project-finder__item-icon">
                    {entry.kind === 'workspace' ? (
                      <LayoutDashboard size={28} strokeWidth={1.7} />
                    ) : entry.kind === 'board' ? (
                      <LayoutDashboard size={28} strokeWidth={1.7} />
                    ) : entry.kind === 'quickboard' ? (
                      <Sparkles size={28} strokeWidth={1.7} />
                    ) : (
                      <Folder size={28} strokeWidth={1.7} />
                    )}
                  </div>
                  {entry.kind === 'quickboard' ? (
                    <span className="project-finder__item-badge" aria-hidden="true">
                      <Zap size={10} strokeWidth={2.1} />
                    </span>
                  ) : null}
                </div>
                <span className="project-finder__item-label">{entry.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="project-finder__footer">
        {isCreateMode ? (
          <div className="project-finder__footer-actions">
            <span className="project-finder__footer-note">
              {isWorkspaceRoot
                ? 'This folder is already a workspace.'
                : ''}
            </span>
            <PetalButton
              onClick={() => currentPath && onCreateWorkspaceAtPath(currentPath)}
              disabled={!currentPath || isWorkspaceRoot || isDirectoryLoading || busy}
            >
              <Plus size={14} strokeWidth={1.9} />
              Create Workspace Here
            </PetalButton>
          </div>
        ) : (
          <span className="project-finder__footer-note">
          </span>
        )}
      </div>
    </div>
  )

 return (
    <div className="project-finder__overlay">
      <div className="project-finder__surface">
        <MicaWindow
          title={title}
          onClose={onClose}
          sidebar={sidebar}
          aria-label={`${title} project finder`}
        >
          {content}
        </MicaWindow>
      </div>
    </div>
  )
}
