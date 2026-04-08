import { useEffect, useLayoutEffect, useState } from 'react'
import { create } from 'zustand'

export const MICA_DRAG_COORDINATE_SPACE = 'screen-space' as const

export type MicaDragCoordinateSpace = typeof MICA_DRAG_COORDINATE_SPACE

export type MicaScreenPoint = {
  x: number
  y: number
}

export type MicaScreenRect = {
  x: number
  y: number
  width: number
  height: number
}

export type MicaDragPayload<TKind extends string = string, TData = unknown> = {
  kind: TKind
  data: TData
}

export type MicaAnyDragPayload = MicaDragPayload<string, unknown>

export type MicaDragSource<TContext extends string = string, TData = unknown> = {
  context: TContext
  data?: TData
}

export type MicaAnyDragSource = MicaDragSource<string, unknown>

export type MicaDragPointer = {
  pointerId: number
  pointerType: 'mouse' | 'pen' | 'touch' | 'unknown'
  screen: MicaScreenPoint
  client?: MicaScreenPoint
}

export type MicaDragPreview<TMeta = unknown> = {
  offset?: Partial<MicaScreenPoint>
  meta?: TMeta
  stackCount?: number
}

export type MicaDragSession<
  TPayload extends MicaAnyDragPayload = MicaAnyDragPayload,
  TSource extends MicaAnyDragSource = MicaAnyDragSource,
  TPreview = unknown
> = {
  id: string
  coordinateSpace: MicaDragCoordinateSpace
  payload: TPayload
  source: TSource
  pointer: MicaDragPointer
  origin: MicaScreenPoint
  preview?: MicaDragPreview<TPreview>
  startedAt: number
}

export type MicaDropTargetDescriptor<
  TAcceptedKind extends string = string,
  TMeta = unknown
> = {
  id: string
  hostId: string
  acceptedPayloadKinds: readonly TAcceptedKind[]
  bounds: MicaScreenRect | null
  disabled?: boolean
  hoverIntentDelayMs?: number
  meta?: TMeta
}

export type MicaRegisteredDropTarget<
  TAcceptedKind extends string = string,
  TMeta = unknown
> = MicaDropTargetDescriptor<TAcceptedKind, TMeta> & {
  registeredAt: number
}

export type MicaDragHoverState = {
  targetId: string | null
  enteredAt: number | null
  intentDelayMs: number | null
}

export type MicaDragHitTestResult = {
  targetId: string | null
  target: MicaRegisteredDropTarget | null
}

export type MicaDropTargetBindingOptions<
  TAcceptedKind extends string = string,
  TMeta = unknown
> = Omit<MicaDropTargetDescriptor<TAcceptedKind, TMeta>, 'bounds'> & {
  element: HTMLElement | null
}

export type MicaDragStartInput<
  TPayload extends MicaAnyDragPayload = MicaAnyDragPayload,
  TSource extends MicaAnyDragSource = MicaAnyDragSource,
  TPreview = unknown
> = {
  sessionId?: string
  payload: TPayload
  source: TSource
  pointer: MicaDragPointer
  preview?: MicaDragPreview<TPreview>
  startedAt?: number
}

export type MicaDragState = {
  coordinateSpace: MicaDragCoordinateSpace
  session: MicaDragSession | null
  hover: MicaDragHoverState
  targets: Record<string, MicaRegisteredDropTarget>
  activeTargetId: string | null
  startDrag: (input: MicaDragStartInput) => MicaDragSession
  updateDrag: (pointer: MicaDragPointer) => void
  setHoverTarget: (targetId: string | null, enteredAt?: number) => void
  hitTestTargets: (
    pointer?: MicaDragPointer | null,
    session?: MicaDragSession | null
  ) => MicaDragHitTestResult
  refreshActiveTarget: () => MicaDragHitTestResult
  cancelDrag: () => void
  completeDrag: () => MicaDragSession | null
  registerDropTarget: (descriptor: MicaDropTargetDescriptor, registeredAt?: number) => void
  updateDropTarget: (targetId: string, patch: Partial<MicaDropTargetDescriptor>) => void
  unregisterDropTarget: (targetId: string) => void
  clearDropTargets: () => void
  reset: () => void
}

const EMPTY_HOVER_STATE: MicaDragHoverState = {
  targetId: null,
  enteredAt: null,
  intentDelayMs: null
}

function createDragSession(input: MicaDragStartInput): MicaDragSession {
  return {
    id: input.sessionId ?? crypto.randomUUID(),
    coordinateSpace: MICA_DRAG_COORDINATE_SPACE,
    payload: input.payload,
    source: input.source,
    pointer: input.pointer,
    origin: input.pointer.screen,
    preview: input.preview,
    startedAt: input.startedAt ?? Date.now()
  }
}

