import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Position, Size } from '@renderer/shared/types'

export type ResizeCorner = 'nw' | 'ne' | 'se' | 'sw'

type ResizeChange = {
  position: Position
  size: Size
}

type ResizeSession = {
  corner: ResizeCorner
  startClientX: number
  startClientY: number
  startPosition: Position
  startSize: Size
  currentPosition: Position
  currentSize: Size
}

type UseFixedCornerResizeOptions = {
  position: Position
  size: Size
  minWidth: number
  minHeight: number
  keepAspectRatio?: boolean
  onPreviewChange: (change: ResizeChange) => void
  onCommitChange: (change: ResizeChange) => void
}

function getCornerDirection(corner: ResizeCorner): { x: -1 | 1; y: -1 | 1 } {
  switch (corner) {
    case 'nw':
      return { x: -1, y: -1 }
    case 'ne':
      return { x: 1, y: -1 }
    case 'se':
      return { x: 1, y: 1 }
    case 'sw':
      return { x: -1, y: 1 }
  }
}

function getAspectRatioSize(
  session: ResizeSession,
  dxFlow: number,
  dyFlow: number,
  minWidth: number,
  minHeight: number
): Size {
  const direction = getCornerDirection(session.corner)
  const startWidth = Math.max(1, session.startSize.w)
  const startHeight = Math.max(1, session.startSize.h)
  const widthScaleDelta = (dxFlow * direction.x) / startWidth
  const heightScaleDelta = (dyFlow * direction.y) / startHeight
  const widthWeight = Math.abs(widthScaleDelta)
  const heightWeight = Math.abs(heightScaleDelta)
  const totalWeight = widthWeight + heightWeight
  const blendedScaleDelta =
    totalWeight > 0
      ? (widthScaleDelta * widthWeight + heightScaleDelta * heightWeight) / totalWeight
      : 0
  const minScale = Math.max(minWidth / startWidth, minHeight / startHeight)
  const nextScale = Math.max(minScale, 1 + blendedScaleDelta)

  return {
    w: Math.max(minWidth, Math.round(startWidth * nextScale)),
    h: Math.max(minHeight, Math.round(startHeight * nextScale))
  }
}

function getFreeformSize(
  session: ResizeSession,
  dxFlow: number,
  dyFlow: number,
  minWidth: number,
  minHeight: number
): Size {
  const direction = getCornerDirection(session.corner)

  return {
    w: Math.max(minWidth, Math.round(session.startSize.w + dxFlow * direction.x)),
    h: Math.max(minHeight, Math.round(session.startSize.h + dyFlow * direction.y))
  }
}

function getPositionForSize(session: ResizeSession, nextSize: Size): Position {
  const direction = getCornerDirection(session.corner)

  return {
    x:
      direction.x < 0
        ? session.startPosition.x + session.startSize.w - nextSize.w
        : session.startPosition.x,
    y:
      direction.y < 0
        ? session.startPosition.y + session.startSize.h - nextSize.h
        : session.startPosition.y
  }
}

export function useFixedCornerResize({
  position,
  size,
  minWidth,
  minHeight,
  keepAspectRatio = false,
  onPreviewChange,
  onCommitChange
}: UseFixedCornerResizeOptions) {
  const { getViewport } = useReactFlow()
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [activeCorner, setActiveCorner] = useState<ResizeCorner | null>(null)

  const stopResize = useCallback(
    (persist: boolean) => {
      const session = resizeSessionRef.current
      if (!session) return

      resizeSessionRef.current = null
      setIsResizing(false)
      setActiveCorner(null)

      if (persist) {
        onCommitChange({ position: session.currentPosition, size: session.currentSize })
        return
      }

      onPreviewChange({ position: session.startPosition, size: session.startSize })
    },
    [onCommitChange, onPreviewChange]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = resizeSessionRef.current
      if (!session) return

      event.preventDefault()

      const zoom = getViewport().zoom || 1
      const dxFlow = (event.clientX - session.startClientX) / zoom
      const dyFlow = (event.clientY - session.startClientY) / zoom

      const nextSize = keepAspectRatio
        ? getAspectRatioSize(session, dxFlow, dyFlow, minWidth, minHeight)
        : getFreeformSize(session, dxFlow, dyFlow, minWidth, minHeight)
      const nextPosition = getPositionForSize(session, nextSize)

      session.currentSize = nextSize
      session.currentPosition = nextPosition
      onPreviewChange({ position: nextPosition, size: nextSize })
    },
    [getViewport, keepAspectRatio, minHeight, minWidth, onPreviewChange]
  )

  const onPointerUp = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove)
    stopResize(true)
  }, [onPointerMove, stopResize])

  const beginResize = useCallback(
    (corner: ResizeCorner, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture?.(event.pointerId)

      resizeSessionRef.current = {
        corner,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPosition: { ...position },
        startSize: { ...size },
        currentPosition: { ...position },
        currentSize: { ...size }
      }

      setIsResizing(true)
      setActiveCorner(corner)

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp, { once: true })
    },
    [onPointerMove, onPointerUp, position, size]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  useEffect(() => {
    if (!isResizing) return

    const handleWindowBlur = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      stopResize(false)
    }

    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isResizing, onPointerMove, onPointerUp, stopResize])

  return {
    activeCorner,
    beginResize,
    isResizing
  }
}
