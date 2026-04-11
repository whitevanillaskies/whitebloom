import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, FolderTree, LayoutDashboard, Layers, Link, Link2, Pencil, Trash2 } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import { MicaWindow } from '../../mica'
import { PetalMenu } from '../petal'
import type { PetalMenuItem } from '../petal'
import type { ArrangementsMaterial, GardenSetNode } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import { resolveWorkspaceBoardPath } from '../../shared/board-resource'
import {
  ARRANGEMENTS_MICA_HOST_ID,
  createArrangementsDropTargetId,
  useArrangementsDragTargetActive,
  useArrangementsDropTarget,
  useArrangementsMaterialDrag,
  useArrangementsMaterialDragging,
  useArrangementsSpringLoadHover,
  type ArrangementsDragSource,
  type ArrangementsDropResolution,
  type ArrangementsMaterialDragPayload
} from './arrangementsDrag'
import './MaterialsWindow.css'

// ── Sidebar selection ──────────────────────────────────────────────────────────

type SidebarSel =
  | { kind: 'bins' }
  | { kind: 'set'; id: string }
  | { kind: 'smart-set'; id: 'stale' }
  | { kind: 'trash' }

const SEL_BINS: SidebarSel = { kind: 'bins' }
const SEL_STALE: SidebarSel = { kind: 'smart-set', id: 'stale' }
const SEL_TRASH: SidebarSel = { kind: 'trash' }

// ── Material row ───────────────────────────────────────────────────────────────

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

type MaterialRowProps = {
  material: ArrangementsMaterial
  workspaceRoot: string
  dragSource: ArrangementsDragSource
  onActivate: (material: ArrangementsMaterial) => void
  onResolveDrop?: (
    resolution: ArrangementsDropResolution,
    payload: ArrangementsMaterialDragPayload
  ) => boolean
}

