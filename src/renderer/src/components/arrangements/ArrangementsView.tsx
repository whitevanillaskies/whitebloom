import { useCallback, useEffect, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
import { MicaHost, useMicaHost } from '../../mica'
import ArrangementsDesktop from './ArrangementsDesktop'
import BinView from './BinView'
import DesktopBinItems, { DesktopTrashBin } from './DesktopBinItems'
import DesktopMaterialItems from './DesktopMaterialItems'
import SetsIsland from './SetsIsland'
import './ArrangementsView.css'

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
  viewMode: 'icon' | 'list'
  searchQuery: string
  selectedKeys: string[]
}

const ARRANGEMENTS_MICA_HOST_ID = 'arrangements-desktop'

const DEFAULT_BIN_VIEW_GEOMETRY = {
  x: 28,
  y: 48,
  width: 460,
  height: 380,
  minWidth: 380,
  minHeight: 300
} as const

function createDefaultBinViewUiState(): ArrangementsWindowUiState {
  return {
    kind: 'bin-view',
    viewMode: 'icon',
    searchQuery: '',
    selectedKeys: []
  }
}

export default function ArrangementsView({
  workspaceName,
  onBack,
  onOpenBoard
}: ArrangementsViewProps): React.JSX.Element {
  const isHydrated = useArrangementsStore((s) => s.isHydrated)
  const loadArrangements = useArrangementsStore((s) => s.loadArrangements)
  const workspaceRoot = useWorkspaceStore((s) => s.root)
  const arrangementsMicaPolicy = useMemo(
    () => ({
      hostId: ARRANGEMENTS_MICA_HOST_ID,
      placementMode: 'screen-space' as const,
      windowLimit: 'single' as const,
      allowedKinds: ['bin-view'] as const
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
              viewMode: current.kind === 'bin-view' ? current.viewMode : 'icon',
              searchQuery: '',
              selectedKeys: []
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
        <main className="arrangements-view__desktop">
          <MicaHost
            host={arrangementsMica}
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
                          viewMode
                        }))
                      }
                      onSearchQueryChange={(searchQuery) =>
                        arrangementsMica.setWindowUiState(window.id, (current) => ({
                          ...current,
                          searchQuery
                        }))
                      }
                      onSelectedKeysChange={(selectedKeys) =>
                        arrangementsMica.setWindowUiState(window.id, (current) => ({
                          ...current,
                          selectedKeys
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
              <DesktopBinItems onOpenBin={handleOpenBin} />
            </ArrangementsDesktop>

          {/* Bin View — temporary direct MicaWindow usage before full Mica host adoption */}
          </MicaHost>
        </main>
      </div>
    </div>
  )
}
