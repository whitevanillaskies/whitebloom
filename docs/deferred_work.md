# Deferred Work

Work that's not yet needed but it's worth keeping in mind.


## Workspace crates (`.wbcrate`)

A portable, single-file format for sharing a complete workspace without requiring git or a hosting service. A `.wbcrate` is a zip archive of the workspace root, renamed.

**Export.** Zip the workspace directory — `.wbconfig`, all `*.wb.json` boards, `blossoms/`, `res/` — into a single `.wbcrate` file. Exclude generated content that can be reconstructed: `res/.thumbs/` and `res/.inbox-snapshots/`. Pending inbox files (`*.inbox.json`) should be included by default so the recipient sees any unreviewed agent proposals.

**Import.** Unzip into a user-selected target directory. The result is a normal workspace, openable via `.wbconfig`. No special runtime handling — just files on disk.

**"Use without unpacking" is a non-starter for Whitebloom.** File watchers, native app opens (`shell.openPath`), and agent filesystem access all require real files at real paths. A virtual filesystem layer would buy nothing except complexity. Always unpack on import.

**Implementation notes.** Node's built-in `zlib` handles zip at the stream level; for a friendlier API, `archiver` (write) and `unzipper` or `adm-zip` (read) are the standard Electron-compatible choices. The export dialog should let the user pick destination and filename. Import should warn if the target directory is non-empty.


## File handling: import vs link, handler resolution, unknown type dialog

A unified system for how any file enters the board — whether dropped from the OS, referenced by a module, or of an unknown type.

### Handler resolution chain

