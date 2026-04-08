import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Trash2, Archive } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import type { GardenBin } from '../../../../shared/arrangements'
import { SYSTEM_TRASH_BIN_ID } from '../../../../shared/arrangements'
import { PetalMenu, type PetalMenuItem } from '../petal'
import {
  ARRANGEMENTS_MICA_HOST_ID,
  createArrangementsDropTargetId,
  useArrangementsDragTargetActive,
  useArrangementsDropTarget,
  useArrangementsSpringLoadHover
} from './arrangementsDrag'
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
  isPendingRename: boolean
  onDoubleClick: (bin: GardenBin) => void
  onRenameRequest: (binId: string) => void
  onRenameCommit: (binId: string, name: string) => void
  onRenameCancel: () => void
  onDelete: (binId: string) => void
  onMoved: (binId: string, x: number, y: number) => void
}

function BinItem({
  bin,
  x,
  y,
  isPendingRename,
  onDoubleClick,
  onRenameRequest,
  onRenameCommit,
  onRenameCancel,
  onDelete,
  onMoved
}: BinItemProps): React.JSX.Element {
  const isTrash = bin.id === SYSTEM_TRASH_BIN_ID
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const targetId = createArrangementsDropTargetId(isTrash ? 'trash' : 'bin', bin.id)
  const isDropActive = useArrangementsDragTargetActive(targetId)
  const isSpringLoadReady = useArrangementsSpringLoadHover(targetId)
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const [draftName, setDraftName] = useState(bin.name)
  const dropTargetMeta = useMemo(
    () =>
      isTrash
        ? ({ type: 'trash' } as const)
        : ({
            type: 'bin',
            binId: bin.id
          } as const),
    [bin.id, isTrash]
  )

  // ── Drag-to-move (user bins only) ─────────────────────────
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [livePos, setLivePos] = useState<{ x: number; y: number }>({ x, y })

  // Sync from store when not dragging
  useEffect(() => {
    if (!dragging) setLivePos({ x, y })
  }, [x, y, dragging])

  useEffect(() => {
    setDraftName(bin.name)
  }, [bin.name])

  useEffect(() => {
    if (!isPendingRename) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isPendingRename])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPendingRename) return
      if (e.button !== 0 || isTrash) return
      e.stopPropagation() // don't trigger canvas pan
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: livePos.x, oy: livePos.y }
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [isPendingRename, isTrash, livePos.x, livePos.y]
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
  useArrangementsDropTarget({
    id: targetId,
    hostId: ARRANGEMENTS_MICA_HOST_ID,
    element: rootRef.current,
    meta: dropTargetMeta
  })

  // ── Double-click opens Bin View ─────────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isPendingRename) return
      onDoubleClick(bin)
    },
    [bin, isPendingRename, onDoubleClick]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTrash) return
      e.preventDefault()
      e.stopPropagation()
      setContextMenuAnchor({ x: e.clientX, y: e.clientY })
    },
    [isTrash]
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuAnchor(null)
  }, [])

  const commitRename = useCallback(() => {
    const normalizedName = draftName.trim()
    if (!normalizedName) {
      setDraftName(bin.name)
      onRenameCancel()
      return
    }
    onRenameCommit(bin.id, normalizedName)
  }, [bin.id, bin.name, draftName, onRenameCancel, onRenameCommit])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitRename()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraftName(bin.name)
        onRenameCancel()
      }
    },
    [bin.name, commitRename, onRenameCancel]
  )

  const contextMenuItems = useMemo<PetalMenuItem[]>(
    () => [
      {
        id: 'rename-bin',
        label: 'Rename Bin',
        icon: <Pencil size={14} strokeWidth={1.7} />,
        onActivate: () => {
          onRenameRequest(bin.id)
        }
      },
      {
        id: 'remove-bin',
        label: 'Remove Bin',
        icon: <Trash2 size={14} strokeWidth={1.7} />,
        intent: 'destructive',
        onActivate: () => {
          onDelete(bin.id)
        }
      }
    ],
    [bin.id, onDelete, onRenameRequest]
  )

  const pos = dragging ? livePos : { x, y }

  return (
    <div
      ref={rootRef}
      className={[
        'desktop-bin',
        isTrash ? 'desktop-bin--trash' : 'desktop-bin--user',
        isDropActive ? 'desktop-bin--drag-over' : '',
        isSpringLoadReady ? 'desktop-bin--intent-ready' : '',
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
      onContextMenu={handleContextMenu}
      role="button"
      aria-label={`${bin.name} bin`}
    >
      <div className="desktop-bin__icon-wrap">
        {isTrash ? (
          <Trash2
            size={30}
            strokeWidth={1.4}
            className={['desktop-bin__icon', isDropActive ? 'desktop-bin__icon--hot' : ''].filter(Boolean).join(' ')}
          />
        ) : (
          <Archive
            size={30}
            strokeWidth={1.4}
            className={['desktop-bin__icon', isDropActive ? 'desktop-bin__icon--hot' : ''].filter(Boolean).join(' ')}
          />
        )}
      </div>
      {isPendingRename ? (
        <input
          ref={inputRef}
          className="desktop-bin__label-input"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Rename bin"
        />
      ) : (
        <span className="desktop-bin__label">{bin.name}</span>
      )}
      {contextMenuAnchor ? (
        <PetalMenu
          items={contextMenuItems}
          anchor={contextMenuAnchor}
          onClose={handleCloseContextMenu}
        />
      ) : null}
    </div>
  )
}

// ── Layer ──────────────────────────────────────────────────────────────────────

type DesktopBinItemsProps = {
  onOpenBin: (binId: string) => void
  onDeleteBin: (binId: string) => void
}

export default function DesktopBinItems({
  onOpenBin,
  onDeleteBin
}: DesktopBinItemsProps): React.JSX.Element {
  const bins = useArrangementsStore((s) => s.bins)
  const desktopPlacements = useArrangementsStore((s) => s.desktopPlacements)
  const moveBinOnDesktop = useArrangementsStore((s) => s.moveBinOnDesktop)
  const pendingRenameTarget = useArrangementsStore((s) => s.pendingRenameTarget)
  const markPendingRenameTarget = useArrangementsStore((s) => s.markPendingRenameTarget)
  const renameBin = useArrangementsStore((s) => s.renameBin)

  const handleMoved = useCallback(
    (binId: string, x: number, y: number) => {
      moveBinOnDesktop(binId, { x, y })
    },
    [moveBinOnDesktop]
  )

  const handleOpenBin = useCallback(
    (bin: GardenBin) => {
      onOpenBin(bin.id)
    },
    [onOpenBin]
  )

  const handleRenameRequest = useCallback(
    (binId: string) => {
      markPendingRenameTarget({ kind: 'bin', id: binId })
    },
    [markPendingRenameTarget]
  )

  const handleRenameCommit = useCallback(
    (binId: string, name: string) => {
      void renameBin(binId, name)
    },
    [renameBin]
  )

  const handleRenameCancel = useCallback(() => {
    markPendingRenameTarget(null)
  }, [markPendingRenameTarget])

  const handleDeleteBin = useCallback(
    (binId: string) => {
      onDeleteBin(binId)
    },
    [onDeleteBin]
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
            isPendingRename={pendingRenameTarget?.kind === 'bin' && pendingRenameTarget.id === bin.id}
            onDoubleClick={handleOpenBin}
            onRenameRequest={handleRenameRequest}
            onRenameCommit={handleRenameCommit}
            onRenameCancel={handleRenameCancel}
            onDelete={handleDeleteBin}
            onMoved={handleMoved}
          />
        )
      })}
    </>
  )
}

// ── Trash bin — rendered in the desktop overlay, not in __world ———————-

type DesktopTrashBinProps = {
  onOpenBin: (binId: string) => void
}

export function DesktopTrashBin({ onOpenBin }: DesktopTrashBinProps): React.JSX.Element | null {
  const bins = useArrangementsStore((s) => s.bins)

  const trashBin = bins.find((b) => b.id === SYSTEM_TRASH_BIN_ID)
  if (!trashBin) return null

  return (
    <BinItem
      bin={trashBin}
      x={0}
      y={0}
      isPendingRename={false}
      onDoubleClick={(bin) => onOpenBin(bin.id)}
      onRenameRequest={() => void 0}
      onRenameCommit={() => void 0}
      onRenameCancel={() => void 0}
      onDelete={() => void 0}
      onMoved={() => void 0}
    />
  )
}
