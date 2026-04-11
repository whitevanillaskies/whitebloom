import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  File,
  FolderTree,
  LayoutDashboard,
  Layers,
  Link,
  Link2,
  Pencil,
  Trash2
} from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import { MicaWindow, useMicaDragState } from '../../mica'
import { PetalMenu } from '../petal'
import type { PetalMenuItem } from '../petal'
import {
  PetalToolbar,
  PetalToolbarGroup,
  PetalToolbarButton
} from '../petal/window'
import type { ArrangementsMaterial, GardenBin, GardenSetNode } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import { resolveWorkspaceBoardPath } from '../../shared/board-resource'
import {
  ARRANGEMENTS_MICA_HOST_ID,
  ARRANGEMENTS_MATERIAL_DRAG_KIND,
  createArrangementsDropTargetId,
  useArrangementsDragTargetActive,
  useArrangementsDropTarget,
  useArrangementsMaterialDrag,
  useArrangementsMaterialDragging,
  useArrangementsSpringLoadHover,
  type ArrangementsDragSource,
  type ArrangementsDropResolution,
  type ArrangementsMaterialDragPayload,
  type ArrangementsMaterialDragPreview,
  type ArrangementsDropTargetMeta
} from './arrangementsDrag'
import {
  deleteMaterialsFromTrashWithReferenceGuard,
  getLiveMaterialReferenceIndex
} from './materialReferences'
import './MaterialsWindow.css'

// ── Sidebar selection ──────────────────────────────────────────────────────────

type SidebarSel =
  | { kind: 'bins' }
  | { kind: 'bin'; id: string }
  | { kind: 'set'; id: string }
  | { kind: 'smart-set'; id: 'stale' }
  | { kind: 'trash' }

const SEL_BINS: SidebarSel = { kind: 'bins' }
const SEL_STALE: SidebarSel = { kind: 'smart-set', id: 'stale' }
const SEL_TRASH: SidebarSel = { kind: 'trash' }
const EMPTY_MATERIAL_KEY_SET = new Set<string>()

// ── Material row ───────────────────────────────────────────────────────────────

type IconState =
  | { status: 'loading' }
  | { status: 'ready'; dataUrl: string }
  | { status: 'fallback' }

function isWebLinkedMaterialKey(resource: string): boolean {
  const normalized = resource.trim()
  return normalized.startsWith('http://') || normalized.startsWith('https://')
}

function useMaterialIcon(material: ArrangementsMaterial, workspaceRoot: string): IconState {
  const [state, setState] = useState<IconState>({ status: 'loading' })

  useEffect(() => {
    if (
      material.kind === 'board' ||
      (material.kind === 'linked' && isWebLinkedMaterialKey(material.key))
    ) {
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
  pendingRenameTarget?: { kind: 'bin' | 'set'; id: string } | null
  onActivateMaterial: (material: ArrangementsMaterial) => void
  onOpenContextMenu?: (binId: string, anchor: { x: number; y: number }) => void
  onRenameCommit?: (binId: string, name: string) => void
  onRenameCancel?: () => void
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
  pendingRenameTarget,
  onActivateMaterial,
  onOpenContextMenu,
  onRenameCommit,
  onRenameCancel,
  onResolveDrop
}: BinSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const sectionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isPendingRename = Boolean(
    dropBinId && pendingRenameTarget?.kind === 'bin' && pendingRenameTarget.id === dropBinId
  )
  const [draftName, setDraftName] = useState(title)

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

  useEffect(() => {
    setDraftName(title)
  }, [title])

  useEffect(() => {
    if (!isPendingRename) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isPendingRename])

  const commitRename = useCallback(() => {
    if (!dropBinId) return
    const normalized = draftName.trim()
    if (!normalized) {
      setDraftName(title)
      onRenameCancel?.()
      return
    }
    onRenameCommit?.(dropBinId, normalized)
  }, [dropBinId, draftName, title, onRenameCancel, onRenameCommit])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitRename()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraftName(title)
        onRenameCancel?.()
      }
    },
    [commitRename, title, onRenameCancel]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dropBinId || !onOpenContextMenu) return
      e.preventDefault()
      e.stopPropagation()
      onOpenContextMenu(dropBinId, { x: e.clientX, y: e.clientY })
    },
    [dropBinId, onOpenContextMenu]
  )

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
      onContextMenu={handleContextMenu}
    >
      <div
        className="materials-window__bin-heading"
        onClick={() => !isPendingRename && setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        role="button"
        tabIndex={0}
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
        {isPendingRename ? (
          <input
            ref={inputRef}
            className="materials-window__bin-rename-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Rename bin"
          />
        ) : (
          <span className="materials-window__bin-title">{title}</span>
        )}
        <span className="materials-window__bin-count">{materials.length}</span>
      </div>
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
      {expanded && materials.length === 0 && <p className="materials-window__bin-empty">Empty</p>}
    </div>
  )
}

