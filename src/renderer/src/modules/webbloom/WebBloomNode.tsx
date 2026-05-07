import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useInternalNode, useUpdateNodeInternals } from '@xyflow/react'
import { ExternalLink, Globe } from 'lucide-react'
import { useBoardStore } from '@renderer/stores/board'
import { NodeResizeHandles } from '../../canvas/NodeResizeHandles'
import { useFixedCornerResize } from '../../canvas/useFixedCornerResize'
import type { BudNodeProps } from '../types'
import { useWebBloomNativeViewsVisible } from './WebBloomVisibilityContext'
import './WebBloomNode.css'

const HEADER_HEIGHT = 32
const MIN_WIDTH = 320
const MIN_HEIGHT = 220
const MOTION_PAUSE_MS = 180
const MOTION_THRESHOLD_PX = 1.5
const WHITEBLOOM_CHROME_SELECTOR = [
  '.react-flow__panel',
  '.petal-palette',
  '.petal-menu',
  '.petal-panel',
  '.mica-window',
  '.canvas-recording-indicator'
].join(',')

function getUrlLabel(resource: string): string {
  try {
    const url = new URL(resource)
    return url.hostname
  } catch {
    return resource
  }
}

function rectIntersectsViewport(rect: DOMRect): boolean {
  return (
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  )
}

function getSamplePoints(rect: DOMRect): Array<{ x: number; y: number }> {
  const left = Math.max(0, Math.min(window.innerWidth - 1, rect.left))
  const right = Math.max(0, Math.min(window.innerWidth - 1, rect.right - 1))
  const top = Math.max(0, Math.min(window.innerHeight - 1, rect.top))
  const bottom = Math.max(0, Math.min(window.innerHeight - 1, rect.bottom - 1))
  const centerX = Math.round((left + right) / 2)
  const centerY = Math.round((top + bottom) / 2)

  return [
    { x: left, y: top },
    { x: centerX, y: top },
    { x: right, y: top },
    { x: left, y: centerY },
    { x: centerX, y: centerY },
    { x: right, y: centerY },
    { x: left, y: bottom },
    { x: centerX, y: bottom },
    { x: right, y: bottom }
  ]
}

function isRectOccludedByWhitebloomChrome(rect: DOMRect, nodeElement: HTMLElement): boolean {
  if (!rectIntersectsViewport(rect)) return false

  return getSamplePoints(rect).some((point) =>
    document.elementsFromPoint(point.x, point.y).some((element) => {
      if (!(element instanceof HTMLElement)) return false
      if (nodeElement.contains(element)) return false
      return element.closest(WHITEBLOOM_CHROME_SELECTOR) !== null
    })
  )
}

type RectSnapshot = {
  x: number
  y: number
  width: number
  height: number
}

function getRectSnapshot(rect: DOMRect): RectSnapshot {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  }
}

function didRectMove(left: RectSnapshot | null, right: RectSnapshot): boolean {
  if (!left) return false
  return (
    Math.abs(left.x - right.x) > MOTION_THRESHOLD_PX ||
    Math.abs(left.y - right.y) > MOTION_THRESHOLD_PX ||
    Math.abs(left.width - right.width) > MOTION_THRESHOLD_PX ||
    Math.abs(left.height - right.height) > MOTION_THRESHOLD_PX
  )
}

