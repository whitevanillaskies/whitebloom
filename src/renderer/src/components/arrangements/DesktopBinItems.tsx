import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, Archive } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import type { GardenBin } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import './DesktopBinItems.css'

const BIN_PLACEMENT_PREFIX = 'bin:'

// Default positions for auto-layout (changed only when no stored placement)
const USER_BIN_ORIGIN_X = 280
const USER_BIN_ORIGIN_Y = 40
const USER_BIN_STEP_X = 110

function autoBinPosition(index: number): { x: number; y: number } {
  return { x: USER_BIN_ORIGIN_X + index * USER_BIN_STEP_X, y: USER_BIN_ORIGIN_Y }
}

// ── Draggable bin item ─────────────────────────────────────────────────────────

type BinItemProps = {
  bin: GardenBin
  x: number
  y: number
  onDoubleClick: (bin: GardenBin) => void
  onMoved: (binId: string, x: number, y: number) => void
  onDropMaterial: (materialKey: string, binId: string) => void
}

function BinItem({
  bin,
  x,
  y,
  onDoubleClick,
  onMoved,
  onDropMaterial
}: BinItemProps): React.JSX.Element {
  const isTrash = bin.id === SYSTEM_TRASH_BIN_ID

  // ── Drag-to-move (user bins only) ─────────────────────────
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [livePos, setLivePos] = useState<{ x: number; y: number }>({ x, y })

  // Sync from store when not dragging
  useEffect(() => {
    if (!dragging) setLivePos({ x, y })
  }, [x, y, dragging])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || isTrash) return
      e.stopPropagation() // don't trigger canvas pan
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: livePos.x, oy: livePos.y }
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [isTrash, livePos.x, livePos.y]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      setLivePos({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
    },
    []
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStart.current) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      const finalX = dragStart.current.ox + dx
      const finalY = dragStart.current.oy + dy
      dragStart.current = null
      setDragging(false)
      e.currentTarget.releasePointerCapture(e.pointerId)
      onMoved(bin.id, finalX, finalY)
    },
    [bin.id, onMoved]
  )

  // ── Drop target for materials ──────────────────────────────
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

  // ── Double-click opens Bin View ─────────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDoubleClick(bin)
    },
    [bin, onDoubleClick]
  )

  const pos = dragging ? livePos : { x, y }

  return (
    <div
      className={[
        'desktop-bin',
        isTrash ? 'desktop-bin--trash' : 'desktop-bin--user',
        isDragOver ? 'desktop-bin--drag-over' : '',
        dragging ? 'desktop-bin--dragging' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        isTrash
          ? undefined // Trash is CSS-anchored, not world-positioned
          : { transform: `translate(${pos.x}px, ${pos.y}px)` }
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      aria-label={`${bin.name} bin`}
    >
      <div className="desktop-bin__icon-wrap">
        {isTrash ? (
          <Trash2
            size={30}
            strokeWidth={1.4}
            className={['desktop-bin__icon', isDragOver ? 'desktop-bin__icon--hot' : ''].filter(Boolean).join(' ')}
          />
        ) : (
          <Archive
            size={30}
            strokeWidth={1.4}
            className={['desktop-bin__icon', isDragOver ? 'desktop-bin__icon--hot' : ''].filter(Boolean).join(' ')}
          />
        )}
      </div>
      <span className="desktop-bin__label">{bin.name}</span>
    </div>
  )
}

// ── Layer ──────────────────────────────────────────────────────────────────────

export default function DesktopBinItems(): React.JSX.Element {
  const bins = useArrangementsStore((s) => s.bins)
  const desktopPlacements = useArrangementsStore((s) => s.desktopPlacements)
  const moveBinOnDesktop = useArrangementsStore((s) => s.moveBinOnDesktop)
  const openBinView = useArrangementsStore((s) => s.openBinView)
  const sendToTrash = useArrangementsStore((s) => s.sendToTrash)
  const assignToBin = useArrangementsStore((s) => s.assignToBin)

  const handleMoved = useCallback(
    (binId: string, x: number, y: number) => {
      moveBinOnDesktop(binId, { x, y })
    },
    [moveBinOnDesktop]
  )

  const handleOpenBin = useCallback(
    (bin: GardenBin) => {
      openBinView(bin.id)
    },
    [openBinView]
  )

  const handleDropMaterial = useCallback(
    (materialKey: string, binId: string) => {
      if (binId === SYSTEM_TRASH_BIN_ID) {
        sendToTrash(materialKey)
      } else {
        assignToBin(materialKey, binId)
      }
    },
    [sendToTrash, assignToBin]
  )

  const userBins = bins.filter((b) => b.kind === 'user')

  return (
    <>
      {userBins.map((bin, index) => {
        const stored = desktopPlacements[`${BIN_PLACEMENT_PREFIX}${bin.id}`]
        const pos = stored ?? autoBinPosition(index)
        return (
          <BinItem
            key={bin.id}
            bin={bin}
            x={pos.x}
            y={pos.y}
            onDoubleClick={handleOpenBin}
            onMoved={handleMoved}
            onDropMaterial={handleDropMaterial}
          />
        )
      })}
    </>
  )
}

// ── Trash bin — rendered in the desktop overlay, not in __world ———————-

export function DesktopTrashBin(): React.JSX.Element | null {
  const bins = useArrangementsStore((s) => s.bins)
  const openBinView = useArrangementsStore((s) => s.openBinView)
  const sendToTrash = useArrangementsStore((s) => s.sendToTrash)

  const trashBin = bins.find((b) => b.id === SYSTEM_TRASH_BIN_ID)
  if (!trashBin) return null

  return (
    <BinItem
      bin={trashBin}
      x={0}
      y={0}
      onDoubleClick={(bin) => openBinView(bin.id)}
      onMoved={() => void 0}
      onDropMaterial={(key) => sendToTrash(key)}
    />
  )
}
