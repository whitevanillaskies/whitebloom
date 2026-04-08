import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GardenCameraState } from '../../../../shared/arrangements'
import {
  MICA_DRAG_COORDINATE_SPACE,
  useMicaDragState,
  useMicaDragStore,
  useMicaDropTarget,
  type MicaDragPointer,
  type MicaDropTargetDescriptor,
  type MicaRegisteredDropTarget,
  type MicaScreenPoint,
  type MicaScreenRect
} from '../../mica'
import { useArrangementsStore } from '../../stores/arrangements'

export const ARRANGEMENTS_MICA_HOST_ID = 'arrangements-desktop'
export const ARRANGEMENTS_MATERIAL_DRAG_KIND = 'arrangements-material'
export const ARRANGEMENTS_DRAG_ACCEPTED_KINDS = [ARRANGEMENTS_MATERIAL_DRAG_KIND] as const

const ARRANGEMENTS_DRAG_THRESHOLD = 6
const DESKTOP_DROP_SPACING = 22

export type ArrangementsDragSourceContext = 'desktop' | 'bin' | 'trash'

export type ArrangementsMaterialDragPayload = {
  materialKeys: string[]
  primaryMaterialKey: string
  sourceContext: ArrangementsDragSourceContext
}

export type ArrangementsMaterialDragPreview = {
  label: string
  count: number
}

export type ArrangementsDropTargetMeta =
  | {
      type: 'desktop'
      camera: GardenCameraState
    }
  | {
      type: 'set'
      setId: string
    }
  | {
      type: 'bin'
      binId: string
    }
  | {
      type: 'trash'
    }

type UseArrangementsMaterialDragOptions = {
  materialKey: string
  materialLabel: string
  selectedKeys?: string[]
  sourceContext: ArrangementsDragSourceContext
  sourceBinId?: string
  onSelect?: (key: string, additive: boolean) => void
  onDragCommitted?: (materialKeys: string[]) => void
}

type ArrangementsDropResolution = {
  target:
    | (MicaRegisteredDropTarget<typeof ARRANGEMENTS_MATERIAL_DRAG_KIND, ArrangementsDropTargetMeta> & {
        bounds: MicaScreenRect
      })
    | null
  pointer: MicaDragPointer
}

function createPointer(event: Pick<PointerEvent, 'pointerId' | 'pointerType' | 'clientX' | 'clientY'>): MicaDragPointer {
  return {
    pointerId: event.pointerId,
    pointerType:
      event.pointerType === 'mouse' || event.pointerType === 'pen' || event.pointerType === 'touch'
        ? event.pointerType
        : 'unknown',
    screen: {
      x: event.clientX,
      y: event.clientY
    },
    client: {
      x: event.clientX,
      y: event.clientY
    }
  }
}

function getDesktopWorldPoint(
  pointer: MicaScreenPoint,
  bounds: MicaScreenRect,
  camera: GardenCameraState
): MicaScreenPoint {
  return {
    x: (pointer.x - bounds.x - camera.x) / camera.zoom,
    y: (pointer.y - bounds.y - camera.y) / camera.zoom
  }
}

function offsetDesktopPlacement(base: MicaScreenPoint, index: number): MicaScreenPoint {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    x: base.x + column * DESKTOP_DROP_SPACING,
    y: base.y + row * DESKTOP_DROP_SPACING
  }
}

function resolveArrangementsDropTarget(): ArrangementsDropResolution | null {
  const dragState = useMicaDragStore.getState()
  if (!dragState.session) return null

  const activeTarget = dragState.activeTargetId ? dragState.targets[dragState.activeTargetId] : null
  if (!activeTarget?.bounds) {
    return {
      target: null,
      pointer: dragState.session.pointer
    }
  }

  return {
    target: activeTarget as ArrangementsDropResolution['target'],
    pointer: dragState.session.pointer
  }
}

function commitArrangementsMaterialDrop(
  resolution: ArrangementsDropResolution,
  payload: ArrangementsMaterialDragPayload
): boolean {
  const { target, pointer } = resolution
  if (!target?.meta) return false
  const meta = target.meta as ArrangementsDropTargetMeta

  const { assignToBin, moveMaterialOnDesktop, removeFromBin, sendToTrash } =
    useArrangementsStore.getState()
  const addToSet = useArrangementsStore.getState().addToSet

  switch (meta.type) {
    case 'desktop': {
      const basePoint = getDesktopWorldPoint(pointer.screen, target.bounds, meta.camera)
      payload.materialKeys.forEach((materialKey, index) => {
        removeFromBin(materialKey)
        moveMaterialOnDesktop(materialKey, offsetDesktopPlacement(basePoint, index))
      })
      return true
    }
    case 'bin': {
      payload.materialKeys.forEach((materialKey) => {
        assignToBin(materialKey, meta.binId)
      })
      return true
    }
    case 'set': {
      payload.materialKeys.forEach((materialKey) => {
        addToSet(materialKey, meta.setId)
      })
      return true
    }
    case 'trash': {
      payload.materialKeys.forEach((materialKey) => {
        sendToTrash(materialKey)
      })
      return true
    }
    default:
      return false
  }
}

