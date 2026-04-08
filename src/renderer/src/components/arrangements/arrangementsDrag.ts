import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GardenCameraState } from '../../../../shared/arrangements'
import {
  MICA_DRAG_COORDINATE_SPACE,
  getMicaDragCoordinator,
  useMicaDragHoverIntent,
  useMicaDragState,
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
const ARRANGEMENTS_SPRING_LOAD_DELAY_MS = 600

export type ArrangementsDragSource =
  | {
      kind: 'desktop'
    }
  | {
      kind: 'bin'
      binId: string
    }
  | {
      kind: 'trash'
    }
  | {
      kind: 'set'
      setId: string
    }

export type ArrangementsMaterialDragPayload = {
  materialKeys: string[]
  primaryMaterialKey: string
  source: ArrangementsDragSource
}

export type ArrangementsMaterialDragPreview = {
  label: string
  count: number
  stackCount: number
}

export type ArrangementsMaterialDropCommand =
  | {
      kind: 'move-to-desktop'
      materialKey: string
      position: MicaScreenPoint
    }
  | {
      kind: 'assign-to-bin'
      materialKey: string
      binId: string
    }
  | {
      kind: 'send-to-trash'
      materialKey: string
    }
  | {
      kind: 'add-to-set'
      materialKey: string
      setId: string
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
  source: ArrangementsDragSource
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
  const dragState = getMicaDragCoordinator().getSnapshot()
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

export function createArrangementsMaterialDropCommands(
  resolution: ArrangementsDropResolution,
  payload: ArrangementsMaterialDragPayload
): ArrangementsMaterialDropCommand[] {
  const { target, pointer } = resolution
  if (!target?.meta) return []
  const meta = target.meta as ArrangementsDropTargetMeta

  switch (meta.type) {
    case 'desktop': {
      const basePoint = getDesktopWorldPoint(pointer.screen, target.bounds, meta.camera)
      return payload.materialKeys.map((materialKey, index) => ({
        kind: 'move-to-desktop',
        materialKey,
        position: offsetDesktopPlacement(basePoint, index)
      }))
    }
    case 'bin': {
      if (payload.source.kind === 'bin' && payload.source.binId === meta.binId) return []
      return payload.materialKeys.map((materialKey) => ({
        kind: 'assign-to-bin',
        materialKey,
        binId: meta.binId
      }))
    }
    case 'set': {
      if (payload.source.kind === 'set' && payload.source.setId === meta.setId) return []
      return payload.materialKeys.map((materialKey) => ({
        kind: 'add-to-set',
        materialKey,
        setId: meta.setId
      }))
    }
    case 'trash': {
      if (payload.source.kind === 'trash') return []
      return payload.materialKeys.map((materialKey) => ({
        kind: 'send-to-trash',
        materialKey
      }))
    }
    default:
      return []
  }
}

function applyArrangementsMaterialDropCommands(commands: ArrangementsMaterialDropCommand[]): boolean {
  if (commands.length === 0) return false

  const { addToSet, assignToBin, moveMaterialOnDesktop, removeFromBin, sendToTrash } =
    useArrangementsStore.getState()

  for (const command of commands) {
    switch (command.kind) {
      case 'move-to-desktop':
        removeFromBin(command.materialKey)
        moveMaterialOnDesktop(command.materialKey, command.position)
        break
      case 'assign-to-bin':
        assignToBin(command.materialKey, command.binId)
        break
      case 'send-to-trash':
        sendToTrash(command.materialKey)
        break
      case 'add-to-set':
        addToSet(command.materialKey, command.setId)
        break
      default:
        break
    }
  }

  return true
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
  const hoverIntentDelayMs =
    descriptor.meta?.type === 'bin' || descriptor.meta?.type === 'set'
      ? ARRANGEMENTS_SPRING_LOAD_DELAY_MS
      : undefined

  useMicaDropTarget({
    ...descriptor,
    hoverIntentDelayMs,
    acceptedPayloadKinds: ARRANGEMENTS_DRAG_ACCEPTED_KINDS
  })
}

export function useArrangementsSpringLoadHover(targetId: string): boolean {
  return useMicaDragHoverIntent(targetId)
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
  source,
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
        const dragCoordinator = getMicaDragCoordinator()
        dragCoordinator.updateDrag(pointer)
        const resolution = resolveArrangementsDropTarget()
        const completedSession = dragCoordinator.completeDrag()
        if (
          completedSession?.payload.kind === ARRANGEMENTS_MATERIAL_DRAG_KIND &&
          resolution
        ) {
          const dragPayload = completedSession.payload.data as ArrangementsMaterialDragPayload
          const commands = createArrangementsMaterialDropCommands(resolution, dragPayload)
          if (applyArrangementsMaterialDropCommands(commands)) {
            onDragCommitted?.(dragPayload.materialKeys)
          }
        }
      } else if (isDragging) {
        getMicaDragCoordinator().cancelDrag()
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

        getMicaDragCoordinator().startDrag({
          payload: {
            kind: ARRANGEMENTS_MATERIAL_DRAG_KIND,
            data: {
              materialKeys: pending.materialKeys,
              primaryMaterialKey: materialKey,
              source
            }
          },
          source: {
            context: source.kind,
            data:
              source.kind === 'bin'
                ? { binId: source.binId }
                : source.kind === 'set'
                  ? { setId: source.setId }
                  : undefined
          },
          pointer,
          preview: {
            stackCount: pending.materialKeys.length,
            meta: {
              label: materialLabel,
              count: pending.materialKeys.length,
              stackCount: pending.materialKeys.length
            } satisfies ArrangementsMaterialDragPreview
          }
        })

        setIsDragging(true)
        return
      }

      getMicaDragCoordinator().updateDrag(pointer)
    },
    [isDragging, materialKey, materialLabel, source]
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
