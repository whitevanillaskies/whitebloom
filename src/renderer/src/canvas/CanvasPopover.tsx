import { createPortal } from 'react-dom'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

type CanvasPopoverProps = {
  anchorRef: RefObject<HTMLElement | null>
  className?: string
  align?: 'start' | 'center' | 'end'
  children: ReactNode
}

const VIEWPORT_PADDING = 10
const POPOVER_GAP = 12

export function CanvasPopover({
  anchorRef,
  className,
  align = 'center',
  children
}: CanvasPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const popover = popoverRef.current
    if (!anchor || !popover) return

    const anchorRect = anchor.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()

    let left =
      align === 'start'
        ? anchorRect.left
        : align === 'end'
          ? anchorRect.right - popoverRect.width
          : anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2

    const preferredTop = anchorRect.top - popoverRect.height - POPOVER_GAP
    const fallbackTop = anchorRect.bottom + POPOVER_GAP
    const fitsAbove = preferredTop >= VIEWPORT_PADDING
    const fitsBelow = fallbackTop + popoverRect.height <= window.innerHeight - VIEWPORT_PADDING

    const top = fitsAbove
      ? preferredTop
      : fitsBelow
        ? fallbackTop
        : Math.min(
            Math.max(preferredTop, VIEWPORT_PADDING),
            window.innerHeight - popoverRect.height - VIEWPORT_PADDING
          )

    left = Math.min(
      Math.max(left, VIEWPORT_PADDING),
      window.innerWidth - popoverRect.width - VIEWPORT_PADDING
    )

    setPosition({ left, top })
  }, [align, anchorRef])

  useLayoutEffect(() => {
    updatePosition()
  }, [children, updatePosition])

  useLayoutEffect(() => {
    const handleViewportChange = () => updatePosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [updatePosition])

  return createPortal(
    <div
      ref={popoverRef}
      className={`canvas-popover${className ? ` ${className}` : ''}`}
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
