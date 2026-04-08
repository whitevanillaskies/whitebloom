export const MICA_PLACEMENT_MODE = 'screen-space' as const

export const MICA_PERSISTENCE_BOUNDARY = {
  route: 'session',
  geometry: 'session',
  visibility: 'session',
  focus: 'session',
  uiState: 'session'
} as const

export type MicaPlacementMode = typeof MICA_PLACEMENT_MODE

export type MicaPersistenceScope = 'session' | 'persisted'

export type MicaPersistenceBoundary = {
  route: MicaPersistenceScope
  geometry: MicaPersistenceScope
  visibility: MicaPersistenceScope
  focus: MicaPersistenceScope
  uiState: MicaPersistenceScope
}

export type MicaWindowVisibility = 'open' | 'closed'

export type MicaWindowFocusState = 'focused' | 'unfocused'

export type MicaWindowGeometry = {
  x: number
  y: number
  width: number
  height: number
  minWidth?: number
  minHeight?: number
}

export type MicaWindowRoute<TKind extends string = string, TPayload = unknown> = {
  kind: TKind
  payload: TPayload
}

export type MicaAnyWindowRoute = MicaWindowRoute<string, unknown>

type MicaWindowRecordBase<TUiState> = {
  id: string
  hostId: string
  geometry: MicaWindowGeometry
  visibility: MicaWindowVisibility
  focusState: MicaWindowFocusState
  uiState: TUiState
}

export type MicaWindowRecord<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = TRoute extends MicaWindowRoute<infer TKind, infer TPayload>
  ? MicaWindowRecordBase<TUiState> & {
      kind: TKind
      payload: TPayload
    }
  : never

export type MicaWindowOpenInput<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = TRoute extends MicaWindowRoute<infer TKind, infer TPayload>
  ? {
      id?: string
      kind: TKind
      payload: TPayload
      geometry: MicaWindowGeometry
      uiState: TUiState
      focusState?: MicaWindowFocusState
      visibility?: MicaWindowVisibility
    }
  : never

export type MicaHostWindowLimit = 'single' | 'single-per-kind' | 'multiple'

export type MicaHostPolicy<TKind extends string = string> = {
  hostId: string
  placementMode: MicaPlacementMode
  windowLimit: MicaHostWindowLimit
  allowedKinds?: readonly TKind[]
  persistence?: Partial<MicaPersistenceBoundary>
}

export type MicaHostBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type MicaHostState<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  hostId: string
  windows: Array<MicaWindowRecord<TRoute, TUiState>>
  activeWindowId: string | null
}

export type MicaHostSnapshot<
  TRoute extends MicaAnyWindowRoute = MicaAnyWindowRoute,
  TUiState = unknown
> = {
  policy: MicaHostPolicy<TRoute['kind']>
  state: MicaHostState<TRoute, TUiState>
}

export function resolveMicaPersistenceBoundary(
  policy: Pick<MicaHostPolicy, 'persistence'>
): MicaPersistenceBoundary {
  return {
    ...MICA_PERSISTENCE_BOUNDARY,
    ...policy.persistence
  }
}

export function createEmptyMicaHostState(hostId: string): MicaHostState {
  return {
    hostId,
    windows: [],
    activeWindowId: null
  }
}

export function createMicaWindowRecord<
  TRoute extends MicaAnyWindowRoute,
  TUiState = unknown
>(
  hostId: string,
  input: MicaWindowOpenInput<TRoute, TUiState>
): MicaWindowRecord<TRoute, TUiState> {
  return {
    id: input.id ?? crypto.randomUUID(),
    hostId,
    kind: input.kind,
    payload: input.payload,
    geometry: input.geometry,
    visibility: input.visibility ?? 'open',
    focusState: input.focusState ?? 'focused',
    uiState: input.uiState
  } as MicaWindowRecord<TRoute, TUiState>
}
