import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderTree, Layers, Link, Pencil, Trash2 } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import type { GardenSetNode } from '../../../../shared/arrangements'
import { PetalIsland, PetalMenu, type PetalMenuItem } from '../petal'
import {
  ARRANGEMENTS_MICA_HOST_ID,
  createArrangementsDropTargetId,
  useArrangementsDragTargetActive,
  useArrangementsDropTarget,
  useArrangementsSpringLoadHover
} from './arrangementsDrag'
import './SetsIsland.css'

// ── Smart set IDs ─────────────────────────────────────────────────────────────
export const SMART_SET_LINKED = '__smart_linked__'

// ── SetTreeNode (recursive) ───────────────────────────────────────────────────

type SetTreeNodeProps = {
  node: GardenSetNode
  depth: number
  expandedIds: Set<string>
  pendingRenameTarget: { kind: 'bin' | 'set'; id: string } | null
  onToggleExpand: (id: string) => void
  onOpenContextMenu: (setId: string, anchor: { x: number; y: number }) => void
  onRenameCommit: (setId: string, name: string) => void
  onRenameCancel: () => void
}

function SetTreeNode({
  node,
  depth,
  expandedIds,
  pendingRenameTarget,
  onToggleExpand,
  onOpenContextMenu,
  onRenameCommit,
  onRenameCancel
}: SetTreeNodeProps): React.JSX.Element {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const targetId = createArrangementsDropTargetId('set', node.id)
  const isDropActive = useArrangementsDragTargetActive(targetId)
  const isSpringLoadReady = useArrangementsSpringLoadHover(targetId)
  const isPendingRename = pendingRenameTarget?.kind === 'set' && pendingRenameTarget.id === node.id
  const [draftName, setDraftName] = useState(node.name)
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
    meta: dropTargetMeta
  })

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isPendingRename) return
      if (!hasChildren) return
      onToggleExpand(node.id)
    },
    [hasChildren, isPendingRename, node.id, onToggleExpand]
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
    <li className="sets-island__tree-item">
      <div
        ref={rowRef}
        className={[
          'sets-island__row',
          isDropActive ? 'sets-island__row--drag-over' : '',
          isSpringLoadReady ? 'sets-island__row--intent-ready' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 10 + depth * 14 }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        <span
          className={[
            'sets-island__chevron',
            hasChildren ? 'sets-island__chevron--visible' : '',
            isExpanded ? 'sets-island__chevron--open' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          ›
        </span>
        <Layers size={12} strokeWidth={1.6} className="sets-island__icon" />
        {isPendingRename ? (
          <input
            ref={inputRef}
            className="sets-island__label-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Rename set"
          />
        ) : (
          <span className="sets-island__label">{node.name}</span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <ul className="sets-island__subtree" role="group">
          {node.children.map((child) => (
            <SetTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              pendingRenameTarget={pendingRenameTarget}
              onToggleExpand={onToggleExpand}
              onOpenContextMenu={onOpenContextMenu}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── SetsIsland ────────────────────────────────────────────────────────────────

type LinkedMaterials = {
  count: number
}

function useLinkedMaterials(): LinkedMaterials {
  const materials = useArrangementsStore((s) => s.materials)
  const count = materials.filter((m) => m.kind === 'linked').length
  return { count }
}

export default function SetsIsland(): React.JSX.Element {
  const sets = useArrangementsStore((s) => s.sets)
  const createRootSet = useArrangementsStore((s) => s.createRootSet)
  const createChildSet = useArrangementsStore((s) => s.createChildSet)
  const renameSet = useArrangementsStore((s) => s.renameSet)
  const deleteSet = useArrangementsStore((s) => s.deleteSet)
  const saveArrangements = useArrangementsStore((s) => s.saveArrangements)
  const pendingRenameTarget = useArrangementsStore((s) => s.pendingRenameTarget)
  const markPendingRenameTarget = useArrangementsStore((s) => s.markPendingRenameTarget)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenuState, setContextMenuState] = useState<
    | { kind: 'root'; anchor: { x: number; y: number } }
    | { kind: 'child'; setId: string; anchor: { x: number; y: number } }
    | null
  >(null)

  const { count: linkedCount } = useLinkedMaterials()

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleOpenRootContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rowTarget = (e.target as HTMLElement | null)?.closest('.sets-island__row')
    if (rowTarget) return

    e.preventDefault()
    setContextMenuState({
      kind: 'root',
      anchor: {
        x: e.clientX,
        y: e.clientY
      }
    })
  }, [])

  const handleOpenChildContextMenu = useCallback(
    (setId: string, anchor: { x: number; y: number }) => {
      if (anchor.x < 0 || anchor.y < 0) {
        void createChildSet(setId)
        return
      }
      setContextMenuState({
        kind: 'child',
        setId,
        anchor
      })
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
  }, [contextMenuState, createChildSet, createRootSet, deleteSet, markPendingRenameTarget, saveArrangements])

  const handleRenameCommit = useCallback(
    (setId: string, name: string) => {
      void renameSet(setId, name)
    },
    [renameSet]
  )

  const handleRenameCancel = useCallback(() => {
    markPendingRenameTarget(null)
  }, [markPendingRenameTarget])

  return (
    <PetalIsland title="Sets" className="sets-island" aria-label="Sets">
      <div className="sets-island__scroll" onContextMenu={handleOpenRootContextMenu}>
        {/* User sets tree */}
        {sets.length > 0 ? (
          <ul className="sets-island__tree" role="tree" aria-label="User sets">
            {sets.map((node) => (
              <SetTreeNode
                key={node.id}
                node={node}
                depth={0}
                expandedIds={expandedIds}
                pendingRenameTarget={pendingRenameTarget}
                onToggleExpand={handleToggleExpand}
                onOpenContextMenu={handleOpenChildContextMenu}
                onRenameCommit={handleRenameCommit}
                onRenameCancel={handleRenameCancel}
              />
            ))}
          </ul>
        ) : (
          <p className="sets-island__empty">No sets yet</p>
        )}

        {/* Smart sets section */}
        <div className="sets-island__smart-section">
          <span className="sets-island__smart-heading">Smart Sets</span>
          <ul className="sets-island__tree" role="list">
            <li className="sets-island__tree-item">
              <div
                className="sets-island__row sets-island__row--smart"
                role="listitem"
                aria-label={`Linked — ${linkedCount} item${linkedCount === 1 ? '' : 's'}`}
              >
                <span className="sets-island__chevron" aria-hidden="true" />
                <Link size={12} strokeWidth={1.6} className="sets-island__icon sets-island__icon--smart" />
                <span className="sets-island__label">Linked</span>
                {linkedCount > 0 && (
                  <span className="sets-island__badge">{linkedCount}</span>
                )}
              </div>
            </li>
          </ul>
        </div>
      </div>
      {contextMenuState ? (
        <PetalMenu
          items={contextMenuItems}
          anchor={contextMenuState.anchor}
          onClose={handleCloseContextMenu}
        />
      ) : null}
    </PetalIsland>
  )
}
