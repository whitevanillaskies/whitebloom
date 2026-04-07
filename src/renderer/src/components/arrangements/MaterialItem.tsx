import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, Link } from 'lucide-react'
import type { ArrangementsMaterial } from '../../../../shared/arrangements'
import './MaterialItem.css'

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
      if (result.ok && result.dataUrl) {
        setState({ status: 'ready', dataUrl: result.dataUrl })
      } else {
        setState({ status: 'fallback' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [material.kind, material.key, workspaceRoot])

  return state
}

// ── Props ──────────────────────────────────────────────────────────────────────

type MaterialItemProps = {
  material: ArrangementsMaterial
  workspaceRoot: string
  x: number
  y: number
  selected: boolean
  onSelect: (key: string, additive: boolean) => void
  onDoubleClick: (material: ArrangementsMaterial) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MaterialItem({
  material,
  workspaceRoot,
  x,
  y,
  selected,
  onSelect,
  onDoubleClick
}: MaterialItemProps): React.JSX.Element {
  const iconState = useMaterialIcon(material, workspaceRoot)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't let the desktop's pan handler see left-button clicks on items
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
      className={['material-item', selected ? 'material-item--selected' : ''].filter(Boolean).join(' ')}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      draggable
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onDragStart={handleDragStart}
      role="option"
      aria-selected={selected}
      aria-label={material.displayName}
      tabIndex={-1}
    >
      <div className="material-item__icon-wrap">
        {material.kind === 'board' ? (
          <LayoutDashboard
            size={32}
            strokeWidth={1.4}
            className="material-item__board-icon"
          />
        ) : material.kind === 'linked' ? (
          <div className="material-item__icon-container">
            {iconState.status === 'ready' ? (
              <img src={iconState.dataUrl} alt="" className="material-item__icon-img" draggable={false} />
            ) : (
              <Link size={28} strokeWidth={1.4} className="material-item__fallback-icon" />
            )}
            <span className="material-item__link-badge" aria-label="Externally linked" title="Externally linked">
              ↗
            </span>
          </div>
        ) : iconState.status === 'ready' ? (
          <img src={iconState.dataUrl} alt="" className="material-item__icon-img" draggable={false} />
        ) : (
          <div className="material-item__icon-placeholder" aria-hidden="true" />
        )}
      </div>

      <span className="material-item__label">{material.displayName}</span>
    </div>
  )
}
