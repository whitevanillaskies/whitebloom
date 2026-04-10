import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useMicaDragState } from '../../mica'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import { MICA_PERSISTENCE_BOUNDARY, MicaHost, useMicaHost } from '../../mica'
import {
  createArrangementsCommandContext,
  type ArrangementsCommandContext
} from '../../commands'
import {
  PetalPalette,
  type PaletteCommandSession,
} from '../petal'
import ArrangementsDesktop from './ArrangementsDesktop'
import BinView from './BinView'
import DesktopBinItems, { DesktopTrashBin } from './DesktopBinItems'
import DesktopMaterialItems from './DesktopMaterialItems'
import {
  ARRANGEMENTS_MATERIAL_DRAG_KIND,
  ARRANGEMENTS_MICA_HOST_ID,
  type ArrangementsMaterialDragPayload,
  type ArrangementsMaterialDragPreview
} from './arrangementsDrag'
import SetsIsland from './SetsIsland'
import './ArrangementsView.css'
import type { GardenSetNode } from '../../../../shared/arrangements'

type ArrangementsViewProps = {
  workspaceName?: string
  onBack: () => void
  onOpenBoard: (boardPath: string) => void
}

type ArrangementsWindowRoute = {
  kind: 'bin-view'
  payload: {
    binId: string
  }
}

type ArrangementsWindowUiState = {
  kind: 'bin-view'
  preferences: {
    viewMode: 'icon' | 'list'
  }
  ephemeral: {
    searchQuery: string
    selectedKeys: string[]
  }
}

const DEFAULT_BIN_VIEW_GEOMETRY = {
  x: 28,
  y: 48,
  width: 552,
  height: 456,
  minWidth: 380,
  minHeight: 300
} as const

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest('input, textarea, [contenteditable="true"]') !== null
}

function createDefaultBinViewUiState(): ArrangementsWindowUiState {
  return {
    kind: 'bin-view',
    preferences: {
      viewMode: 'icon'
    },
    ephemeral: {
      searchQuery: '',
      selectedKeys: []
    }
  }
}