type PendingDragState = {
  pointerId: number
  start: MicaScreenPoint
  materialKeys: string[]
  element: HTMLElement
}

export function createArrangementsDropTargetId(
  kind: 'desktop' | 'set' | 'bin' | 'trash',
  id?: string
): string {
  return id ? `arrangements:${kind}:${id}` : `arrangements:${kind}`
}

export function useArrangementsDropTarget(
  descriptor: Omit<
    MicaDropTargetDescriptor<typeof ARRANGEMENTS_MATERIAL_DRAG_KIND, ArrangementsDropTargetMeta>,
    'acceptedPayloadKinds' | 'bounds'
  > & {
    element: HTMLElement | null
  }
): void {
  useMicaDropTarget({
    ...descriptor,
    acceptedPayloadKinds: ARRANGEMENTS_DRAG_ACCEPTED_KINDS
  })
}

export function useArrangementsDragTargetActive(targetId: string): boolean {
  return useMicaDragState(
    (state) =>
      state.session?.coordinateSpace === MICA_DRAG_COORDINATE_SPACE &&
      state.session?.payload.kind === ARRANGEMENTS_MATERIAL_DRAG_KIND &&
      state.activeTargetId === targetId
  )
}

export function useArrangementsMaterialDragging(materialKey: string): boolean {
  return useMicaDragState((state) => {
    if (state.session?.payload.kind !== ARRANGEMENTS_MATERIAL_DRAG_KIND) return false
    const data = state.session.payload.data as ArrangementsMaterialDragPayload
    return data.materialKeys.includes(materialKey)
  })
}

export function useArrangementsMaterialDrag({
  materialKey,
  materialLabel,
  selectedKeys = [],
  sourceContext,
  sourceBinId,
  onSelect,
  onDragCommitted
}: UseArrangementsMaterialDragOptions): {
  isDragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
} {
  const pendingRef = useRef<PendingDragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
      const pending = pendingRef.current
      if (!pending || pending.pointerId !== event.pointerId) return

      const element = pending.element
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId)
      }

      const pointer = createPointer(event.nativeEvent)
      if (!cancelled && isDragging) {
        useMicaDragStore.getState().updateDrag(pointer)
        const resolution = resolveArrangementsDropTarget()
        const completedSession = useMicaDragStore.getState().completeDrag()
        if (
          completedSession?.payload.kind === ARRANGEMENTS_MATERIAL_DRAG_KIND &&
          resolution &&
          commitArrangementsMaterialDrop(
            resolution,
            completedSession.payload.data as ArrangementsMaterialDragPayload
          )
        ) {
          onDragCommitted?.(
            (completedSession.payload.data as ArrangementsMaterialDragPayload).materialKeys
          )
        }
      } else if (isDragging) {
        useMicaDragStore.getState().cancelDrag()
      }

      pendingRef.current = null
      setIsDragging(false)
    },
    [isDragging, onDragCommitted]
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return

      event.stopPropagation()
      const additive = event.metaKey || event.ctrlKey
      onSelect?.(materialKey, additive)

      const element = event.currentTarget
      const materialKeys =
        !additive && selectedKeys.includes(materialKey) && selectedKeys.length > 0
          ? [...selectedKeys]
          : [materialKey]

      pendingRef.current = {
        pointerId: event.pointerId,
        start: {
          x: event.clientX,
          y: event.clientY
        },
        materialKeys,
        element
      }

      element.setPointerCapture(event.pointerId)
    },
    [materialKey, onSelect, selectedKeys]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const pending = pendingRef.current
      if (!pending || pending.pointerId !== event.pointerId) return

      const dx = event.clientX - pending.start.x
      const dy = event.clientY - pending.start.y
      const pointer = createPointer(event.nativeEvent)

      if (!isDragging) {
        if (Math.hypot(dx, dy) < ARRANGEMENTS_DRAG_THRESHOLD) return

        useMicaDragStore.getState().startDrag({
          payload: {
            kind: ARRANGEMENTS_MATERIAL_DRAG_KIND,
            data: {
              materialKeys: pending.materialKeys,
              primaryMaterialKey: materialKey,
              sourceContext
            }
          },
          source: {
            context: sourceContext,
            data: sourceBinId ? { binId: sourceBinId } : undefined
          },
          pointer,
          preview: {
            meta: {
              label: materialLabel,
              count: pending.materialKeys.length
            } satisfies ArrangementsMaterialDragPreview
          }
        })

        setIsDragging(true)
        return
      }

      useMicaDragStore.getState().updateDrag(pointer)
    },
    [isDragging, materialKey, materialLabel, sourceBinId, sourceContext]
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finishDrag(event, false)
    },
    [finishDrag]
  )

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finishDrag(event, true)
    },
    [finishDrag]
  )

  return {
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel
  }
}