When a file is dropped onto the canvas (or a node's type is evaluated), resolution walks:

1. Exact type match (`markdown:screenplay`) → use that module
2. Base type fallback (`markdown`) → use that module, ignore subtype
3. No handler at all → show the unknown type dialog

This chain covers the `markdown:subtype` convention automatically. A generic markdown module handles any `markdown:*` file; a specialized screenplay module handles only `markdown:screenplay`. Unknown is not broken.

### Import vs link

Every module exposes an **Import / Link** setting, per type, in the settings panel. The distinction:

- **Import** — file is copied into the workspace (`res/` for external assets, `blossoms/` for internal ones). `resource` is a `wloc:` URI (e.g. `wloc:res/photo.jpg`). Safe for agents, safe against moves.
- **Link** — file stays on disk at its current location. `resource` is a `file:///absolute/path` URI. The spec treats any `file:///` URI in `resource` as a linked (non-copied) asset — no schema flag needed. The app warns: *"Linked files may not be readable by LLMs. If the file moves or is renamed, the node will break."*

Import is the default for all modules. Link exists for assets too heavy to copy, or assets that need to stay where they are (project files, shared team resources, .blend files).

**Import to Local** is a right-click action (deferred): copies the linked file to `res/`, rewrites `resource` from the `file:///` URI to a `wloc:res/filename` URI. The only mutation that changes a `resource` URI without changing node content.

### Unknown type dialog

When resolution finds no handler, a dialog appears:

> **No handler found for this file type.**
> You can link it or import it — the default action will be opening the file with your OS's native app.
>
> [Cancel] [Link] [Import]
>
> *You can disable this message by selecting a default action in Settings.*

This is the entry point for arbitrary-doc nodes — files whitebloom has no module for (.blend, .psd, unknown formats). The node shows a generic file icon on the canvas, is never read by agents, and double-clicks open the OS default app. The only value the node adds is spatial placement, grouping, and edges.

The dialog's "default action" setting (per file extension) also drives the per-module import/link default: if a user sets "always link for .blend," the dialog is skipped for .blend files entirely.

A native, canvas-level `kind: "leaf"`, `type: "alert"` node. No module, no external resource — all data is inline. Fields: `label`, `deadline` (ISO timestamp), `description`, and optional `remindBefore` (integer days before deadline).

When `remindBefore` is set, the app writes a notification item to the inbox at `deadline - remindBefore` days. The inbox is generalized from the current agent-proposal-only `<board-stem>.inbox.json` to a multi-type queue using a `type` discriminator (`"agent-proposal"` | `"alert"` | ...). Alert inbox items carry a `nodeId` and `boardPath` so a future cross-board notification panel can link back to the source node.

Double-clicking an inbox alert notification frames (zooms to and highlights) the alert node on the canvas. Double-clicking the alert node on the canvas opens its expanded detail card — not a full bloom, just the leaf expanded view.

Reminder fires once and persists in the inbox as `status: "unread"` until the user dismisses it. A `deadline`-only alert (no `remindBefore`) is a valid calendar marker with no notification behavior. `remindBefore` without `deadline` is invalid.

Open question before implementing: whether the inbox lives at board level (`<board-stem>.inbox.json`, keeps workspaces self-contained) or app level (single `~/.whitebloom/inbox.json`, enables unified cross-board notifications). The `boardPath` field on alert items is designed to support either model.

Alert nodes connect to other nodes via edges when edges are implemented. The alert carries the *when*, the edge carries the relationship, the target node carries the *what*.


## Task node kind

A first-class `kind: 'task'` node type, distinct from `leaf`. Gives agents a reliable way to find and reason about tasks on the board without inferring them from prose content. Minimal schema: status (`open` | `done` | `blocked`), assignee (optional username).


## Authorship follow-up

Node authorship and the app-level username are now implemented via `createdBy` / `updatedBy` on `BoardNode` and a global username setting stored outside the board file. Future work here is no longer the existence of authorship, but expanding it carefully: richer user profiles, explicit human-vs-agent write source, or eventual history if the spec needs more than last-write provenance.


## Export as JSON Canvas

One-way export of a board to the [JSON Canvas](https://jsoncanvas.org/) open format (`.canvas`). JSON Canvas is a renderer-agnostic infinite-canvas format used by Obsidian and others. Whitebloom is a strict superset, so export is lossless in the JSON Canvas direction; round-tripping back is not guaranteed and no import is needed.

**Mapping:**
- Leaf nodes with `content` → `text` node
- Bud nodes with an image `resource` → `file` node
- Other bud nodes → `file` node (resource path as `file`)
- Nodes with no resource and no content → `text` node with empty content
- Edge `from/to` → `fromNode/toNode`; `label` preserved

**What is lost on export:** `kind`, module `type`, provenance fields (`createdBy`, `updatedAt`, etc.), board `name`/`brief`/`version`, the agent inbox, and all shell/lens metadata. Export should be clearly labeled as lossy in the UI.

**What JSON Canvas has that WB does not (consider adding independently):** `color` on nodes and edges, `fromSide/toSide` connection-point positioning, `fromEnd/toEnd` arrow styling, a `link` node type (URL-as-node), and a `group` node type.

Surface as `File > Export > JSON Canvas (.canvas)`. The implementation is a single pure function — walk nodes, map types, write the file.


## Groups as filesystem directories

Groups on the board map to subdirectories inside `blossoms/`. A node in the "concept-maps" group has `resource: "wloc:blossoms/concept-maps/schema.json"`. The directory IS the group — no separate group record in the board manifest is needed for buds.

The unresolved tension: leaf nodes have no `resource` and no file on disk. They can't live in a directory. Resolution options:

- **Accept the asymmetry** — only buds can belong to groups; leaves always sit at board root. Leaves are lightweight inline elements; grouping them is less critical.
- **Add a `folder` field to leaves** — explicit group membership for inline nodes, not derived from the filesystem.

The board manifest remains authoritative for group membership in both cases. The filesystem directory is a *consequence* of group membership for buds, not the definition. This means the module system can derive group membership from `resource` paths without a new schema field.

Namespacing via intermediate directories (`/blossoms/db_schema/the_asset.json`) is a natural extension — multi-level groups are just nested directories.

A "folder node" on the canvas represents a directory. Clicking it zooms into its contents. This is a spatial tree view, not a separate node type — the node is just a group header leaf that happens to share its position with the group's bounding box.


## Agent-off-limits flag

An optional `ignoreAgents: true` field on any node. When set, agents skip the node during reads and never include it in proposals. This is a social signal, not a lock — it does not prevent direct filesystem access. The intent is "this is my scratchpad / live TODO / personal note, don't touch it."

Fits naturally alongside `createdBy`/`updatedBy` as lightweight per-node metadata. No enforcement machinery needed at v1 — the flag is a convention that compliant agents respect.

Agents should log a skip notice rather than silently ignoring flagged nodes, so the user can verify the flag is being honored.


## `<board-stem>.questions.json`

An async clarification channel, parallel to `<board-stem>.inbox.json` but directionally reversed. An agent reads a node, encounters genuine ambiguity, and writes a question rather than guessing or staying silent.

```json
{
  "version": 1,
  "questions": [
    {
      "id": "q-1",
      "agent": "claude",
      "timestamp": "2026-04-03T10:00:00Z",
      "nodeId": "node-3",
      "question": "The brief says 'targeting teens' but the schema has a minimum_age column set to 21. Should I treat the schema as authoritative or the brief?",
      "status": "unanswered"
    }
  ]
}
```

The app surfaces unanswered questions in the same inbox review flow, visually distinct from proposals (different color, question mark icon). The user answers in plain text via the UI; the answer is written back to the same record as `answer` + `answeredAt`. The agent reads the answer on its next pass.

This keeps the board clean (no provisional answer nodes cluttering the canvas) and keeps the workflow async (agent doesn't block, user answers when ready). A question with no answer after N days could surface as a board health note.

`status` values: `"unanswered"` | `"answered"` | `"dismissed"`.


## Project-level user lens discovery

Module lenses are discoverable via `module_agents.md`. User-authored lenses — custom perspectives that don't belong to any module — have no canonical home in the current spec.

Proposal: a `lenses/` directory at the workspace root (sibling to `.wbconfig`), with a `lenses/manifest.json` listing available lenses by name, path, and which asset types they apply to. Agents scan the manifest once on startup.

```
my-project/
  .wbconfig
  research.wb.json
  lenses/
    manifest.json        # [{name, path, types, description}]
    security-audit.lens.json
    house-style.lens.json
```

A `types: ["*"]` entry applies the lens to all assets. A `types: ["markdown"]` entry restricts it to markdown assets. This makes custom lenses first-class without requiring a full module package.


## Inbox command: add-edge and update-board

Two command types missing from the inbox schema:

**`add-edge`** — agents can already propose new nodes; they should be able to propose new connections. The visual treatment already specifies dashed colored lines for proposed edges, and approve/deny buttons at the midpoint. The command type just needs to be formally defined.

```json
{ "type": "add-edge", "edge": { "id": "edge-5", "from": "node-1", "to": "node-3", "label": "elaborates" } }
```

**`update-board`** — agents should be able to propose updates to board-level fields, primarily `brief`. A board's purpose evolves as content is added; an agent that has read all nodes may notice the brief is stale and propose a revision. Same approve/deny flow, diff window shows before/after brief text.

```json
{ "type": "update-board", "before": { "brief": "..." }, "after": { "brief": "..." } }
```


## Spatial clustering metadata

A computed field `clusters` at the board level, populated on save (or as a background job). Two types, both optional, both additive — they never modify node data:

**Spatial clusters** — deterministic, no agent required. Group nodes whose bounding boxes are within a threshold distance. Cheap to compute, useful for navigation and minimap rendering.

**Agentic clusters** — an agent reads the board and proposes semantic groupings via the inbox. Each cluster carries a `rationale` field. Proposed agentic clusters go through the inbox like any other proposal and are committed only on approval.

```json
{
  "clusters": {
    "spatial": [["node-1", "node-2", "node-3"], ["node-7", "node-8"]],
    "agentic": [
      { "nodes": ["node-1", "node-4", "node-9"], "rationale": "All three discuss the blooming system from different angles", "proposedAt": "...", "proposedBy": "claude" }
    ]
  }
}
```

Agentic clusters are optional and require an explicit agent pass. Spatial clusters can run locally with no external dependencies. The two are kept separate in the schema so consumers can use either or both.


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
