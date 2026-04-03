# Deferred Work

Work that's not yet needed but it's worth keeping in mind.


## Task node kind

A first-class `kind: 'task'` node type, distinct from `leaf`. Gives agents a reliable way to find and reason about tasks on the board without inferring them from prose content. Minimal schema: status (`open` | `done` | `blocked`), assignee (optional username).


## Node authorship — `last_updated_by`

Add a `last_updated_by: string` field to `BoardNode`, set to the active username on every write. Defaults to `"anon"` if no username is configured. Keeps provenance lightweight (no full history, just last touch) while enabling agents to distinguish human edits from agent edits, and supporting git-style multi-user collaboration when a username is set.


## App settings — username and settings sidebar restructure

The settings modal sidebar should have two top-level sections: **Board** (name, brief — already implemented) and **App** (global preferences that apply across all boards).

The first App setting to implement is **username**: a string stored in app config (not in the board file), used to populate `last_updated_by` on node writes. No auth, no accounts — just a name so agents and collaborators can tell who touched what.


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
