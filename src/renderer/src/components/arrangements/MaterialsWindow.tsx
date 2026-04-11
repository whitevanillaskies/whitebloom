import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, LayoutDashboard, Layers, Link, Link2 } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import { MicaWindow } from '../../mica'
import type { ArrangementsMaterial, GardenSetNode } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import { resolveWorkspaceBoardPath } from '../../shared/board-resource'
import './MaterialsWindow.css'

// ── Sidebar selection ──────────────────────────────────────────────────────────

type SidebarSel =
  | { kind: 'bins' }
  | { kind: 'set'; id: string }
  | { kind: 'smart-set'; id: 'stale' }

const SEL_BINS: SidebarSel = { kind: 'bins' }
const SEL_STALE: SidebarSel = { kind: 'smart-set', id: 'stale' }

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
  onActivate: (material: ArrangementsMaterial) => void
}

function MaterialRow({ material, workspaceRoot, onActivate }: MaterialRowProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onActivate(material)
    },
    [material, onActivate]
  )

  return (
    <div
      className="materials-window__material-row"
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
  onActivateMaterial: (material: ArrangementsMaterial) => void
}

function BinSection({
  title,
  materials,
  workspaceRoot,
  defaultExpanded = true,
  onActivateMaterial
}: BinSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="materials-window__bin-section">
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
              onActivate={onActivateMaterial}
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
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

function SetTreeNode({
  node,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect
}: SetTreeNodeProps): React.JSX.Element {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0

  const handleDoubleClick = useCallback(
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

  return (
    <li className="materials-window__set-item">
      <div
        className={[
          'materials-window__set-row',
          isSelected ? 'materials-window__set-row--selected' : ''
        ].join(' ')}
        style={{ paddingLeft: 10 + depth * 12 }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
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
          aria-hidden="true"
        >
          ›
        </span>
        <Layers size={11} strokeWidth={1.6} className="materials-window__set-icon" aria-hidden="true" />
        <span className="materials-window__set-label">{node.name}</span>
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
              onToggle={onToggle}
              onSelect={onSelect}
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
}

export default function MaterialsWindow({
  onClose,
  onOpenBoard
}: MaterialsWindowProps): React.JSX.Element {
  const materials = useArrangementsStore((s) => s.materials)
  const bins = useArrangementsStore((s) => s.bins)
  const sets = useArrangementsStore((s) => s.sets)
  const memberships = useArrangementsStore((s) => s.memberships)
  const binAssignments = useArrangementsStore((s) => s.binAssignments)
  const workspaceRoot = useWorkspaceStore((s) => s.root)

  const [sel, setSel] = useState<SidebarSel>(SEL_BINS)
  const [setExpandedIds, setSetExpandedIds] = useState<Set<string>>(new Set())

  const userBins = useMemo(
    () => bins.filter((b) => b.kind === 'user'),
    [bins]
  )

  // Non-trash materials (trash bin excluded from the list view)
  const visibleMaterials = useMemo(
    () => materials.filter((m) => binAssignments[m.key] !== SYSTEM_TRASH_BIN_ID),
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
      </div>

      {/* Sets tree */}
      <div className="materials-window__sidebar-section materials-window__sidebar-section--sets">
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
                onToggle={handleToggleSet}
                onSelect={handleSelectSet}
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
              />
            )}
            {userBins.map((bin) => (
              <BinSection
                key={bin.id}
                title={bin.name}
                materials={binMaterialsMap.get(bin.id) ?? []}
                workspaceRoot={workspaceRoot}
                onActivateMaterial={handleActivateMaterial}
              />
            ))}
            {looseMaterials.length === 0 && userBins.length === 0 && (
              <p className="materials-window__empty">No materials in this workspace.</p>
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
                  onActivate={handleActivateMaterial}
                />
              ))
            )}
          </div>
        )}
      </div>
    </MicaWindow>
  )
}
