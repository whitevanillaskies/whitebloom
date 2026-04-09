import { useCallback, useEffect, useRef, useState } from 'react'
import { useInternalNode, useStore, useUpdateNodeInternals, useViewport } from '@xyflow/react'
import { createPlayer } from '@videojs/react'
import { Video, VideoSkin, videoFeatures } from '@videojs/react/video'
import '@videojs/react/video/skin.css'
import { useBoardStore } from '@renderer/stores/board'
import { resourceToMediaSrc } from '@renderer/shared/resource-url'
import { NodeResizeHandles } from '../../canvas/NodeResizeHandles'
import { useFixedCornerResize } from '../../canvas/useFixedCornerResize'
import type { BudNodeProps } from '../types'
import './VideoNode.css'

const MIN_SIZE = 80
const videoPlayer = createPlayer({
  features: videoFeatures,
  displayName: 'WhitebloomVideoPlayer'
})

let activeVideoElement: HTMLVideoElement | null = null

function setActiveVideoElement(nextVideo: HTMLVideoElement | null): void {
  if (activeVideoElement && activeVideoElement !== nextVideo) {
    activeVideoElement.pause()
  }
  activeVideoElement = nextVideo
}

export function VideoNodeComponent({ id, resource, size, selected, dragging, onBloom }: BudNodeProps) {
  const internalNode = useInternalNode(id)
  const positionAbsoluteX = internalNode?.internals.positionAbsolute.x ?? 0
  const positionAbsoluteY = internalNode?.internals.positionAbsolute.y ?? 0

  const { x, y, zoom } = useViewport()
  const canvasWidth = useStore((s) => s.width)
  const canvasHeight = useStore((s) => s.height)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()

  const [isVisible, setIsVisible] = useState(true)
  const [localSize, setLocalSize] = useState({ w: size.w, h: size.h })
  const [videoSrc, setVideoSrc] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    try {
      setVideoSrc(resourceToMediaSrc(resource))
    } catch {
      setVideoSrc('')
    }
  }, [resource])

  const handleResizePreview = useCallback(
    ({ size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
    },
    []
  )

  const handleResizeCommit = useCallback(
    ({ position, size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, nextSize.w, nextSize.h)
    },
    [id, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    nodeId: id,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size: localSize,
    minWidth: MIN_SIZE,
    minHeight: MIN_SIZE,
    keepAspectRatio: true,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })

  useEffect(() => {
    if (isResizing) return
    setLocalSize({ w: size.w, h: size.h })
  }, [isResizing, size.w, size.h])

  useEffect(() => {
    if (isVisible) return

    const video = videoRef.current
    if (!video) return
    video.pause()

    if (activeVideoElement === video) {
      activeVideoElement = null
    }
  }, [isVisible])

  useEffect(() => {
    return () => {
      if (activeVideoElement === videoRef.current) {
        activeVideoElement = null
      }
    }
  }, [])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])

  useEffect(() => {
    const timer = setTimeout(() => {
      const nodeScreenX = positionAbsoluteX * zoom + x
      const nodeScreenY = positionAbsoluteY * zoom + y
      const nodeScreenW = localSize.w * zoom
      const nodeScreenH = localSize.h * zoom
      const bufferX = canvasWidth * 0.15
      const bufferY = canvasHeight * 0.15

      const visible =
        nodeScreenX + nodeScreenW > -bufferX &&
        nodeScreenX < canvasWidth + bufferX &&
        nodeScreenY + nodeScreenH > -bufferY &&
        nodeScreenY < canvasHeight + bufferY

      setIsVisible(visible)
    }, 400)

    return () => clearTimeout(timer)
  }, [x, y, zoom, positionAbsoluteX, positionAbsoluteY, localSize.w, localSize.h, canvasWidth, canvasHeight])

  return (
    <>
      <div
        className={`video-node${selected ? ' video-node--selected' : ''}${isResizing ? ' video-node--resizing nodrag nopan' : ''}`}
        style={{ width: localSize.w, height: localSize.h }}
        onDoubleClick={(e) => { e.stopPropagation(); onBloom() }}
      >
        <div className="video-node__frame">
          {isVisible && videoSrc ? (
            <videoPlayer.Provider>
              <VideoSkin className="video-node__player nodrag nopan">
                <Video
                  key={videoSrc}
                  ref={videoRef}
                  src={videoSrc}
                  preload="metadata"
                  playsInline
                  onPlay={(event) => setActiveVideoElement(event.currentTarget)}
                  onPause={(event) => {
                    if (activeVideoElement === event.currentTarget) {
                      activeVideoElement = null
                    }
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); onBloom() }}
                />
              </VideoSkin>
            </videoPlayer.Provider>
          ) : null}
          <div
            className="video-node__drag-surface"
            onDoubleClick={(e) => { e.stopPropagation(); onBloom() }}
            aria-hidden="true"
          />
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
