import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, List, LayoutDashboard, Link } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import type { ArrangementsMaterial, GardenBin } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import { PetalSpacer } from '../petal'
import {
  PetalToolbar,
  PetalToolbarGroup,
  PetalToolbarSearch,
  PetalToolbarSegmented
} from '../petal/window'
import { MicaWindow } from '../../mica'
import {
  ARRANGEMENTS_MICA_HOST_ID,
  createArrangementsDropTargetId,
  useArrangementsDragTargetActive,
  useArrangementsDropTarget,
  useArrangementsMaterialDrag,
  useArrangementsMaterialDragging,
  useArrangementsSpringLoadHover
} from './arrangementsDrag'
import { useControlledArrangementsMaterialSelection } from './arrangementsSelection'
import {
  deleteMaterialsFromTrashWithReferenceGuard,
  sendMaterialsToTrashWithReferenceGuard
} from './materialReferences'
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
}

function SidebarRow({
  bin,
  isActive,
  onClick
}: SidebarRowProps): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null)
  const targetId = createArrangementsDropTargetId('bin', `sidebar-${bin.id}`)
  const isDropActive = useArrangementsDragTargetActive(targetId)
  const isSpringLoadReady = useArrangementsSpringLoadHover(targetId)
  const dropTargetMeta = useMemo(
    () =>
      ({
        type: 'bin',
        binId: bin.id
      } as const),
    [bin.id]
  )

  useArrangementsDropTarget({
    id: targetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: rowRef.current,
    meta: dropTargetMeta
  })

  return (
    <div
      ref={rowRef}
      className={[
        'bin-view__sidebar-row',
        isActive ? 'bin-view__sidebar-row--active' : '',
        isDropActive ? 'bin-view__sidebar-row--drag-over' : '',
        isSpringLoadReady ? 'bin-view__sidebar-row--intent-ready' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
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
  selectedKeys: string[]
  sourceBinId: string
  onSelect: (key: string, additive: boolean) => void
  onDragCommitted: (materialKeys: string[]) => void
  onDoubleClick: (material: ArrangementsMaterial) => void
}

function IconItem({
  material,
  workspaceRoot,
  selected,
  selectedKeys,
  sourceBinId,
  onSelect,
  onDragCommitted,
  onDoubleClick
}: IconItemProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)
  const draggedByMica = useArrangementsMaterialDragging(material.key)
  const drag = useArrangementsMaterialDrag({
    materialKey: material.key,
    materialLabel: material.displayName,
    selectedKeys,
    source:
      sourceBinId === SYSTEM_TRASH_BIN_ID
        ? { kind: 'trash' }
        : {
            kind: 'bin',
            binId: sourceBinId
          },
    onSelect,
    onDragCommitted
  })

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(material)
    },
    [material, onDoubleClick]
  )

  return (
    <div
      className={[
        'bin-view__icon-item',
        selected ? 'bin-view__icon-item--selected' : '',
        draggedByMica ? 'bin-view__icon-item--dragging' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onDoubleClick={handleDoubleClick}
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
  selectedKeys: string[]
  sourceBinId: string
  onSelect: (key: string, additive: boolean) => void
  onDragCommitted: (materialKeys: string[]) => void
  onDoubleClick: (material: ArrangementsMaterial) => void
}

function ListRow({
  material,
  workspaceRoot,
  selected,
  selectedKeys,
  sourceBinId,
  onSelect,
  onDragCommitted,
  onDoubleClick
}: ListRowProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)
  const draggedByMica = useArrangementsMaterialDragging(material.key)
  const drag = useArrangementsMaterialDrag({
    materialKey: material.key,
    materialLabel: material.displayName,
    selectedKeys,
    source:
      sourceBinId === SYSTEM_TRASH_BIN_ID
        ? { kind: 'trash' }
        : {
            kind: 'bin',
            binId: sourceBinId
          },
    onSelect,
    onDragCommitted
  })

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(material)
    },
    [material, onDoubleClick]
  )

  return (
    <div
      className={[
        'bin-view__list-row',
        selected ? 'bin-view__list-row--selected' : '',
        draggedByMica ? 'bin-view__list-row--dragging' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onDoubleClick={handleDoubleClick}
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
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const contentDropRef = useRef<HTMLDivElement>(null)
  const contentTargetId = createArrangementsDropTargetId(
    binId === SYSTEM_TRASH_BIN_ID ? 'trash' : 'bin',
    `content-${binId}`
  )
  const isContentDropActive = useArrangementsDragTargetActive(contentTargetId)
  const contentDropTargetMeta = useMemo(
    () =>
      binId === SYSTEM_TRASH_BIN_ID
        ? ({ type: 'trash' } as const)
        : ({
            type: 'bin',
            binId
          } as const),
    [binId]
  )
  const { clear, isSelected, retain, select, selectedKeys } = useControlledArrangementsMaterialSelection(
    uiState.ephemeral.selectedKeys,
    onSelectedKeysChange
  )

  useArrangementsDropTarget({
    id: contentTargetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: contentDropRef.current,
    meta: contentDropTargetMeta
  })

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

  const handleDragCommitted = useCallback(() => {
    clear()
  }, [clear])

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
        const trashKeys = [...selectedKeys]
        const deleted = await deleteMaterialsFromTrashWithReferenceGuard(trashKeys)
        if (!deleted) return
      } else {
        const moved = await sendMaterialsToTrashWithReferenceGuard(selectedKeys)
        if (!moved) return
        clear()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clear, selectedKeys, isTrash]
  )

  useEffect(() => {
    const listener = (e: KeyboardEvent) => void handleKeyDownRef.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const activeBin = bins.find((b) => b.id === binId)
  const binMaterials = materials.filter((m) => binAssignments[m.key] === binId)
  const q = uiState.ephemeral.searchQuery.trim().toLowerCase()
  const filteredMaterials = q
    ? binMaterials.filter((m) => m.displayName.toLowerCase().includes(q))
    : binMaterials

  useEffect(() => {
    retain(filteredMaterials.map((material) => material.key))
  }, [filteredMaterials, retain])

  if (!activeBin) return null

  const sidebar = (
    <div className="bin-view__sidebar-list">
      {bins.map((bin) => (
        <SidebarRow
          key={bin.id}
          bin={bin}
          isActive={bin.id === binId}
          onClick={() => onOpenBin(bin.id)}
        />
      ))}
    </div>
  )

  const toolbar = (
    <PetalToolbar>
      <PetalToolbarGroup>
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
      </PetalToolbarGroup>

      <PetalSpacer size={30} data-mica-no-drag="true" />

      <PetalToolbarGroup>
        <PetalToolbarSearch
          label="Search materials"
          value={uiState.ephemeral.searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          // TODO: i18n
          placeholder="Search"
          data-mica-no-drag="true"
        />
      </PetalToolbarGroup>
    </PetalToolbar>
  )

  return (
    <MicaWindow
      key={windowId}
      className="bin-view"
      title={activeBin.name}
      onClose={onClose}
      toolbar={toolbar}
      sidebar={sidebar}
      aria-label={`${activeBin.name} bin view`}
    >
      <div
        ref={contentDropRef}
        className={[
          'bin-view__content-drop',
          isContentDropActive ? 'bin-view__content-drop--over' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ display: 'block', height: '100%' }}
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
              selected={isSelected(material.key)}
              selectedKeys={selectedKeys}
              sourceBinId={binId}
              onSelect={select}
              onDragCommitted={handleDragCommitted}
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
              selected={isSelected(material.key)}
              selectedKeys={selectedKeys}
              sourceBinId={binId}
              onSelect={select}
              onDragCommitted={handleDragCommitted}
              onDoubleClick={handleDoubleClick}
            />
          ))}
        </div>
      )}
      </div>
    </MicaWindow>
  )
}


