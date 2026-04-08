import {
  createEmptyMicaHostState,
  createMicaWindowRecord,
  MICA_PLACEMENT_MODE,
  resolveMicaPersistenceBoundary
} from './model'
import type {
  MicaAnyWindowRoute,
  MicaHostPolicy,
  MicaHostState,
  MicaHostSnapshot,
  MicaWindowFocusState,
  MicaWindowGeometry,
  MicaWindowOpenInput,
  MicaWindowRecord,
  MicaWindowRoute,
  MicaWindowVisibility
} from './model'

type WindowUiStateUpdater<TUiState> = TUiState | ((current: TUiState) => TUiState)

type RetargetOptions<TUiState> = {
  uiState?: WindowUiStateUpdater<TUiState>
  focusState?: MicaWindowFocusState
  visibility?: MicaWindowVisibility
}

export type MicaHostCoordinator<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  readonly policy: MicaHostPolicy<TRoute['kind']>
  getSnapshot: () => MicaHostSnapshot<TRoute, TUiState>
  subscribe: (listener: () => void) => () => void
  open: (input: MicaWindowOpenInput<TRoute, TUiState>) => MicaWindowRecord<TRoute, TUiState> | null
  retarget: (
    windowId: string,
    route: TRoute,
    options?: RetargetOptions<TUiState>
  ) => void
  move: (windowId: string, position: Pick<MicaWindowGeometry, 'x' | 'y'>) => void
  close: (windowId: string) => void
  focus: (windowId: string) => void
  setWindowUiState: (windowId: string, updater: WindowUiStateUpdater<TUiState>) => void
  clear: () => void
}

export type {
  RetargetOptions,
  WindowUiStateUpdater
}

function applyWindowUiState<TUiState>(
  current: TUiState,
  updater: WindowUiStateUpdater<TUiState>
): TUiState {
  return typeof updater === 'function'
    ? (updater as (value: TUiState) => TUiState)(current)
    : updater
}

function isAllowedKind(policy: MicaHostPolicy, kind: string): boolean {
  return !policy.allowedKinds || policy.allowedKinds.includes(kind)
}

function findReusableWindowIndex<
  TRoute extends MicaWindowRoute<string, unknown>,
  TUiState
>(
  windows: Array<MicaWindowRecord<TRoute, TUiState>>,
  input: MicaWindowOpenInput<TRoute, TUiState>,
  policy: MicaHostPolicy<TRoute['kind']>
): number {
  switch (policy.windowLimit) {
    case 'single':
      return windows.length > 0 ? 0 : -1
    case 'single-per-kind':
      return windows.findIndex((window) => window.kind === input.kind)
    case 'multiple':
    default:
      return -1
  }
}

function blurOtherWindows<
  TRoute extends MicaAnyWindowRoute,
  TUiState
>(
  windows: Array<MicaWindowRecord<TRoute, TUiState>>,
  focusedWindowId: string
): Array<MicaWindowRecord<TRoute, TUiState>> {
  return windows.map((window) => ({
    ...window,
    focusState: window.id === focusedWindowId ? 'focused' : 'unfocused'
  }))
}

function resolveHostPolicy<TRoute extends MicaWindowRoute<string, unknown>>(
  policy: MicaHostPolicy<TRoute['kind']>
): MicaHostPolicy<TRoute['kind']> {
  return {
    ...policy,
    placementMode: policy.placementMode ?? MICA_PLACEMENT_MODE,
    persistence: resolveMicaPersistenceBoundary(policy)
  }
}

export function createMicaHostCoordinator<
  TRoute extends MicaWindowRoute<string, unknown>,
  TUiState = unknown