function MaterialRow({
  material,
  workspaceRoot,
  dragSource,
  onActivate,
  onResolveDrop
}: MaterialRowProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)
  const draggedByMica = useArrangementsMaterialDragging(material.key)
  const drag = useArrangementsMaterialDrag({
    materialKey: material.key,
    materialLabel: material.displayName,
    source: dragSource,
    onResolveDrop
  })

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onActivate(material)
    },
    [material, onActivate]
  )

  return (
    <div
      className={[
        'materials-window__material-row',
        draggedByMica ? 'materials-window__material-row--dragging' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      aria-label={material.displayName}
    >
      <span className="materials-window__material-icon" aria-hidden="true">
        {material.kind === 'board' ? (
          <LayoutDashboard size={14} strokeWidth={1.5} />
        ) : material.kind === 'linked' ? (
          <Link2 size={14} strokeWidth={1.5} />
        ) : iconState.status === 'ready' ? (
          <img src={iconState.dataUrl} alt="" className="materials-window__material-icon-img" />
        ) : (
          <div className="materials-window__material-icon-placeholder" />
        )}
      </span>
      <span className="materials-window__material-name">{material.displayName}</span>
      {material.extension ? (
        <span className="materials-window__material-ext">{material.extension}</span>
      ) : null}
    </div>
  )
}

// ── Bin section (collapsible) ──────────────────────────────────────────────────

type BinSectionProps = {
  title: string
  materials: ArrangementsMaterial[]
  workspaceRoot: string
  defaultExpanded?: boolean
  dropBinId?: string
  onActivateMaterial: (material: ArrangementsMaterial) => void
  onResolveDrop?: (
    resolution: ArrangementsDropResolution,
    payload: ArrangementsMaterialDragPayload
  ) => boolean
}

function BinSection({
  title,
  materials,
  workspaceRoot,
  defaultExpanded = true,
  dropBinId,
  onActivateMaterial,
  onResolveDrop
}: BinSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const sectionRef = useRef<HTMLDivElement>(null)
  const targetId = dropBinId
    ? createArrangementsDropTargetId('bin', `materials-window-${dropBinId}`)
    : null
  const isDropActive = useArrangementsDragTargetActive(targetId ?? '')
  const isSpringLoadReady = useArrangementsSpringLoadHover(targetId ?? '')
  const dropTargetMeta = useMemo(
    () =>
      dropBinId
        ? ({
            type: 'bin',
            binId: dropBinId
          } as const)
        : undefined,
    [dropBinId]
  )

  useArrangementsDropTarget({
    id: targetId ?? 'arrangements:bin:materials-window-disabled',
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: dropBinId ? sectionRef.current : null,
    priority: dropBinId ? 2 : undefined,
    meta: dropTargetMeta
  })

  return (
    <div
      ref={sectionRef}
      className={[
        'materials-window__bin-section',
        isDropActive ? 'materials-window__bin-section--drag-over' : '',
        isSpringLoadReady ? 'materials-window__bin-section--intent-ready' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="materials-window__bin-heading"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span
          className={[
            'materials-window__bin-chevron',
            expanded ? 'materials-window__bin-chevron--open' : ''
          ].join(' ')}
          aria-hidden="true"
        >
          ›
        </span>
        <span className="materials-window__bin-title">{title}</span>
        <span className="materials-window__bin-count">{materials.length}</span>
      </button>
      {expanded && materials.length > 0 && (
        <div className="materials-window__bin-items">
          {materials.map((m) => (
            <MaterialRow
              key={m.key}
              material={m}
              workspaceRoot={workspaceRoot}
              dragSource={dropBinId ? { kind: 'bin', binId: dropBinId } : { kind: 'desktop' }}
              onActivate={onActivateMaterial}
              onResolveDrop={onResolveDrop}
            />
          ))}
        </div>
      )}
      {expanded && materials.length === 0 && (
        <p className="materials-window__bin-empty">Empty</p>
      )}
    </div>
  )
}

// ── Set tree node (sidebar) ────────────────────────────────────────────────────

type SetTreeNodeProps = {
  node: GardenSetNode
  depth: number
  expandedIds: Set<string>
  selectedId: string | null
  pendingRenameTarget: { kind: 'bin' | 'set'; id: string } | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onOpenContextMenu: (setId: string, anchor: { x: number; y: number }) => void
  onRenameCommit: (setId: string, name: string) => void
  onRenameCancel: () => void
  onResolveDrop?: (
    resolution: ArrangementsDropResolution,
    payload: ArrangementsMaterialDragPayload
  ) => boolean
}

function SetTreeNode({
  node,
  depth,
  expandedIds,
  selectedId,
  pendingRenameTarget,
  onToggle,
  onSelect,
  onOpenContextMenu,
  onRenameCommit,
  onRenameCancel,
  onResolveDrop
}: SetTreeNodeProps): React.JSX.Element {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const isPendingRename = pendingRenameTarget?.kind === 'set' && pendingRenameTarget.id === node.id
  const [draftName, setDraftName] = useState(node.name)
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const targetId = createArrangementsDropTargetId('set', `materials-window-${node.id}`)
  const isDropActive = useArrangementsDragTargetActive(targetId)
  const isSpringLoadReady = useArrangementsSpringLoadHover(targetId)
  const dropTargetMeta = useMemo(
    () =>
      ({
        type: 'set',
        setId: node.id
      } as const),
    [node.id]
  )

  useArrangementsDropTarget({
    id: targetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: rowRef.current,
    priority: 2,
    meta: dropTargetMeta
  })

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (hasChildren) onToggle(node.id)
    },
    [hasChildren, node.id, onToggle]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(node.id)
    },
    [node.id, onSelect]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      onOpenContextMenu(node.id, { x: e.clientX, y: e.clientY })
    },
    [node.id, onOpenContextMenu]
  )

  const commitRename = useCallback(() => {
    const normalizedName = draftName.trim()
    if (!normalizedName) {
      setDraftName(node.name)
      onRenameCancel()
      return
    }
    onRenameCommit(node.id, normalizedName)
  }, [draftName, node.id, node.name, onRenameCancel, onRenameCommit])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitRename()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraftName(node.name)
        onRenameCancel()
      }
    },
    [commitRename, node.name, onRenameCancel]
  )

  useEffect(() => {
    setDraftName(node.name)
  }, [node.name])

  useEffect(() => {
    if (!isPendingRename) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isPendingRename])

  return (
    <li className="materials-window__set-item">
      <div
        ref={rowRef}
        className={[
          'materials-window__set-row',
          isSelected ? 'materials-window__set-row--selected' : '',
          isDropActive ? 'materials-window__set-row--drag-over' : '',
          isSpringLoadReady ? 'materials-window__set-row--intent-ready' : ''
        ].join(' ')}
        style={{ paddingLeft: 10 + depth * 12 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
      >
        <span
          className={[
            'materials-window__set-chevron',
            hasChildren ? 'materials-window__set-chevron--visible' : '',
            isExpanded ? 'materials-window__set-chevron--open' : ''
          ].join(' ')}
          onClick={handleChevronClick}
          aria-hidden="true"
        >
          ›
        </span>
        {isPendingRename ? (
          <input
            ref={inputRef}
            className="materials-window__set-rename-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Rename set"
          />
        ) : (
          <span className="materials-window__set-label">{node.name}</span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <ul className="materials-window__set-subtree" role="group">
          {node.children.map((child) => (
            <SetTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              pendingRenameTarget={pendingRenameTarget}
              onToggle={onToggle}
              onSelect={onSelect}
              onOpenContextMenu={onOpenContextMenu}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onResolveDrop={onResolveDrop}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type MaterialsWindowProps = {
  onClose: () => void
  onOpenBoard: (boardPath: string) => void
  onPlaceMaterialsOnCanvas?: (
    materials: ArrangementsMaterial[],
    screenPoint: { x: number; y: number }
  ) => void
}

export default function MaterialsWindow({
  onClose,
  onOpenBoard,
  onPlaceMaterialsOnCanvas
}: MaterialsWindowProps): React.JSX.Element {
  const windowRef = useRef<HTMLDivElement>(null)
  const materials = useArrangementsStore((s) => s.materials)
  const bins = useArrangementsStore((s) => s.bins)
  const sets = useArrangementsStore((s) => s.sets)
  const memberships = useArrangementsStore((s) => s.memberships)
  const binAssignments = useArrangementsStore((s) => s.binAssignments)
  const createRootSet = useArrangementsStore((s) => s.createRootSet)
  const createChildSet = useArrangementsStore((s) => s.createChildSet)
  const renameSet = useArrangementsStore((s) => s.renameSet)
  const deleteSet = useArrangementsStore((s) => s.deleteSet)
  const saveArrangements = useArrangementsStore((s) => s.saveArrangements)
  const pendingRenameTarget = useArrangementsStore((s) => s.pendingRenameTarget)
  const markPendingRenameTarget = useArrangementsStore((s) => s.markPendingRenameTarget)
  const workspaceRoot = useWorkspaceStore((s) => s.root)

  const [sel, setSel] = useState<SidebarSel>(SEL_BINS)
  const [setExpandedIds, setSetExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenuState, setContextMenuState] = useState<
    | { kind: 'root'; anchor: { x: number; y: number } }
    | { kind: 'child'; setId: string; anchor: { x: number; y: number } }
    | null
  >(null)

  const userBins = useMemo(
    () => bins.filter((b) => b.kind === 'user'),
    [bins]
  )

  // Non-trash materials (trash bin excluded from the list view)
  const visibleMaterials = useMemo(
    () => materials.filter((m) => binAssignments[m.key] !== SYSTEM_TRASH_BIN_ID),
    [materials, binAssignments]
  )

  // Trash bin
  const trashMaterials = useMemo(
    () => materials.filter((m) => binAssignments[m.key] === SYSTEM_TRASH_BIN_ID),
    [materials, binAssignments]
  )

  // Bins view: group materials by bin
  const looseMaterials = useMemo(
    () => visibleMaterials.filter((m) => !(m.key in binAssignments)),
    [visibleMaterials, binAssignments]
  )

  const binMaterialsMap = useMemo(() => {
    const map = new Map<string, ArrangementsMaterial[]>()
    for (const bin of userBins) {
      map.set(bin.id, [])
    }
    for (const m of visibleMaterials) {
      const binId = binAssignments[m.key]
      if (binId && map.has(binId)) {
        map.get(binId)!.push(m)
      }
    }
    return map
  }, [visibleMaterials, binAssignments, userBins])

  // Set / smart-set view: filter materials
  const filteredMaterials = useMemo(() => {
    if (sel.kind === 'bins') return []
    if (sel.kind === 'trash') return []
    if (sel.kind === 'smart-set') {
      // Stale: not yet computable without cross-board analysis
      return []
    }
    // Set lens
    const memberKeys = new Set(
      memberships
        .filter((m) => m.setId === sel.id)
        .map((m) => m.materialKey)
    )
    return visibleMaterials.filter((m) => memberKeys.has(m.key))
  }, [sel, memberships, visibleMaterials])

  const handleToggleSet = useCallback((id: string) => {
    setSetExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelectSet = useCallback((id: string) => {
    setSel({ kind: 'set', id })
  }, [])

  const handleOpenRootContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rowTarget = (e.target as HTMLElement | null)?.closest('.materials-window__set-row')
    if (rowTarget) return
    e.preventDefault()
    setContextMenuState({ kind: 'root', anchor: { x: e.clientX, y: e.clientY } })
  }, [])

  const handleOpenChildContextMenu = useCallback(
    (setId: string, anchor: { x: number; y: number }) => {
      if (anchor.x < 0 || anchor.y < 0) {
        void createChildSet(setId)
        return
      }
      setContextMenuState({ kind: 'child', setId, anchor })
    },
    [createChildSet]
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState(null)
  }, [])

  const contextMenuItems = useMemo<PetalMenuItem[]>(() => {
    if (!contextMenuState) return []

    if (contextMenuState.kind === 'root') {
      return [
        {
          id: 'new-root-set',
          label: 'New Set',
          icon: <Layers size={14} strokeWidth={1.7} />,
          onActivate: () => { void createRootSet() }
        }
      ]
    }

    return [
      {
        id: 'new-child-set',
        label: 'New Child Set',
        subtitle: 'Create a nested set under this set',
        icon: <FolderTree size={14} strokeWidth={1.7} />,
        onActivate: () => { void createChildSet(contextMenuState.setId) }
      },
      {
        id: 'rename-set',
        label: 'Rename Set',
        icon: <Pencil size={14} strokeWidth={1.7} />,
        onActivate: () => { markPendingRenameTarget({ kind: 'set', id: contextMenuState.setId }) }
      },
      {
        id: 'remove-set',
        label: 'Remove Set',
        icon: <Trash2 size={14} strokeWidth={1.7} />,
        intent: 'destructive',
        onActivate: () => {
          deleteSet(contextMenuState.setId)
          void saveArrangements()
        }
      }
    ]
  }, [contextMenuState, createChildSet, createRootSet, deleteSet, markPendingRenameTarget, saveArrangements])

  const handleRenameCommit = useCallback(
    (setId: string, name: string) => { void renameSet(setId, name) },
    [renameSet]
  )

  const handleRenameCancel = useCallback(() => {
    markPendingRenameTarget(null)
  }, [markPendingRenameTarget])

  const handleActivateMaterial = useCallback(
    (material: ArrangementsMaterial) => {
      if (material.kind === 'board' && workspaceRoot) {
        const boardPath = resolveWorkspaceBoardPath(material.key, workspaceRoot)
        if (boardPath) onOpenBoard(boardPath)
      } else if (material.kind === 'linked') {
        if (material.key.startsWith('https://') || material.key.startsWith('http://')) {
          void window.api.openUrl(material.key)
        } else {
          void window.api.openFile(material.key)
        }
      }
    },
    [workspaceRoot, onOpenBoard]
  )

  const selectedSetId = sel.kind === 'set' ? sel.id : null
  const materialsByKey = useMemo(
    () => new Map(materials.map((material) => [material.key, material] as const)),
    [materials]
  )
  const windowOccluderTargetId = useMemo(
    () => createArrangementsDropTargetId('window', 'materials-window'),
    []
  )

  useArrangementsDropTarget({
    id: windowOccluderTargetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: windowRef.current,
    priority: 1,
    meta: {
      type: 'occluder'
    }
  })

  const handleResolveDrop = useCallback(
    (resolution: ArrangementsDropResolution, payload: ArrangementsMaterialDragPayload) => {
      const meta = resolution.target?.meta
      if (meta?.type === 'occluder') return true
      if (!meta || meta.type !== 'canvas') return false
      if (!onPlaceMaterialsOnCanvas) return false

      const droppedMaterials = payload.materialKeys
        .map((materialKey) => materialsByKey.get(materialKey))
        .filter((material): material is ArrangementsMaterial => material !== undefined)
      if (droppedMaterials.length === 0) return false

      onPlaceMaterialsOnCanvas(droppedMaterials, resolution.pointer.screen)
      return true
    },
    [materialsByKey, onPlaceMaterialsOnCanvas]
  )

  const sidebar = (
    <div className="materials-window__sidebar">
      {/* Bins anchor */}
      <div className="materials-window__sidebar-section">
        <button
          type="button"
          className={[
            'materials-window__nav-row',
            sel.kind === 'bins' ? 'materials-window__nav-row--selected' : ''
          ].join(' ')}
          onClick={() => setSel(SEL_BINS)}
        >
          <Boxes size={12} strokeWidth={1.6} className="materials-window__nav-icon" aria-hidden="true" />
          <span className="materials-window__nav-label">Bins</span>
        </button>
        <button
          type="button"
          className={[
            'materials-window__nav-row',
            sel.kind === 'trash' ? 'materials-window__nav-row--selected' : ''
          ].join(' ')}
          onClick={() => setSel(SEL_TRASH)}
        >
          <Trash2 size={12} strokeWidth={1.6} className="materials-window__nav-icon" aria-hidden="true" />
          <span className="materials-window__nav-label">Trash</span>
          {trashMaterials.length > 0 && (
            <span className="materials-window__nav-count">{trashMaterials.length}</span>
          )}
        </button>        
      </div>


      {/* Sets tree */}
      <div
        className="materials-window__sidebar-section materials-window__sidebar-section--sets"
        onContextMenu={handleOpenRootContextMenu}
      >
        <span className="materials-window__sidebar-heading">Sets</span>
        {sets.length > 0 ? (
          <ul className="materials-window__set-tree" role="tree" aria-label="Sets">
            {sets.map((node) => (
              <SetTreeNode
                key={node.id}
                node={node}
                depth={0}
                expandedIds={setExpandedIds}
                selectedId={selectedSetId}
                pendingRenameTarget={pendingRenameTarget}
                onToggle={handleToggleSet}
                onSelect={handleSelectSet}
                onOpenContextMenu={handleOpenChildContextMenu}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={handleRenameCancel}
                onResolveDrop={handleResolveDrop}
              />
            ))}
          </ul>
        ) : null}
      </div>

      {/* Smart Sets */}
      <div className="materials-window__sidebar-section materials-window__sidebar-section--smart">
        <span className="materials-window__sidebar-heading">Smart Sets</span>
        <button
          type="button"
          className={[
            'materials-window__nav-row',
            sel.kind === 'smart-set' && sel.id === 'stale'
              ? 'materials-window__nav-row--selected'
              : ''
          ].join(' ')}
          onClick={() => setSel(SEL_STALE)}
        >
          <Link size={12} strokeWidth={1.6} className="materials-window__nav-icon materials-window__nav-icon--smart" aria-hidden="true" />
          <span className="materials-window__nav-label">Stale</span>
        </button>
      </div>
    </div>
  )

  return (
    <MicaWindow
      title="Materials"
      onClose={onClose}
      sidebar={sidebar}
      className="materials-window"
      windowRef={windowRef}
      aria-label="Materials"
    >
      <div className="materials-window__content">
        {workspaceRoot === null ? (
          <p className="materials-window__empty">No workspace open.</p>
        ) : sel.kind === 'bins' ? (
          <div className="materials-window__bins-view">
            {looseMaterials.length > 0 && (
              <BinSection
                title="Loose"
                materials={looseMaterials}
                workspaceRoot={workspaceRoot}
                onActivateMaterial={handleActivateMaterial}
                onResolveDrop={handleResolveDrop}
              />
            )}
            {userBins.map((bin) => (
              <BinSection
                key={bin.id}
                title={bin.name}
                materials={binMaterialsMap.get(bin.id) ?? []}
                workspaceRoot={workspaceRoot}
                dropBinId={bin.id}
                onActivateMaterial={handleActivateMaterial}
                onResolveDrop={handleResolveDrop}
              />
            ))}
            {looseMaterials.length === 0 && userBins.length === 0 && (
              <p className="materials-window__empty">No materials in this workspace.</p>
            )}
          </div>
        ) : sel.kind === 'trash' ? (
          <div className="materials-window__set-view">
            {trashMaterials.length === 0 ? (
              <p className="materials-window__empty">Trash is empty.</p>
            ) : (
              trashMaterials.map((m) => (
                <MaterialRow
                  key={m.key}
                  material={m}
                  workspaceRoot={workspaceRoot}
                  dragSource={{ kind: 'trash' }}
                  onActivate={handleActivateMaterial}
                  onResolveDrop={handleResolveDrop}
                />
              ))
            )}
          </div>
        ) : sel.kind === 'smart-set' && sel.id === 'stale' ? (
          <div className="materials-window__set-view">
            <p className="materials-window__empty">
              Stale detection requires cross-board analysis — coming soon.
            </p>
          </div>
        ) : (
          <div className="materials-window__set-view">
            {filteredMaterials.length === 0 ? (
              <p className="materials-window__empty">No materials in this set.</p>
            ) : (
              filteredMaterials.map((m) => (
                <MaterialRow
                  key={m.key}
                  material={m}
                  workspaceRoot={workspaceRoot}
                  dragSource={{ kind: 'set', setId: sel.id }}
                  onActivate={handleActivateMaterial}
                  onResolveDrop={handleResolveDrop}
                />
              ))
            )}
          </div>
        )}
      </div>
      {contextMenuState ? (
        <PetalMenu
          items={contextMenuItems}
          anchor={contextMenuState.anchor}
          onClose={handleCloseContextMenu}
        />
      ) : null}
    </MicaWindow>
  )
}
