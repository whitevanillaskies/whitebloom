import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useArrangementsStore } from '../../stores/arrangements'
import { useWorkspaceStore } from '../../stores/workspace'
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

export default function ArrangementsView({
  workspaceName,
  onBack,
  onOpenBoard
}: ArrangementsViewProps): React.JSX.Element {
  const isHydrated = useArrangementsStore((s) => s.isHydrated)
  const loadArrangements = useArrangementsStore((s) => s.loadArrangements)
  const workspaceRoot = useWorkspaceStore((s) => s.root)

  useEffect(() => {
    if (!workspaceRoot || isHydrated) return
    void loadArrangements()
  }, [workspaceRoot, isHydrated, loadArrangements])

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
          <ArrangementsDesktop overlay={<DesktopTrashBin />}>
            <DesktopMaterialItems onOpenBoard={onOpenBoard} />
            <DesktopBinItems />
          </ArrangementsDesktop>

          {/* Bin View — temporary direct MicaWindow usage before full Mica host adoption */}
          <BinView onOpenBoard={onOpenBoard} />
        </main>
      </div>
    </div>
  )
}
