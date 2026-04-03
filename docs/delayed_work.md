# Deferred Work

Work that's not yet needed but it's worth keeping in mind.


## Task node kind

A first-class `kind: 'task'` node type, distinct from `leaf`. Gives agents a reliable way to find and reason about tasks on the board without inferring them from prose content. Minimal schema: status (`open` | `done` | `blocked`), assignee (optional username).


## Authorship follow-up

Node authorship and the app-level username are now implemented via `createdBy` / `updatedBy` on `BoardNode` and a global username setting stored outside the board file. Future work here is no longer the existence of authorship, but expanding it carefully: richer user profiles, explicit human-vs-agent write source, or eventual history if the spec needs more than last-write provenance.


## Momo UI proof of concept

Momo (from peach, to keep the botanical naming) should be a set of reusable UI elements that different modules using this system could reuse.

Maybe taking the current confirm new document dialogue and have a Momo Modal. I think we could extract this into a common shared component

```
      {pendingDocumentAction ? (
        <div className="canvas-modal__overlay" role="presentation" onClick={handleCancelDocumentAction}>
          <div
            className="canvas-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="canvas-modal__title">{confirmDialogTitle}</h2>
            <p className="canvas-modal__body">{confirmDialogBody}</p>
            <div className="canvas-modal__actions">
              <button type="button" className="canvas-modal__button" onClick={handleCancelDocumentAction}>
                Cancel
              </button>
              <button
                type="button"
                className="canvas-modal__button canvas-modal__button--danger"
                onClick={handleConfirmDocumentAction}
              >
                {confirmDialogConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
```
