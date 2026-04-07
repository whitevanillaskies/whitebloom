import { useCallback, useState } from 'react'
import { Layers, Link } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import type { GardenSetNode } from '../../../../shared/arrangements'
import { PetalIsland } from '../petal'
import './SetsIsland.css'

// ── Smart set IDs ─────────────────────────────────────────────────────────────
export const SMART_SET_LINKED = '__smart_linked__'

// ── SetTreeNode (recursive) ───────────────────────────────────────────────────

type SetTreeNodeProps = {
  node: GardenSetNode
  depth: number
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onDrop: (materialKey: string, setId: string) => void
}

function SetTreeNode({
  node,
  depth,
  expandedIds,
  onToggleExpand,
  onDrop
}: SetTreeNodeProps): React.JSX.Element {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!hasChildren) return
      onToggleExpand(node.id)
    },
    [hasChildren, node.id, onToggleExpand]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const materialKey = e.dataTransfer.getData('application/x-wb-material-key')
      if (materialKey) onDrop(materialKey, node.id)
    },
    [node.id, onDrop]
  )

  return (
    <li className="sets-island__tree-item">
      <div
        className={[
          'sets-island__row',
          isDragOver ? 'sets-island__row--drag-over' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 10 + depth * 14 }}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
        <span className="sets-island__label">{node.name}</span>
      </div>

      {isExpanded && hasChildren && (
        <ul className="sets-island__subtree" role="group">
          {node.children.map((child) => (
            <SetTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onDrop={onDrop}
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
  const addToSet = useArrangementsStore((s) => s.addToSet)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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

  const handleDrop = useCallback(
    (materialKey: string, setId: string) => {
      addToSet(materialKey, setId)
    },
    [addToSet]
  )

  return (
    <PetalIsland title="Sets" className="sets-island" aria-label="Sets">
      <div className="sets-island__scroll">
        {/* User sets tree */}
        {sets.length > 0 ? (
          <ul className="sets-island__tree" role="tree" aria-label="User sets">
            {sets.map((node) => (
              <SetTreeNode
                key={node.id}
                node={node}
                depth={0}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onDrop={handleDrop}
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
    </PetalIsland>
  )
}
