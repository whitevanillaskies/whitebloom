import './StartScreen.css'

type StartScreenProps = {
  busy: boolean
  errorMessage: string | null
  onOpenWorkspace: () => void
  onCreateWorkspace: () => void
  onCreateQuickboard: () => void
}

export default function StartScreen({
  busy,
  errorMessage,
  onOpenWorkspace,
  onCreateWorkspace,
  onCreateQuickboard
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <div className="start-screen__backdrop" aria-hidden="true" />
      <section className="start-screen__hero">
        <p className="start-screen__eyebrow">Whitebloom workspace</p>
        <h1 className="start-screen__title">Open a workspace, or start small.</h1>
        <p className="start-screen__body">
          Workspaces hold boards, context, and local resources. Quickboards stay as single files when
          you just need a fast scratch surface.
        </p>
      </section>

      <section className="start-screen__actions" aria-label="Startup actions">
        <button
          type="button"
          className="start-screen__action start-screen__action--primary"
          onClick={onOpenWorkspace}
          disabled={busy}
        >
          <span className="start-screen__action-title">Open workspace or board</span>
          <span className="start-screen__action-copy">
            Open a `.wbconfig`, a workspace board, or a standalone quickboard.
          </span>
        </button>

        <button
          type="button"
          className="start-screen__action"
          onClick={onCreateWorkspace}
          disabled={busy}
        >
          <span className="start-screen__action-title">Create workspace</span>
          <span className="start-screen__action-copy">
            Pick a folder and scaffold a fresh workspace with a `.wbconfig`.
          </span>
        </button>

        <button
          type="button"
          className="start-screen__action"
          onClick={onCreateQuickboard}
          disabled={busy}
        >
          <span className="start-screen__action-title">New quickboard</span>
          <span className="start-screen__action-copy">
            Create a single `.wb.json` with no workspace around it.
          </span>
        </button>
      </section>

      {errorMessage ? <p className="start-screen__error">{errorMessage}</p> : null}
    </main>
  )
}