function resolveHoverState(
  previousHover: MicaDragHoverState,
  nextTarget: MicaRegisteredDropTarget | null
): MicaDragHoverState {
  const nextTargetId = nextTarget?.id ?? null
  if (!nextTargetId) return EMPTY_HOVER_STATE
  const nextIntentDelayMs = nextTarget?.hoverIntentDelayMs ?? null
  return {
    targetId: nextTargetId,
    enteredAt: previousHover.targetId === nextTargetId ? previousHover.enteredAt : Date.now(),
    intentDelayMs:
      previousHover.targetId === nextTargetId ? previousHover.intentDelayMs : nextIntentDelayMs
  }
}

export function isPointInMicaScreenRect(point: MicaScreenPoint, rect: MicaScreenRect): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  )
}

export function canMicaDropTargetAcceptPayload(
  target: Pick<MicaRegisteredDropTarget, 'acceptedPayloadKinds' | 'disabled'>,
  payload: MicaAnyDragPayload
): boolean {
  return target.disabled !== true && target.acceptedPayloadKinds.includes(payload.kind)
}

export function createMicaScreenRect(input: MicaScreenRect): MicaScreenRect {
  return {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height
  }
}

export function measureMicaElementScreenRect(element: Element): MicaScreenRect {
  const rect = element.getBoundingClientRect()
  return createMicaScreenRect({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  })
}

function getTopmostMatchingTarget(
  targets: Record<string, MicaRegisteredDropTarget>,
  pointer: MicaDragPointer | null | undefined,
  session: MicaDragSession | null | undefined
): MicaDragHitTestResult {
  if (!pointer || !session) {
    return {
      targetId: null,
      target: null
    }
  }

  const match =
    Object.values(targets)
      .filter((target): target is MicaRegisteredDropTarget & { bounds: MicaScreenRect } =>
        Boolean(target.bounds)
      )
      .filter((target) => canMicaDropTargetAcceptPayload(target, session.payload))
      .filter((target) => isPointInMicaScreenRect(pointer.screen, target.bounds))
      .sort((left, right) => right.registeredAt - left.registeredAt)[0] ?? null

  return {
    targetId: match?.id ?? null,
    target: match
  }
}

export const useMicaDragStore = create<MicaDragState>((set, get) => ({
  coordinateSpace: MICA_DRAG_COORDINATE_SPACE,
  session: null,
  hover: EMPTY_HOVER_STATE,
  targets: {},
  activeTargetId: null,

  startDrag: (input) => {
    const session = createDragSession(input)
    const hit = getTopmostMatchingTarget(get().targets, session.pointer, session)
    set((state) => ({
      session,
      activeTargetId: hit.targetId,
      hover: resolveHoverState(state.hover, hit.target)
    }))
    return session
  },

  updateDrag: (pointer) =>
    set((state) => {
      if (!state.session) return state

      const session = {
        ...state.session,
        pointer
      }
      const hit = getTopmostMatchingTarget(state.targets, pointer, session)

      return {
        session,
        activeTargetId: hit.targetId,
        hover: resolveHoverState(state.hover, hit.target)
      }
    }),

  setHoverTarget: (targetId, enteredAt = Date.now()) =>
    set((state) => {
      if (state.hover.targetId === targetId) return state
      return {
        activeTargetId: targetId,
        hover: {
          targetId,
          enteredAt: targetId ? enteredAt : null,
          intentDelayMs: targetId ? state.targets[targetId]?.hoverIntentDelayMs ?? null : null
        }
      }
    }),

  hitTestTargets: (pointer, session) => {
    const state = get()
    return getTopmostMatchingTarget(
      state.targets,
      pointer ?? state.session?.pointer,
      session ?? state.session
    )
  },

  refreshActiveTarget: () => {
    const state = get()
    const hit = getTopmostMatchingTarget(state.targets, state.session?.pointer, state.session)
    set({
      activeTargetId: hit.targetId,
      hover: resolveHoverState(state.hover, hit.target)
    })
    return hit
  },

  cancelDrag: () =>
    set({
      session: null,
      activeTargetId: null,
      hover: EMPTY_HOVER_STATE
    }),

  completeDrag: () => {
    const completedSession = get().session
    set({
      session: null,
      activeTargetId: null,
      hover: EMPTY_HOVER_STATE
    })
    return completedSession
  },

  registerDropTarget: (descriptor, registeredAt = Date.now()) =>
    set((state) => {
      const targets = {
        ...state.targets,
        [descriptor.id]: {
          ...descriptor,
          registeredAt
        }
      }
      const hit = getTopmostMatchingTarget(targets, state.session?.pointer, state.session)
      return {
        targets,
        activeTargetId: hit.targetId,
        hover: resolveHoverState(state.hover, hit.target)
      }
    }),

  updateDropTarget: (targetId, patch) =>
    set((state) => {
      const target = state.targets[targetId]
      if (!target) return state

      const targets = {
        ...state.targets,
        [targetId]: {
          ...target,
          ...patch,
          id: target.id
        }
      }
      const hit = getTopmostMatchingTarget(targets, state.session?.pointer, state.session)

      return {
        targets,
        activeTargetId: hit.targetId,
        hover: resolveHoverState(state.hover, hit.target)
      }
    }),

  unregisterDropTarget: (targetId) =>
    set((state) => {
      if (!(targetId in state.targets)) return state

      const nextTargets = { ...state.targets }
      delete nextTargets[targetId]
      const hit = getTopmostMatchingTarget(nextTargets, state.session?.pointer, state.session)

      return {
        targets: nextTargets,
        activeTargetId: hit.targetId,
        hover: resolveHoverState(state.hover, hit.target)
      }
    }),

  clearDropTargets: () =>
    set({
      targets: {},
      activeTargetId: null,
      hover: EMPTY_HOVER_STATE
    }),

  reset: () =>
    set({
      coordinateSpace: MICA_DRAG_COORDINATE_SPACE,
      session: null,
      hover: EMPTY_HOVER_STATE,
      targets: {},
      activeTargetId: null
    })
}))