function flattenSetNodes(sets: GardenSetNode[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  return sets.flatMap((setNode) => [
    { id: setNode.id, name: setNode.name, depth },
    ...flattenSetNodes(setNode.children, depth + 1)
  ])
}

function ArrangementsDragOverlay(): React.JSX.Element | null {
  const session = useMicaDragState((state) => state.session)
  const activeTargetId = useMicaDragState((state) => state.activeTargetId)
  const activeTarget = useMicaDragState((state) =>
    state.activeTargetId ? state.targets[state.activeTargetId] : null
  )

  if (session?.payload.kind !== ARRANGEMENTS_MATERIAL_DRAG_KIND) return null

  const payload = session.payload.data as ArrangementsMaterialDragPayload
  const preview = session.preview?.meta as ArrangementsMaterialDragPreview | undefined
  const activeMeta = activeTarget?.meta as { type?: 'desktop' | 'bin' | 'trash' } | undefined
  const label = preview?.label ?? payload.primaryMaterialKey
  const count = preview?.count ?? payload.materialKeys.length
  const stackCount = preview?.stackCount ?? count
  const tone =
    activeMeta?.type === 'trash'
      ? 'danger'
      : activeTargetId
        ? 'accept'
        : 'neutral'

  return (
    <div
      className={[
        'arrangements-view__drag-preview',
        `arrangements-view__drag-preview--${tone}`
      ].join(' ')}
      style={{
        left: session.pointer.screen.x + 14,
        top: session.pointer.screen.y + 18
      }}
    >
      {stackCount > 1 ? (
        <span
          className="arrangements-view__drag-preview-stack"
          aria-hidden="true"
          style={{ ['--arrangements-drag-stack-count' as string]: Math.min(stackCount, 3) }}
        />
      ) : null}
      <span className="arrangements-view__drag-preview-title">{label}</span>
      {count > 1 ? (
        <span className="arrangements-view__drag-preview-count">{count}</span>
      ) : null}
    </div>
  )
}

export default function ArrangementsView({
  workspaceName,
  onBack,
  onOpenBoard
}: ArrangementsViewProps): React.JSX.Element {
  const isHydrated = useArrangementsStore((s) => s.isHydrated)
  const loadArrangements = useArrangementsStore((s) => s.loadArrangements)
  const bins = useArrangementsStore((s) => s.bins)
  const sets = useArrangementsStore((s) => s.sets)
  const createBinAtPoint = useArrangementsStore((s) => s.createBinAtPoint)
  const createBinAtViewportCenter = useArrangementsStore((s) => s.createBinAtViewportCenter)
  const createRootSet = useArrangementsStore((s) => s.createRootSet)
  const renameBin = useArrangementsStore((s) => s.renameBin)
  const renameSet = useArrangementsStore((s) => s.renameSet)
  const deleteBin = useArrangementsStore((s) => s.deleteBin)
  const deleteSet = useArrangementsStore((s) => s.deleteSet)
  const saveArrangements = useArrangementsStore((s) => s.saveArrangements)
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const desktopViewportRef = useRef<HTMLElement>(null)
  const [paletteSession, setPaletteSession] = useState<PaletteCommandSession | null>(null)
  const flattenedSetNodes = useMemo(() => flattenSetNodes(sets), [sets])
  const arrangementsMicaPolicy = useMemo(
    () => ({
      hostId: ARRANGEMENTS_MICA_HOST_ID,
      placementMode: 'screen-space' as const,
      windowLimit: 'single' as const,
      allowedKinds: ['bin-view'] as const,
      persistence: {
        ...MICA_PERSISTENCE_BOUNDARY,
        route: 'session' as const,
        geometry: 'session' as const,
        visibility: 'session' as const,
        focus: 'session' as const,
        uiState: 'session' as const
      }
    }),
    []
  )
  const arrangementsMica = useMicaHost<ArrangementsWindowRoute, ArrangementsWindowUiState>(
    arrangementsMicaPolicy
  )

  useEffect(() => {
    if (!workspaceRoot || isHydrated) return
    void loadArrangements()
  }, [workspaceRoot, isHydrated, loadArrangements])

  const handleDeleteBin = useCallback(
    (binId: string) => {
      for (const window of arrangementsMica.windows) {
        if (window.kind !== 'bin-view') continue
        if (window.payload.binId !== binId) continue
        arrangementsMica.close(window.id)
      }
      deleteBin(binId)
      void saveArrangements()
    },
    [arrangementsMica, deleteBin, saveArrangements]
  )

  const arrangementsCommandContext = useMemo<ArrangementsCommandContext>(
    () =>
      createArrangementsCommandContext({
        selection: { materialKeys: [] },
        availableBinIds: bins.map((bin) => bin.id),
        availableSetIds: flattenedSetNodes.map((setNode) => setNode.id),
        availableBins: bins
          .filter((bin) => bin.kind === 'user')
          .map((bin) => ({ id: bin.id, name: bin.name })),
        availableSets: flattenedSetNodes,
        actions: {
          createBin: ({ position, name }) => createBinAtPoint(position, name),
          createBinAtViewportCenter: (name) => {
            const rect = desktopViewportRef.current?.getBoundingClientRect()
            if (!rect) return null

            return createBinAtViewportCenter(
              {
                width: rect.width,
                height: rect.height
              },
              name
            )
          },
          renameBin,
          deleteBin: handleDeleteBin,
          createRootSet,
          renameSet,
          deleteSet: async (setId) => {
            deleteSet(setId)
            await saveArrangements()
          }
        }
      }),
    [
      bins,
      createBinAtPoint,
      createBinAtViewportCenter,
      createRootSet,
      deleteSet,
      flattenedSetNodes,
      handleDeleteBin,
      renameBin,
      renameSet,
      saveArrangements
    ]
  )

  const openPalette = useCallback(
    (initialMode: PaletteCommandSession['initialMode'] = 'visual') => {
      setPaletteSession({
        context: arrangementsCommandContext,
        initialMode,
        source: 'palette'
      })
    },
    [arrangementsCommandContext]
  )

  const closePalette = useCallback(() => {
    setPaletteSession(null)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'x' &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        openPalette('meta')
        return
      }

      if (
        event.key === 'Tab' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        openPalette('visual')
        return
      }

      if (event.key === 'Escape' && paletteSession) {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        closePalette()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closePalette, openPalette, paletteSession])

  const handleOpenBin = useCallback(
    (binId: string) => {
      const existingWindow = arrangementsMica.windows.find((window) => window.kind === 'bin-view')
      if (existingWindow) {
        arrangementsMica.retarget(
          existingWindow.id,
          {
            kind: 'bin-view',
            payload: { binId }
          },
          {
            uiState: (current) => ({
              kind: 'bin-view',
              preferences: {
                viewMode:
                  current.kind === 'bin-view' ? current.preferences.viewMode : 'icon'
              },
              ephemeral: {
                searchQuery: '',
                selectedKeys: []
              }
            })
          }
        )
        return
      }

      arrangementsMica.open({
        kind: 'bin-view',
        payload: { binId },
        geometry: { ...DEFAULT_BIN_VIEW_GEOMETRY },
        uiState: createDefaultBinViewUiState()
      })
    },
    [arrangementsMica]
  )

  const handleCloseWindow = useCallback(
    (windowId: string) => {
      arrangementsMica.close(windowId)
    },
    [arrangementsMica]
  )

  return (
    <div className="arrangements-view">
      <header className="arrangements-view__topbar">
        <button type="button" className="arrangements-view__back" onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={1.8} />
          Back
        </button>
        <span className="arrangements-view__title">
          {workspaceName?.trim() ? (
            <>
              <span className="arrangements-view__title-workspace">{workspaceName.trim()}</span>
              <span className="arrangements-view__title-sep">/</span>
            </>
          ) : null}
          Arrangements
        </span>
        <div />
      </header>

      <div className="arrangements-view__body">
        {/* Sets Island — step 4 */}
        <aside className="arrangements-view__sets-island">
          <SetsIsland />
        </aside>

        {/* Desktop — step 3 */}
        <main ref={desktopViewportRef} className="arrangements-view__desktop">
          <MicaHost
            host={arrangementsMica}
            renderOverlay={() => <ArrangementsDragOverlay />}
            renderWindow={({ window }) => {
              switch (window.kind) {
                case 'bin-view':
                  return (
                    <BinView
                      windowId={window.id}
                      binId={window.payload.binId}
                      uiState={window.uiState}
                      onOpenBoard={onOpenBoard}
                      onOpenBin={handleOpenBin}
                      onClose={() => handleCloseWindow(window.id)}
                      onViewModeChange={(viewMode) =>
                        arrangementsMica.setWindowUiState(window.id, (current) => ({
                          ...current,
                          preferences: {
                            ...current.preferences,
                            viewMode
                          }
                        }))
                      }
                      onSearchQueryChange={(searchQuery) =>
                        arrangementsMica.setWindowUiState(window.id, (current) => ({
                          ...current,
                          ephemeral: {
                            ...current.ephemeral,
                            searchQuery
                          }
                        }))
                      }
                      onSelectedKeysChange={(selectedKeys) =>
                        arrangementsMica.setWindowUiState(window.id, (current) => ({
                          ...current,
                          ephemeral: {
                            ...current.ephemeral,
                            selectedKeys
                          }
                        }))
                      }
                    />
                  )
                default:
                  return null
              }
            }}
          >
            <ArrangementsDesktop overlay={<DesktopTrashBin onOpenBin={handleOpenBin} />}>
              <DesktopMaterialItems onOpenBoard={onOpenBoard} />
              <DesktopBinItems onOpenBin={handleOpenBin} onDeleteBin={handleDeleteBin} />
            </ArrangementsDesktop>

            {/* Bin View — temporary direct MicaWindow usage before full Mica host adoption */}
          </MicaHost>
          {paletteSession ? (
            <PetalPalette
              items={[]}
              onClose={closePalette}
              placeholder="Search Arrangements commands"
              commandSession={paletteSession}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
