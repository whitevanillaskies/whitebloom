import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronUp,
  CornerDownLeft,
  Folder,
  FolderPlus,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Sparkles,
  X,
  Zap
} from 'lucide-react'
import { MicaWindow } from '../../mica'
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
  const [isInsideWorkspace, setIsInsideWorkspace] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [isNewFolderActive, setIsNewFolderActive] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

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
      setIsInsideWorkspace(result.listing.isInsideWorkspace)
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
    setIsNewFolderActive(false)
    setNewFolderName('')
  }, [])

  const handleOpenNewFolder = useCallback(() => {
    setIsNewFolderActive(true)
    setNewFolderName('')
    // Focus on next tick after render
    setTimeout(() => newFolderInputRef.current?.focus(), 0)
  }, [])

  const handleCancelNewFolder = useCallback(() => {
    setIsNewFolderActive(false)
    setNewFolderName('')
  }, [])

  const handleConfirmNewFolder = useCallback(async () => {
    if (!currentPath || !newFolderName.trim()) return
    const result = await window.api.createProjectFinderFolder(currentPath, newFolderName.trim())
    if (result.ok && result.path) {
      setIsNewFolderActive(false)
      setNewFolderName('')
      setCurrentPath(result.path)
    }
  }, [currentPath, newFolderName])

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
      <div className="project-finder__nav">
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
          <button
            type="button"
            className="project-finder__toolbar-button"
            onClick={handleOpenNewFolder}
            disabled={isDirectoryLoading || busy || isNewFolderActive}
            title="New Folder"
            aria-label="New Folder"
          >
            <FolderPlus size={14} strokeWidth={1.8} />
          </button>
        </div>

        {isCreateMode && (
          <div className="project-finder__name-row">
            <input
              className="project-finder__name-input"
              type="text"
              placeholder="New workspace name…"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (!currentPath || !workspaceName.trim() || isWorkspaceRoot || isInsideWorkspace || isDirectoryLoading || busy) return
                const sep = currentPath.endsWith('/') || currentPath.endsWith('\\') ? '' : '/'
                onCreateWorkspaceAtPath(currentPath + sep + workspaceName.trim())
              }}
              disabled={isWorkspaceRoot || isInsideWorkspace || busy}
              autoFocus
              aria-label="New workspace name"
            />
            <button
              type="button"
              className="project-finder__toolbar-button"
              onClick={() => {
                if (!currentPath || !workspaceName.trim()) return
                const sep = currentPath.endsWith('/') || currentPath.endsWith('\\') ? '' : '/'
                onCreateWorkspaceAtPath(currentPath + sep + workspaceName.trim())
              }}
              disabled={!currentPath || !workspaceName.trim() || isWorkspaceRoot || isInsideWorkspace || isDirectoryLoading || busy}
              aria-label="Confirm create workspace"
              title="Create workspace"
            >
              <CornerDownLeft size={14} strokeWidth={1.8} />
            </button>
            {(isWorkspaceRoot || isInsideWorkspace) && (
              <span className="project-finder__nav-note">
                {isWorkspaceRoot ? 'Already a workspace.' : 'Inside a workspace.'}
              </span>
            )}
          </div>
        )}

        {isNewFolderActive && (
          <div className="project-finder__name-row">
            <input
              ref={newFolderInputRef}
              className="project-finder__name-input"
              type="text"
              placeholder="New folder name…"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirmNewFolder()
                if (e.key === 'Escape') handleCancelNewFolder()
              }}
              disabled={busy}
              aria-label="New folder name"
            />
            <button
              type="button"
              className="project-finder__toolbar-button"
              onClick={() => void handleConfirmNewFolder()}
              disabled={!newFolderName.trim() || busy}
              aria-label="Confirm new folder"
              title="Create folder"
            >
              <CornerDownLeft size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="project-finder__toolbar-button"
              onClick={handleCancelNewFolder}
              aria-label="Cancel new folder"
              title="Cancel"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        )}
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