export function isMicaDragPayloadKind<
  TPayload extends MicaAnyDragPayload,
  TKind extends TPayload['kind']
>(payload: TPayload, kind: TKind): payload is Extract<TPayload, { kind: TKind }> {
  return payload.kind === kind
}

export function useMicaDragState<TResult>(
  selector: (state: MicaDragState) => TResult
): TResult {
  return useMicaDragStore(selector)
}

export function getMicaDragHoverElapsedMs(
  hover: Pick<MicaDragHoverState, 'targetId' | 'enteredAt'>,
  now = Date.now()
): number {
  if (!hover.targetId || hover.enteredAt === null) return 0
  return Math.max(0, now - hover.enteredAt)
}

export function isMicaDragHoverIntentReady(
  hover: Pick<MicaDragHoverState, 'targetId' | 'enteredAt' | 'intentDelayMs'>,
  targetId: string,
  now = Date.now()
): boolean {
  if (hover.targetId !== targetId || hover.enteredAt === null) return false
  if (hover.intentDelayMs === null) return false
  return getMicaDragHoverElapsedMs(hover, now) >= hover.intentDelayMs
}

export function useMicaDragHoverIntent(targetId: string): boolean {
  const hover = useMicaDragState((state) => state.hover)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (hover.targetId !== targetId || hover.enteredAt === null || hover.intentDelayMs === null) {
      return
    }

    if (isMicaDragHoverIntentReady(hover, targetId, Date.now())) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 50)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hover, targetId])

  return isMicaDragHoverIntentReady(hover, targetId, now)
}

export function useMicaDropTarget<
  TAcceptedKind extends string = string,
  TMeta = unknown
>({
  id,
  hostId,
  acceptedPayloadKinds,
  disabled,
  hoverIntentDelayMs,
  meta,
  element
}: MicaDropTargetBindingOptions<TAcceptedKind, TMeta>): void {
  useLayoutEffect(() => {
    if (!element) {
      useMicaDragStore.getState().unregisterDropTarget(id)
      return
    }

    const syncBounds = () => {
      const descriptor = {
        id,
        hostId,
        acceptedPayloadKinds,
        bounds: measureMicaElementScreenRect(element),
        disabled,
        hoverIntentDelayMs,
        meta
      } satisfies MicaDropTargetDescriptor<TAcceptedKind, TMeta>

      if (useMicaDragStore.getState().targets[id]) {
        useMicaDragStore.getState().updateDropTarget(id, descriptor)
      } else {
        useMicaDragStore.getState().registerDropTarget(descriptor)
      }
    }

    syncBounds()

    const resizeObserver = new ResizeObserver(syncBounds)
    resizeObserver.observe(element)
    window.addEventListener('resize', syncBounds)
    window.addEventListener('scroll', syncBounds, true)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.removeEventListener('scroll', syncBounds, true)
      useMicaDragStore.getState().unregisterDropTarget(id)
    }
  }, [acceptedPayloadKinds, disabled, element, hostId, hoverIntentDelayMs, id, meta])
}
