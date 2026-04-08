import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutGrid, List, LayoutDashboard, Link } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import type { ArrangementsMaterial, GardenBin } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import { PetalToolbarSearch, PetalToolbarSegmented } from '../petal/window'
import { MicaWindow } from '../../mica'
import './BinView.css'

type ViewMode = 'icon' | 'list'

// ── Icon resolution ────────────────────────────────────────────────────────────

type IconState =
  | { status: 'loading' }
  | { status: 'ready'; dataUrl: string }
  | { status: 'fallback' }

function useMaterialIcon(material: ArrangementsMaterial, workspaceRoot: string): IconState {
  const [state, setState] = useState<IconState>({ status: 'loading' })

  useEffect(() => {
    if (material.kind === 'board') {
      setState({ status: 'fallback' })
      return
    }
    let cancelled = false
    void (async () => {
      const result = await window.api.getFileIcon(workspaceRoot, material.key)
      if (cancelled) return
      setState(
        result.ok && result.dataUrl
          ? { status: 'ready', dataUrl: result.dataUrl }
          : { status: 'fallback' }
      )
    })()
    return () => {
      cancelled = true
    }
  }, [material.kind, material.key, workspaceRoot])

  return state
}

// ── Sidebar bin row ────────────────────────────────────────────────────────────

type SidebarRowProps = {
  bin: GardenBin
  isActive: boolean
  onClick: () => void
  onDropMaterial: (materialKey: string, binId: string) => void
}