export function WebBloomNode({
  id,
  resource,
  label,
  size,
  selected,
  dragging
}: BudNodeProps): ReactElement {
  const viewId = `webbloom:${id}`
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const lastBoundsRef = useRef<string | null>(null)
  const lastRectRef = useRef<RectSnapshot | null>(null)
  const motionPauseUntilRef = useRef(0)
  const captureInFlightRef = useRef(false)
  const nativeViewVisibleRef = useRef(false)
  const internalNode = useInternalNode(id)
  const positionAbsoluteX = internalNode?.internals.positionAbsolute.x ?? 0
  const positionAbsoluteY = internalNode?.internals.positionAbsolute.y ?? 0
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()
  const nativeViewsVisible = useWebBloomNativeViewsVisible()
  const [localSize, setLocalSize] = useState(size)
  const [viewState, setViewState] = useState({ resource, ready: false })
  const [motionPaused, setMotionPaused] = useState(false)
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null)
  const viewReady = viewState.resource === resource && viewState.ready

  const handleResizePreview = useCallback(
    ({
      size: nextSize
    }: {
      position: { x: number; y: number }
      size: { w: number; h: number }
    }): void => {
      setLocalSize(nextSize)
    },
    []
  )

  const handleResizeCommit = useCallback(
    ({
      position,
      size: nextSize
    }: {
      position: { x: number; y: number }
      size: { w: number; h: number }
    }): void => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, nextSize.w, nextSize.h)
    },
    [id, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    nodeId: id,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })
  const renderedSize = isResizing ? localSize : size
  const shouldShowNativeView = nativeViewsVisible && !dragging && !isResizing && !motionPaused

  const captureSnapshot = useCallback((): void => {
    if (!viewReady || captureInFlightRef.current) return

    captureInFlightRef.current = true
    void window.api
      .captureWebBloomView(viewId)
      .then((result) => {
        if (result.ok && result.dataUrl) {
          setSnapshotDataUrl(result.dataUrl)
        }
      })
      .finally(() => {
        captureInFlightRef.current = false
      })
  }, [viewId, viewReady])

  const setNativeViewVisible = useCallback(
    (visible: boolean): void => {
      if (nativeViewVisibleRef.current === visible) return
      if (nativeViewVisibleRef.current && !visible) {
        captureSnapshot()
      }
      nativeViewVisibleRef.current = visible
    },
    [captureSnapshot]
  )

  const syncBounds = useCallback(
    (visible: boolean): void => {
      const element = bodyRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const rectSnapshot = getRectSnapshot(rect)
      const now = window.performance.now()

      if (visible && didRectMove(lastRectRef.current, rectSnapshot)) {
        motionPauseUntilRef.current = now + MOTION_PAUSE_MS
        if (!motionPaused) {
          captureSnapshot()
          setMotionPaused(true)
        }
      } else if (motionPaused && now >= motionPauseUntilRef.current) {
        setMotionPaused(false)
      }
      lastRectRef.current = rectSnapshot

      const intersectsViewport = rectIntersectsViewport(rect)
      const occludedByChrome = isRectOccludedByWhitebloomChrome(rect, element)
      const pausedByMotion = now < motionPauseUntilRef.current
      const bounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible:
          visible &&
          shouldShowNativeView &&
          !pausedByMotion &&
          intersectsViewport &&
          !occludedByChrome &&
          rect.width > 8 &&
          rect.height > 8
      }
      setNativeViewVisible(bounds.visible)
      const serialized = JSON.stringify({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        visible: bounds.visible
      })
      if (serialized === lastBoundsRef.current) return

      lastBoundsRef.current = serialized
      void window.api.setWebBloomBounds(viewId, bounds)
    },
    [captureSnapshot, motionPaused, setNativeViewVisible, shouldShowNativeView, viewId]
  )

  useEffect(() => {
    let disposed = false
    lastBoundsRef.current = null
    lastRectRef.current = null
    motionPauseUntilRef.current = 0
    nativeViewVisibleRef.current = false

    void window.api.createWebBloomView(viewId, resource).then((result) => {
      if (disposed) return
      setViewState({ resource, ready: result.ok })
    })

    return () => {
      disposed = true
      void window.api.destroyWebBloomView(viewId)
    }
  }, [resource, viewId])

  useEffect(() => {
    let animationFrame = 0
    const tick = (): void => {
      syncBounds(viewReady)
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [syncBounds, viewReady])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, renderedSize.h, renderedSize.w, updateNodeInternals])

  const title = label ?? getUrlLabel(resource)
  const showSnapshot = viewReady && !shouldShowNativeView && snapshotDataUrl !== null

  return (
    <>
      <div
        className={[
          'webbloom-node',
          selected ? 'webbloom-node--selected' : '',
          isResizing ? 'webbloom-node--resizing' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ width: renderedSize.w, height: renderedSize.h }}
      >
        <div className="webbloom-node__header">
          <Globe size={14} strokeWidth={1.8} />
          <span className="webbloom-node__title">{title}</span>
          <span className="webbloom-node__url">{resource}</span>
          <ExternalLink
            size={14}
            strokeWidth={1.8}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              void window.api.openUrl(resource)
            }}
          />
        </div>
        <div
          ref={bodyRef}
          className="webbloom-node__body nowheel"
          style={{ width: renderedSize.w, height: Math.max(1, renderedSize.h - HEADER_HEIGHT) }}
          onPointerDown={() => {
            void window.api.focusWebBloomView(viewId)
          }}
        >
          {showSnapshot ? (
            <img
              className="webbloom-node__snapshot"
              src={snapshotDataUrl}
              alt=""
              draggable={false}
            />
          ) : null}
          {!viewReady || !shouldShowNativeView ? (
            <div
              className={[
                'webbloom-node__loading',
                showSnapshot ? 'webbloom-node__loading--over-snapshot' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {viewReady && !showSnapshot ? 'Web view paused' : !viewReady ? 'Loading...' : ''}
            </div>
          ) : null}
        </div>
      </div>
      <NodeResizeHandles
        visible={(selected || isResizing) && !dragging}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