// ── Sidebar bin row ────────────────────────────────────────────────────────────

type SidebarBinRowProps = {
  bin: GardenBin
  isSelected: boolean
  onSelect: () => void
}

function SidebarBinRow({ bin, isSelected, onSelect }: SidebarBinRowProps): React.JSX.Element {
  const rowRef = useRef<HTMLButtonElement>(null)
  const targetId = useMemo(
    () => createArrangementsDropTargetId('bin', `mw-sidebar-${bin.id}`),
    [bin.id]
  )
  const isDropActive = useArrangementsDragTargetActive(targetId)
  const isSpringLoadReady = useArrangementsSpringLoadHover(targetId)
  const dropTargetMeta = useMemo(
    () => ({ type: 'bin', binId: bin.id } as const),
    [bin.id]
  )

  useArrangementsDropTarget({
    id: targetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: rowRef.current,
    priority: 2,
    meta: dropTargetMeta
  })

  return (
    <button
      ref={rowRef}
      type="button"
      className={[
        'materials-window__nav-row',
        'materials-window__nav-row--bin',
        isSelected ? 'materials-window__nav-row--selected' : '',
        isDropActive ? 'materials-window__nav-row--drag-over' : '',
        isSpringLoadReady ? 'materials-window__nav-row--intent-ready' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onSelect}
    >
      <span className="materials-window__nav-label">{bin.name}</span>
    </button>
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
      }) as const,
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
        style={{ '--materials-window-set-depth': depth } as React.CSSProperties}
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

// ── Drag ghost ────────────────────────────────────────────────────────────────

export function MaterialsDragGhost(): React.JSX.Element | null {
  const session = useMicaDragState((state) => state.session)
  const activeTargetId = useMicaDragState((state) => state.activeTargetId)
  const activeTarget = useMicaDragState((state) =>
    state.activeTargetId ? state.targets[state.activeTargetId] : null
  )

  if (session?.payload.kind !== ARRANGEMENTS_MATERIAL_DRAG_KIND) return null

  const payload = session.payload.data as ArrangementsMaterialDragPayload
  const preview = session.preview?.meta as ArrangementsMaterialDragPreview | undefined
  const activeMeta = activeTarget?.meta as ArrangementsDropTargetMeta | undefined
  const label = preview?.label ?? payload.primaryMaterialKey
  const count = preview?.count ?? payload.materialKeys.length
  const stackCount = preview?.stackCount ?? count
  const tone = activeMeta?.type === 'trash' ? 'danger' : activeTargetId ? 'accept' : 'neutral'

  return (
    <div
      className={['materials-window__drag-ghost', `materials-window__drag-ghost--${tone}`].join(
        ' '
      )}
      style={{
        left: session.pointer.screen.x + 10,
        top: session.pointer.screen.y + 14,
        ['--mw-drag-stack' as string]: Math.min(stackCount, 3)
      }}
      aria-hidden="true"
    >
      {stackCount > 1 ? (
        <div className="materials-window__drag-ghost-stack" aria-hidden="true" />
      ) : null}
      <div className="materials-window__drag-ghost-card">
        <File size={12} strokeWidth={1.5} className="materials-window__drag-ghost-file-icon" />
        <span className="materials-window__drag-ghost-name">{label}</span>
        {count > 1 ? <span className="materials-window__drag-ghost-badge">{count}</span> : null}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type MaterialsWindowProps = {
  onClose: () => void
  onOpenBoard: (boardPath: string) => void
  currentBoardReferencedMaterialKeys?: Set<string>
  onPlaceMaterialsOnCanvas?: (
    materials: ArrangementsMaterial[],
    screenPoint: { x: number; y: number }
  ) => void
}

export default function MaterialsWindow({
  onClose,
  onOpenBoard,
  currentBoardReferencedMaterialKeys,
  onPlaceMaterialsOnCanvas
}: MaterialsWindowProps): React.JSX.Element {
  const windowRef = useRef<HTMLDivElement>(null)
  const binsRowRef = useRef<HTMLButtonElement>(null)
  const trashRowRef = useRef<HTMLButtonElement>(null)
  const materials = useArrangementsStore((s) => s.materials)
  const bins = useArrangementsStore((s) => s.bins)
  const sets = useArrangementsStore((s) => s.sets)
  const memberships = useArrangementsStore((s) => s.memberships)
  const binAssignments = useArrangementsStore((s) => s.binAssignments)
  const createBin = useArrangementsStore((s) => s.createBin)
  const renameBin = useArrangementsStore((s) => s.renameBin)
  const deleteBin = useArrangementsStore((s) => s.deleteBin)
  const createRootSet = useArrangementsStore((s) => s.createRootSet)
  const createChildSet = useArrangementsStore((s) => s.createChildSet)
  const renameSet = useArrangementsStore((s) => s.renameSet)
  const deleteSet = useArrangementsStore((s) => s.deleteSet)
  const saveArrangements = useArrangementsStore((s) => s.saveArrangements)
  const pendingRenameTarget = useArrangementsStore((s) => s.pendingRenameTarget)
  const markPendingRenameTarget = useArrangementsStore((s) => s.markPendingRenameTarget)
  const workspaceRoot = useWorkspaceStore((s) => s.root)

  const [sel, setSel] = useState<SidebarSel>(SEL_BINS)
  const [binsExpanded, setBinsExpanded] = useState(true)
  const [setExpandedIds, setSetExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenuState, setContextMenuState] = useState<
    | { kind: 'root'; anchor: { x: number; y: number } }
    | { kind: 'child'; setId: string; anchor: { x: number; y: number } }
    | null
  >(null)
  const [binContextMenuState, setBinContextMenuState] = useState<
    | { kind: 'root'; anchor: { x: number; y: number } }
    | { kind: 'bin'; binId: string; anchor: { x: number; y: number } }
    | null
  >(null)
  const [referencedMaterialKeys, setReferencedMaterialKeys] = useState<Set<string>>(new Set())
  const [isReferenceScanPending, setIsReferenceScanPending] = useState(false)

  const userBins = useMemo(() => bins.filter((b) => b.kind === 'user'), [bins])

  // If the selected bin is deleted, fall back to the all-bins overview
  useEffect(() => {
    if (sel.kind === 'bin' && !userBins.some((b) => b.id === sel.id)) {
      setSel(SEL_BINS)
    }
  }, [sel, userBins])

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

  useEffect(() => {
    if (workspaceRoot === null) {
      setReferencedMaterialKeys(new Set())
      setIsReferenceScanPending(false)
      return
    }

    const currentBoardKeys = currentBoardReferencedMaterialKeys ?? EMPTY_MATERIAL_KEY_SET
    setReferencedMaterialKeys(new Set(currentBoardKeys))

    if (materials.length === 0 || workspaceRoot === null) {
      setIsReferenceScanPending(false)
      return
    }

    let cancelled = false
    setIsReferenceScanPending(true)

    void (async () => {
      const referencesByMaterialKey = await getLiveMaterialReferenceIndex(
        materials.map((material) => material.key)
      )
      if (cancelled) return
      setReferencedMaterialKeys(
        new Set(
          Object.entries(referencesByMaterialKey)
            .filter(([, boardPaths]) => boardPaths.length > 0)
            .map(([materialKey]) => materialKey)
        )
      )
      setIsReferenceScanPending(false)
    })()

    return () => {
      cancelled = true
    }
  }, [currentBoardReferencedMaterialKeys, materials, workspaceRoot])

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

  const staleMaterials = useMemo(
    () =>
      visibleMaterials.filter(
        (material) => material.kind !== 'board' && !referencedMaterialKeys.has(material.key)
      ),
    [referencedMaterialKeys, visibleMaterials]
  )

  // Set / smart-set view: filter materials
  const filteredMaterials = useMemo(() => {
    if (sel.kind === 'bins') return []
    if (sel.kind === 'trash') return []
    if (sel.kind === 'smart-set') {
      return staleMaterials
    }
    // Set lens
    const memberKeys = new Set(
      memberships.filter((m) => m.setId === sel.id).map((m) => m.materialKey)
    )
    return visibleMaterials.filter((m) => memberKeys.has(m.key))
  }, [sel, memberships, staleMaterials, visibleMaterials])

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
          onActivate: () => {
            void createRootSet()
          }
        }
      ]
    }

    return [
      {
        id: 'new-child-set',
        label: 'New Child Set',
        subtitle: 'Create a nested set under this set',
        icon: <FolderTree size={14} strokeWidth={1.7} />,
        onActivate: () => {
          void createChildSet(contextMenuState.setId)
        }
      },
      {
        id: 'rename-set',
        label: 'Rename Set',
        icon: <Pencil size={14} strokeWidth={1.7} />,
        onActivate: () => {
          markPendingRenameTarget({ kind: 'set', id: contextMenuState.setId })
        }
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
  }, [
    contextMenuState,
    createChildSet,
    createRootSet,
    deleteSet,
    markPendingRenameTarget,
    saveArrangements
  ])

  const handleRenameCommit = useCallback(
    (setId: string, name: string) => {
      void renameSet(setId, name)
    },
    [renameSet]
  )

  const handleRenameCancel = useCallback(() => {
    markPendingRenameTarget(null)
  }, [markPendingRenameTarget])

  // ── Bin context menu ──────────────────────────────────────────────────────────

  const handleOpenBinsViewContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const headingTarget = (e.target as HTMLElement | null)?.closest(
      '.materials-window__bin-heading'
    )
    if (headingTarget) return
    e.preventDefault()
    setBinContextMenuState({ kind: 'root', anchor: { x: e.clientX, y: e.clientY } })
  }, [])

  const handleOpenBinContextMenu = useCallback(
    (binId: string, anchor: { x: number; y: number }) => {
      setBinContextMenuState({ kind: 'bin', binId, anchor })
    },
    []
  )

  const handleCloseBinContextMenu = useCallback(() => {
    setBinContextMenuState(null)
  }, [])

  const binContextMenuItems = useMemo<PetalMenuItem[]>(() => {
    if (!binContextMenuState) return []

    if (binContextMenuState.kind === 'root') {
      return [
        {
          id: 'new-bin',
          label: 'New Bin',
          icon: <Archive size={14} strokeWidth={1.7} />,
          onActivate: () => {
            const binId = createBin('New Bin')
            if (binId) {
              void saveArrangements()
              markPendingRenameTarget({ kind: 'bin', id: binId })
            }
          }
        }
      ]
    }

    return [
      {
        id: 'rename-bin',
        label: 'Rename Bin',
        icon: <Pencil size={14} strokeWidth={1.7} />,
        onActivate: () => {
          markPendingRenameTarget({ kind: 'bin', id: binContextMenuState.binId })
        }
      },
      {
        id: 'delete-bin',
        label: 'Delete Bin',
        icon: <Trash2 size={14} strokeWidth={1.7} />,
        intent: 'destructive',
        onActivate: () => {
          deleteBin(binContextMenuState.binId)
          void saveArrangements()
        }
      }
    ]
  }, [binContextMenuState, createBin, deleteBin, markPendingRenameTarget, saveArrangements])

  const handleBinRenameCommit = useCallback(
    (binId: string, name: string) => {
      void renameBin(binId, name)
    },
    [renameBin]
  )

  const handleBinRenameCancel = useCallback(() => {
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
  const trashTargetId = useMemo(
    () => createArrangementsDropTargetId('trash', 'materials-window-trash'),
    []
  )
  const looseTargetId = useMemo(
    () => createArrangementsDropTargetId('loose', 'materials-window-bins'),
    []
  )
  const isTrashDropActive = useArrangementsDragTargetActive(trashTargetId)
  const isLooseDropActive = useArrangementsDragTargetActive(looseTargetId)

  useArrangementsDropTarget({
    id: windowOccluderTargetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: windowRef.current,
    priority: 1,
    meta: {
      type: 'occluder'
    }
  })

  useArrangementsDropTarget({
    id: looseTargetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: binsRowRef.current,
    priority: 2,
    meta: {
      type: 'loose'
    }
  })

  useArrangementsDropTarget({
    id: trashTargetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: trashRowRef.current,
    priority: 2,
    meta: {
      type: 'trash'
    }
  })

  const handleResolveDrop = useCallback(
    (resolution: ArrangementsDropResolution, payload: ArrangementsMaterialDragPayload) => {
      const meta = resolution.target?.meta
      if (meta?.type === 'occluder') return true
      if (!meta || meta.type !== 'canvas') return false
      if (payload.source.kind === 'trash') {
        window.alert("Can't use materials in Trash. Remove them from Trash first.")
        return true
      }
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

  const handleEmptyTrash = useCallback(async () => {
    if (trashMaterials.length === 0) return
    await deleteMaterialsFromTrashWithReferenceGuard(trashMaterials.map((material) => material.key))
  }, [trashMaterials])

  const toolbar =
    sel.kind === 'trash' ? (
      <PetalToolbar>
        <PetalToolbarGroup>
          <PetalToolbarButton
            label="Empty Trash"
            disabled={trashMaterials.length === 0}
            onClick={() => void handleEmptyTrash()}
          >
            <Trash2 size={13} strokeWidth={1.8} />
          </PetalToolbarButton>
        </PetalToolbarGroup>
      </PetalToolbar>
    ) : undefined

  const sidebar = (
    <div className="materials-window__sidebar">
      {/* Bins */}
      <div className="materials-window__sidebar-section">
        <span className="materials-window__sidebar-heading">Bins</span>
        <button
          ref={binsRowRef}
          type="button"
          className={[
            'materials-window__nav-row',
            isLooseDropActive ? 'materials-window__nav-row--drag-over' : '',
            sel.kind === 'bins' ? 'materials-window__nav-row--selected' : ''
          ].join(' ')}
          onClick={() => setSel(SEL_BINS)}
        >
          <span
            className={[
              'materials-window__bins-chevron',
              binsExpanded ? 'materials-window__bins-chevron--open' : ''
            ].join(' ')}
            onClick={(e) => {
              e.stopPropagation()
              setBinsExpanded((p) => !p)
            }}
            aria-hidden="true"
          >
            ›
          </span>
          <span className="materials-window__nav-label">Bins</span>
        </button>
        {binsExpanded &&
          userBins.map((bin) => (
            <SidebarBinRow
              key={bin.id}
              bin={bin}
              isSelected={sel.kind === 'bin' && sel.id === bin.id}
              onSelect={() => setSel({ kind: 'bin', id: bin.id })}
            />
          ))}
        <button
          ref={trashRowRef}
          type="button"
          className={[
            'materials-window__nav-row',
            isTrashDropActive ? 'materials-window__nav-row--drag-over' : '',
            sel.kind === 'trash' ? 'materials-window__nav-row--selected' : ''
          ].join(' ')}
          onClick={() => setSel(SEL_TRASH)}
        >
          <Trash2
            size={12}
            strokeWidth={1.6}
            className="materials-window__nav-icon"
            aria-hidden="true"
          />
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
          <Link
            size={12}
            strokeWidth={1.6}
            className="materials-window__nav-icon materials-window__nav-icon--smart"
            aria-hidden="true"
          />
          <span className="materials-window__nav-label">Stale</span>
          {staleMaterials.length > 0 && (
            <span className="materials-window__nav-count">{staleMaterials.length}</span>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <MicaWindow
      title="Materials"
      onClose={onClose}
      sidebar={sidebar}
      toolbar={toolbar}
      className="materials-window"
      windowRef={windowRef}
      aria-label="Materials"
    >
      <div
        className="materials-window__content"
        onContextMenu={sel.kind === 'bins' ? handleOpenBinsViewContextMenu : undefined}
      >
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
                pendingRenameTarget={pendingRenameTarget}
                onActivateMaterial={handleActivateMaterial}
                onOpenContextMenu={handleOpenBinContextMenu}
                onRenameCommit={handleBinRenameCommit}
                onRenameCancel={handleBinRenameCancel}
                onResolveDrop={handleResolveDrop}
              />
            ))}
            {looseMaterials.length === 0 && userBins.length === 0 && (
              <p className="materials-window__empty">Right-click to create a bin.</p>
            )}
          </div>
        ) : sel.kind === 'bin' ? (
          <div className="materials-window__set-view">
            {(binMaterialsMap.get(sel.id)?.length ?? 0) === 0 ? (
              <p className="materials-window__empty">Empty.</p>
            ) : (
              (binMaterialsMap.get(sel.id) ?? []).map((m) => (
                <MaterialRow
                  key={m.key}
                  material={m}
                  workspaceRoot={workspaceRoot}
                  dragSource={{ kind: 'bin', binId: sel.id }}
                  onActivate={handleActivateMaterial}
                  onResolveDrop={handleResolveDrop}
                />
              ))
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
            {false && (
              <p className="materials-window__empty">
                Stale detection requires cross-board analysis — coming soon.
              </p>
            )}
            {isReferenceScanPending ? (
              <p className="materials-window__empty">Checking board references.</p>
            ) : filteredMaterials.length === 0 ? (
              <p className="materials-window__empty">No stale materials.</p>
            ) : (
              filteredMaterials.map((m) => (
                <MaterialRow
                  key={m.key}
                  material={m}
                  workspaceRoot={workspaceRoot}
                  dragSource={{ kind: 'desktop' }}
                  onActivate={handleActivateMaterial}
                  onResolveDrop={handleResolveDrop}
                />
              ))
            )}
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
      {binContextMenuState ? (
        <PetalMenu
          items={binContextMenuItems}
          anchor={binContextMenuState.anchor}
          onClose={handleCloseBinContextMenu}
        />
      ) : null}
    </MicaWindow>
  )
}
