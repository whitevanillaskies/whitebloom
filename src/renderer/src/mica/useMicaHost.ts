import { useMemo, useSyncExternalStore } from 'react'
import {
  createMicaHostCoordinator
} from './hostCoordinator'
import type { MicaHostCoordinator, RetargetOptions, WindowUiStateUpdater } from './hostCoordinator'
import type {
  MicaAnyWindowRoute,
  MicaHostPolicy,
  MicaHostState,
  MicaHostSnapshot,
  MicaWindowGeometry,
  MicaWindowOpenInput,
  MicaWindowRecord,
  MicaWindowRoute
} from './model'

export type UseMicaHostResult<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  policy: MicaHostPolicy<TRoute['kind']>
  state: MicaHostState<TRoute, TUiState>
  windows: Array<MicaWindowRecord<TRoute, TUiState>>
  activeWindowId: string | null
  snapshot: MicaHostSnapshot<TRoute, TUiState>
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

export function useMicaHost<
  TRoute extends MicaWindowRoute<string, unknown>,
  TUiState = unknown
>(
  policy: MicaHostPolicy<TRoute['kind']>,
  coordinator?: MicaHostCoordinator<TRoute, TUiState>
): UseMicaHostResult<TRoute, TUiState> {
  const resolvedCoordinator = useMemo(
    () => coordinator ?? createMicaHostCoordinator<TRoute, TUiState>(policy),
    [coordinator, policy]
  )

  const snapshot = useSyncExternalStore(
    resolvedCoordinator.subscribe,
    resolvedCoordinator.getSnapshot,
    resolvedCoordinator.getSnapshot
  )
  const state = snapshot.state as MicaHostState<TRoute, TUiState>
  const resolvedPolicy = snapshot.policy as MicaHostPolicy<TRoute['kind']>

  return {
    policy: resolvedPolicy,
    state,
    windows: state.windows,
    activeWindowId: state.activeWindowId,
    snapshot,
    open: resolvedCoordinator.open,
    retarget: resolvedCoordinator.retarget,
    move: resolvedCoordinator.move,
    close: resolvedCoordinator.close,
    focus: resolvedCoordinator.focus,
    setWindowUiState: resolvedCoordinator.setWindowUiState,
    clear: resolvedCoordinator.clear
  }
}
