import { ArrowLeft } from 'lucide-react'
import './ArrangementsView.css'

type ArrangementsViewProps = {
  workspaceName?: string
  onBack: () => void
}

export default function ArrangementsView({
  workspaceName,
  onBack
}: ArrangementsViewProps): React.JSX.Element {
  return (
    <main className="arrangements-view">
      <header className="arrangements-view__topbar">
        <button type="button" className="arrangements-view__back" onClick={onBack}>
          <ArrowLeft size={14} strokeWidth={1.8} />
          Back
        </button>
        <h1 className="arrangements-view__title">Arrangements</h1>
        <div />
      </header>

      <section className="arrangements-view__content" aria-label="Arrangements">
        <div className="arrangements-view__panel">
          <p className="arrangements-view__eyebrow">
            {workspaceName?.trim() || 'Workspace desktop'}
          </p>
          <h2 className="arrangements-view__heading">Arrangements is now a top-level app view</h2>
          <p className="arrangements-view__body">
            This placeholder establishes Arrangements as a peer surface to the board and workspace
            home views. The desktop, Sets Island, and material management UI can now be built into
            this branch without treating it like a modal or canvas overlay.
          </p>
        </div>
      </section>
    </main>
  )
}