>(
  policy: MicaHostPolicy<TRoute['kind']>,
  initialState?: MicaHostState<TRoute, TUiState>
): MicaHostCoordinator<TRoute, TUiState> {
  const resolvedPolicy = resolveHostPolicy(policy)
  let state =
    initialState ??
    (createEmptyMicaHostState(resolvedPolicy.hostId) as MicaHostState<TRoute, TUiState>)
  let snapshot: MicaHostSnapshot<TRoute, TUiState> = {
    policy: resolvedPolicy,
    state
  }
  const listeners = new Set<() => void>()

  const emit = () => {
    listeners.forEach((listener) => listener())
  }

  const updateState = (
    updater: (current: MicaHostState<TRoute, TUiState>) => MicaHostState<TRoute, TUiState>
  ): void => {
    const nextState = updater(state)
    if (nextState === state) return
    state = nextState
    snapshot = {
      policy: resolvedPolicy,
      state
    }
    emit()
  }

  return {
    policy: resolvedPolicy,

    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    open: (input) => {
      if (!isAllowedKind(resolvedPolicy, input.kind)) {
        return null
      }

      let nextWindow: MicaWindowRecord<TRoute, TUiState> | null = null

      updateState((current) => {
        const reusableIndex = findReusableWindowIndex(current.windows, input, resolvedPolicy)
        if (reusableIndex >= 0) {
          const existingWindow = current.windows[reusableIndex]
          const nextGeometry =
            existingWindow.visibility === 'closed' ? input.geometry : existingWindow.geometry
          nextWindow = {
            ...existingWindow,
            kind: input.kind,
            payload: input.payload,
            geometry: nextGeometry,
            visibility: input.visibility ?? 'open',
            focusState: input.focusState ?? 'focused',
            uiState: input.uiState
          }

          const windows = blurOtherWindows(
            current.windows.map((window, index) =>
              index === reusableIndex ? nextWindow! : window
            ),
            nextWindow.id
          )

          return {
            ...current,
            windows,
            activeWindowId: nextWindow.id
          }
        }

        nextWindow = createMicaWindowRecord(resolvedPolicy.hostId, input)
        return {
          ...current,
          windows: blurOtherWindows([...current.windows, nextWindow], nextWindow.id),
          activeWindowId: nextWindow.id
        }
      })

      return nextWindow
    },

    retarget: (windowId, route, options) => {
      updateState((current) => {
        const targetWindow = current.windows.find((window) => window.id === windowId)
        if (!targetWindow) return current
        if (!isAllowedKind(resolvedPolicy, route.kind)) return current

        const nextWindow: MicaWindowRecord<TRoute, TUiState> = {
          ...targetWindow,
          kind: route.kind,
          payload: route.payload,
          visibility: options?.visibility ?? 'open',
          focusState: options?.focusState ?? 'focused',
          uiState:
            options?.uiState !== undefined
              ? applyWindowUiState(targetWindow.uiState, options.uiState)
              : targetWindow.uiState
        }

        return {
          ...current,
          windows: blurOtherWindows(
            current.windows.map((window) => (window.id === windowId ? nextWindow : window)),
            windowId
          ),
          activeWindowId: windowId
        }
      })
    },

    move: (windowId, position) => {
      updateState((current) => ({
        ...current,
        windows: current.windows.map((window) =>
          window.id === windowId
            ? {
                ...window,
                geometry: {
                  ...window.geometry,
                  x: position.x,
                  y: position.y
                }
              }
            : window
        )
      }))
    },

    close: (windowId) => {
      updateState((current) => ({
        ...current,
        windows: current.windows.map((window) =>
          window.id === windowId
            ? { ...window, visibility: 'closed', focusState: 'unfocused' }
            : window
        ),
        activeWindowId: current.activeWindowId === windowId ? null : current.activeWindowId
      }))
    },

    focus: (windowId) => {
      updateState((current) => {
        if (!current.windows.some((window) => window.id === windowId)) return current
        return {
          ...current,
          windows: blurOtherWindows(current.windows, windowId).map((window) =>
            window.id === windowId ? { ...window, visibility: 'open' } : window
          ),
          activeWindowId: windowId
        }
      })
    },

    setWindowUiState: (windowId, updater) => {
      updateState((current) => ({
        ...current,
        windows: current.windows.map((window) =>
          window.id === windowId
            ? { ...window, uiState: applyWindowUiState(window.uiState, updater) }
            : window
        )
      }))
    },

    clear: () => {
      updateState(() =>
        createEmptyMicaHostState(resolvedPolicy.hostId) as MicaHostState<TRoute, TUiState>
      )
    }
  }
}
