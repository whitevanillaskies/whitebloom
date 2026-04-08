import { useCallback, useEffect, useMemo } from 'react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import type { ArrangementsMaterial } from '../../../../shared/arrangements'
import { useLocalArrangementsMaterialSelection } from './arrangementsSelection'
import MaterialItem from './MaterialItem'

// Auto-layout grid for materials without an explicit placement
const GRID_ITEM_W = 100
const GRID_ITEM_H = 108
const GRID_COLS = 8
const GRID_ORIGIN_X = 40
const GRID_ORIGIN_Y = 40

function autoPosition(index: number): { x: number; y: number } {
  const col = index % GRID_COLS
  const row = Math.floor(index / GRID_COLS)
  return {
    x: GRID_ORIGIN_X + col * GRID_ITEM_W,
    y: GRID_ORIGIN_Y + row * GRID_ITEM_H
  }
}

type DesktopMaterialItemsProps = {
  onOpenBoard: (boardPath: string) => void
}

export default function DesktopMaterialItems({
  onOpenBoard
}: DesktopMaterialItemsProps): React.JSX.Element {
  const materials = useArrangementsStore((s) => s.materials)
  const desktopPlacements = useArrangementsStore((s) => s.desktopPlacements)
  const binAssignments = useArrangementsStore((s) => s.binAssignments)
  const sendToTrash = useArrangementsStore((s) => s.sendToTrash)
  const workspaceRoot = useWorkspaceStore((s) => s.root)

  // Only show materials NOT in trash and with no bin assignment or dropped on desktop
  const visibleMaterials = useMemo(
    () => materials.filter((m) => !binAssignments[m.key]),
    [binAssignments, materials]
  )
  const visibleMaterialKeys = useMemo(
    () => visibleMaterials.map((material) => material.key),
    [visibleMaterials]
  )

  const { clear, isSelected, retain, select, selectedKeys } = useLocalArrangementsMaterialSelection()

  // Clear or trim selection when the visible desktop set changes.
  useEffect(() => {
    retain(visibleMaterialKeys)
  }, [retain, visibleMaterialKeys])

  const handleDoubleClick = useCallback(
    (material: ArrangementsMaterial) => {
      if (material.kind === 'board') {
        // Strip wloc: prefix to get the relative path, then resolve
        // The board path stored is the absolute path on disk
        // material.key for boards is wloc:filename.wb.json (relative to workspace root)
        const relPath = material.key.replace(/^wloc:/, '')
        if (!workspaceRoot) return
        // Construct absolute path
        const sep = workspaceRoot.endsWith('/') || workspaceRoot.endsWith('\\') ? '' : '/'
        onOpenBoard(workspaceRoot + sep + relPath)
        return
      }
      // Non-board materials: bloom is deferred — no-op for now
    },
    [onOpenBoard, workspaceRoot]
  )

  // Keyboard Delete — send selected items to trash
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (selectedKeys.length === 0) return
      // Only act when focus is on the desktop, not in an input
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      e.preventDefault()
      for (const key of selectedKeys) {
        sendToTrash(key)
      }
      clear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clear, selectedKeys, sendToTrash])

  // Click-off to deselect
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('.mica-window')) {
        return
      }
      if (!target?.closest('.material-item')) {
        clear()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [clear])

  if (!workspaceRoot) return <></>

  return (
    <>
      {visibleMaterials.map((material, index) => {
        const stored = desktopPlacements[material.key]
        const pos = stored ?? autoPosition(index)
        return (
          <MaterialItem
            key={material.key}
            material={material}
            workspaceRoot={workspaceRoot}
            x={pos.x}
            y={pos.y}
            selected={isSelected(material.key)}
            selectedKeys={selectedKeys}
            onSelect={select}
            onDoubleClick={handleDoubleClick}
          />
        )
      })}
    </>
  )
}