function SidebarRow({
  bin,
  isActive,
  onClick,
  onDropMaterial
}: SidebarRowProps): React.JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const key = e.dataTransfer.getData('application/x-wb-material-key')
      if (key) onDropMaterial(key, bin.id)
    },
    [bin.id, onDropMaterial]
  )

  return (
    <div
      className={[
        'bin-view__sidebar-row',
        isActive ? 'bin-view__sidebar-row--active' : '',
        isDragOver ? 'bin-view__sidebar-row--drag-over' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="bin-view__sidebar-row-name">{bin.name}</span>
    </div>
  )
}

// ── Icon grid item ─────────────────────────────────────────────────────────────

type IconItemProps = {
  material: ArrangementsMaterial
  workspaceRoot: string
  selected: boolean
  onSelect: (key: string, additive: boolean) => void
  onDoubleClick: (material: ArrangementsMaterial) => void
}

function IconItem({
  material,
  workspaceRoot,
  selected,
  onSelect,
  onDoubleClick
}: IconItemProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) e.stopPropagation()
      onSelect(material.key, e.metaKey || e.ctrlKey)
    },
    [material.key, onSelect]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(material)
    },
    [material, onDoubleClick]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('application/x-wb-material-key', material.key)
    },
    [material.key]
  )

  return (
    <div
      className={[
        'bin-view__icon-item',
        selected ? 'bin-view__icon-item--selected' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      draggable
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onDragStart={handleDragStart}
      role="option"
      aria-selected={selected}
      aria-label={material.displayName}
      tabIndex={-1}
    >
      <div className="bin-view__icon-item-wrap">
        {material.kind === 'board' ? (
          <LayoutDashboard size={28} strokeWidth={1.4} className="bin-view__icon-board" />
        ) : iconState.status === 'ready' ? (
          <img
            src={iconState.dataUrl}
            alt=""
            className="bin-view__icon-item-img"
            draggable={false}
          />
        ) : (
          <div className="bin-view__icon-placeholder" aria-hidden="true" />
        )}
        {material.kind === 'linked' && (
          <span className="bin-view__icon-link-badge" title="Externally linked">
            ↗
          </span>
        )}
      </div>
      <span className="bin-view__icon-item-label">{material.displayName}</span>
    </div>
  )
}

// ── List row ───────────────────────────────────────────────────────────────────

type ListRowProps = {
  material: ArrangementsMaterial
  workspaceRoot: string
  selected: boolean
  onSelect: (key: string, additive: boolean) => void
  onDoubleClick: (material: ArrangementsMaterial) => void
}

function ListRow({
  material,
  workspaceRoot,
  selected,
  onSelect,
  onDoubleClick
}: ListRowProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) e.stopPropagation()
      onSelect(material.key, e.metaKey || e.ctrlKey)
    },
    [material.key, onSelect]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(material)
    },
    [material, onDoubleClick]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('application/x-wb-material-key', material.key)
    },
    [material.key]
  )

  return (
    <div
      className={[
        'bin-view__list-row',
        selected ? 'bin-view__list-row--selected' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      draggable
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onDragStart={handleDragStart}
      role="option"
      aria-selected={selected}
      aria-label={material.displayName}
      tabIndex={-1}
    >
      <div className="bin-view__list-row-icon">
        {material.kind === 'board' ? (
          <LayoutDashboard size={15} strokeWidth={1.4} className="bin-view__icon-board" />
        ) : iconState.status === 'ready' ? (
          <img
            src={iconState.dataUrl}
            alt=""
            className="bin-view__list-icon-img"
            draggable={false}
          />
        ) : (
          <div className="bin-view__icon-placeholder bin-view__icon-placeholder--sm" aria-hidden="true" />
        )}
      </div>
      <span className="bin-view__list-row-name">{material.displayName}</span>
      {material.extension ? (
        <span className="bin-view__list-row-ext">{material.extension}</span>
      ) : null}
      {material.kind === 'linked' ? (
        <Link
          size={10}
          strokeWidth={1.8}
          className="bin-view__list-row-link-icon"
          aria-label="Externally linked"
        />
      ) : null}
    </div>
  )
}

// ── BinView ────────────────────────────────────────────────────────────────────

type BinViewProps = {
  windowId: string
  binId: string
  uiState: {
    kind: 'bin-view'
    preferences: {
      viewMode: ViewMode
    }
    ephemeral: {
      searchQuery: string
      selectedKeys: string[]
    }
  }
  onOpenBoard: (boardPath: string) => void
  onOpenBin: (binId: string) => void
  onClose: () => void
  onViewModeChange: (viewMode: ViewMode) => void
  onSearchQueryChange: (searchQuery: string) => void
  onSelectedKeysChange: (selectedKeys: string[]) => void
}

export default function BinView({
  windowId,
  binId,
  uiState,
  onOpenBoard,
  onOpenBin,
  onClose,
  onViewModeChange,
  onSearchQueryChange,
  onSelectedKeysChange
}: BinViewProps): React.JSX.Element | null {
  const bins = useArrangementsStore((s) => s.bins)
  const materials = useArrangementsStore((s) => s.materials)
  const binAssignments = useArrangementsStore((s) => s.binAssignments)
  const assignToBin = useArrangementsStore((s) => s.assignToBin)
  const sendToTrash = useArrangementsStore((s) => s.sendToTrash)
  const emptyTrash = useArrangementsStore((s) => s.emptyTrash)
  const workspaceRoot = useWorkspaceStore((s) => s.root)

  const [isContentDragOver, setIsContentDragOver] = useState(false)
  const selectedKeys = uiState.ephemeral.selectedKeys
  const selectedKeySet = new Set(selectedKeys)

  const handleContentDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('application/x-wb-material-key')) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setIsContentDragOver(true)
    },
    []
  )

  const handleContentDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsContentDragOver(false)
    }
  }, [])

  const handleContentDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsContentDragOver(false)
      const materialKey = e.dataTransfer.getData('application/x-wb-material-key')
      if (!materialKey) return
      if (binId === SYSTEM_TRASH_BIN_ID) sendToTrash(materialKey)
      else assignToBin(materialKey, binId)
    },
    [assignToBin, binId, sendToTrash]
  )

  const handleSelect = useCallback((key: string, additive: boolean) => {
    const nextSelectedKeys = (() => {
      const prev = selectedKeys
      if (additive) {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return [...next]
      }
      return [key]
    })()

    onSelectedKeysChange(nextSelectedKeys)
  }, [onSelectedKeysChange, selectedKeys])

  const handleDoubleClick = useCallback(
    (material: ArrangementsMaterial) => {
      if (material.kind === 'board' && workspaceRoot) {
        const relPath = material.key.replace(/^wloc:/, '')
        const sep =
          workspaceRoot.endsWith('/') || workspaceRoot.endsWith('\\') ? '' : '/'
        onOpenBoard(workspaceRoot + sep + relPath)
      }
    },
    [workspaceRoot, onOpenBoard]
  )

  const handleDropMaterial = useCallback(
    (materialKey: string, binId: string) => {
      if (binId === SYSTEM_TRASH_BIN_ID) sendToTrash(materialKey)
      else assignToBin(materialKey, binId)
    },
    [sendToTrash, assignToBin]
  )

  // Stable ref so the effect below doesn't re-run on every render
  const handleKeyDownRef = useRef<(e: KeyboardEvent) => Promise<void>>(async () => {})

  // Keep ref updated
  const isTrash = binId === SYSTEM_TRASH_BIN_ID
  handleKeyDownRef.current = useCallback(
    async (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (selectedKeys.length === 0) return
      // Ignore when typing in an input
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      e.preventDefault()

      if (isTrash) {
        if (!workspaceRoot) return
        const trashKeys = [...selectedKeys]

        // Check references (parallel, best-effort)
        const refResults = await Promise.all(
          trashKeys.map((key) => window.api.getArrangementsReferences(workspaceRoot, key))
        )
        const allBoardPaths = new Set<string>()
        for (const result of refResults) {
          if (result.ok) result.boardPaths.forEach((p) => allBoardPaths.add(p))
        }

        const msg =
          allBoardPaths.size > 0
            ? `${trashKeys.length} item(s) are still referenced by ${allBoardPaths.size} board(s). Permanently delete anyway?`
            : `Permanently delete ${trashKeys.length} item(s)? This cannot be undone.`

        if (!window.confirm(msg)) return
        await emptyTrash()
      } else {
        // Move to trash
        for (const key of selectedKeys) sendToTrash(key)
        onSelectedKeysChange([])
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKeys, isTrash, workspaceRoot, emptyTrash, sendToTrash, onSelectedKeysChange]
  )

  useEffect(() => {
    const listener = (e: KeyboardEvent) => void handleKeyDownRef.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const activeBin = bins.find((b) => b.id === binId)
  if (!activeBin) return null

  const binMaterials = materials.filter((m) => binAssignments[m.key] === binId)
  const q = uiState.ephemeral.searchQuery.trim().toLowerCase()
  const filteredMaterials = q
    ? binMaterials.filter((m) => m.displayName.toLowerCase().includes(q))
    : binMaterials

  const sidebar = (
    <div className="bin-view__sidebar-list">
      {bins.map((bin) => (
        <SidebarRow
          key={bin.id}
          bin={bin}
          isActive={bin.id === binId}
          onClick={() => onOpenBin(bin.id)}
          onDropMaterial={handleDropMaterial}
        />
      ))}
    </div>
  )

  const headerActions = (
    <>
      <PetalToolbarSegmented
        value={uiState.preferences.viewMode}
        onChange={onViewModeChange}
        items={[
          {
            value: 'icon',
            label: 'Icon view',
            icon: <LayoutGrid size={13} strokeWidth={1.8} />
          },
          {
            value: 'list',
            label: 'List view',
            icon: <List size={13} strokeWidth={1.8} />
          }
        ]}
      />

      <PetalToolbarSearch
        label="Search materials"
        value={uiState.ephemeral.searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        // TODO: i18n
        placeholder="Search"
        data-mica-no-drag="true"
      />
    </>
  )

  return (
    <MicaWindow
      key={windowId}
      className="bin-view"
      title={activeBin.name}
      onClose={onClose}
      headerActions={headerActions}
      sidebar={sidebar}
      aria-label={`${activeBin.name} bin view`}
    >
      <div
        className={['bin-view__content-drop', isContentDragOver ? 'bin-view__content-drop--over' : ''].filter(Boolean).join(' ')}
        onDragOver={handleContentDragOver}
        onDragLeave={handleContentDragLeave}
        onDrop={handleContentDrop}
      >
      {filteredMaterials.length === 0 ? (
        <p className="bin-view__empty">
          {q ? 'No matching items.' : 'Empty.'}
        </p>
      ) : uiState.preferences.viewMode === 'icon' ? (
        <div
          className="bin-view__icon-grid"
          role="listbox"
          aria-label={`${activeBin.name} contents`}
        >
          {filteredMaterials.map((material) => (
            <IconItem
              key={material.key}
              material={material}
              workspaceRoot={workspaceRoot ?? ''}
              selected={selectedKeySet.has(material.key)}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
            />
          ))}
        </div>
      ) : (
        <div
          className="bin-view__list"
          role="listbox"
          aria-label={`${activeBin.name} contents`}
        >
          {filteredMaterials.map((material) => (
            <ListRow
              key={material.key}
              material={material}
              workspaceRoot={workspaceRoot ?? ''}
              selected={selectedKeySet.has(material.key)}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
            />
          ))}
        </div>
      )}
      </div>
    </MicaWindow>
  )
}


