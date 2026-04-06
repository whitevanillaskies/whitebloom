# Deferred Work

Work that's not yet needed but it's worth keeping in mind.


## Arrangements: workspace resource manager

A first-class UI for managing all workspace resources — a logical asset library that lives above the physical `res/` and `blossoms/` directories, inspired by Aperture's Projects + Albums model and DaVinci Resolve's Media Pool.

**Motivation.** Currently, a resource's lifecycle is tied entirely to its node. Deleting a node leaks its backing file; there is no way to share a resource across multiple boards; and `file:///`-linked resources are indistinguishable from workspace-owned ones in any UI. As Whitebloom becomes a knowledge management environment, resources need to be workspace-level citizens with their own organizational home.

**Precedents.** Apple Aperture (2005–2014) is the closest model: photos lived in *Projects* (exclusive ownership, flat list) and could be organized into *Albums* (non-exclusive, hierarchical). This two-tier model cleanly separated "where does this asset belong" from "how do I view it right now." DaVinci Resolve's Media Pool uses the same idea, backed by a PostgreSQL/SQLite database rather than files. Scrivener's Binder is a third precedent: a logical tree over an opaque flat package, where users never see or care about the on-disk structure.

### Two organizational concepts

**Bins** — exclusive, flat. A resource belongs to exactly one bin. Bins answer "what *is* this fundamentally." They are categorical, not contextual. A resource's bin assignment is the user's decision and the system never overrides it. Bins have no nesting.

**Sets** — non-exclusive, hierarchical. A resource can appear in any number of sets. Sets answer "what *context* does this belong to right now." Sets can nest arbitrarily deep. Sets come in two kinds:

- *Manual sets* — user-curated. The user drags resources into them. An Arrangement Set is the full qualified term (seen in UI: the Arrangements view, containing Sets).
- *Smart sets* — computed at read time by scanning board files. Never stored with membership lists; membership is derived, not recorded. The system populates them automatically but never uses them to reclassify or move anything.

**The core invariant:** the system layer (smart sets, stale detection) is always advisory and read-only. It observes but never reclassifies. A resource the user has placed in an "Images" bin stays in "Images" forever, regardless of whether it is referenced by zero boards.

### System bins (built-in, read-only)

- **Unclassified** — the import default. Any resource that enters the workspace without an explicit bin assignment lands here. This includes all drops onto the whiteboard canvas. The user promotes resources out of Unclassified by dragging them into a named bin in the Arrangements view.
- **Trash** — soft delete. Resources are moved here only by an explicit user action inside Arrangements (right-click → Move to Trash, or drag). Deleting a node on a whiteboard does *not* move its resource to Trash — the resource stays in its bin and may become Stale. Trash is emptied explicitly (permanently deletes files from disk).

### System smart sets (built-in, computed)

- **Stale** — resources not referenced by any `*.wb.json` in the workspace. Computed by scanning all board files. A resource in the Stale set has zero node references but retains its bin assignment. This is the discovery mechanism for cleanup candidates; the user decides whether to trash, reassign, or leave them.
- **Linked** — resources whose backing URI is `file:///` (external links, not workspace-owned). These are assets the user chose to link rather than import. The Linked set is the natural home for the "Import to Local" action (copies the file into `res/`, rewrites the node's `resource` from `file:///` to `wloc:`).

Additional smart sets can be added without schema changes: "Recently Added," "Referenced by Open Board," etc. Smart set definitions are pure functions over the resource list and board files.

### Physical storage

The `res/` and `blossoms/` directories remain as-is on disk. The split (`res/` for externally-originated assets, `blossoms/` for internally-authored ones) stays meaningful for agent traversal and filesystem legibility. It is invisible to the user in the Arrangements UI — the user sees bins and sets, not directories.

Files within each directory are stored flat (no subdirectories). Filenames are content-addressed or UUID-based — an implementation detail the user never sees. Filesystem organization is fully delegated to the app.

### `blossoms-garden.json`

A new workspace-level file at the workspace root (sibling to `.wbconfig`). It stores bins, sets, and resource metadata. Smart sets are not stored here — they are computed on demand.

```json
{
  "version": 1,
  "bins": [
    { "id": "sys:unclassified", "name": "Unclassified", "system": true },
    { "id": "sys:trash",        "name": "Trash",         "system": true },
    { "id": "uuid-a",           "name": "Images",        "system": false },
    { "id": "uuid-b",           "name": "Data",          "system": false }
  ],
  "sets": [
    { "id": "uuid-c", "name": "Project Alpha", "parent": null },
    { "id": "uuid-d", "name": "References",    "parent": "uuid-c" }
  ],
  "resources": [
    {
      "id": "uuid-r1",
      "file": "res/abc123.png",
      "name": "diagram.png",
      "bin": "uuid-a",
      "sets": ["uuid-d"]
    },
    {
      "id": "uuid-r2",
      "file": "blossoms/def456.md",
      "name": "research notes",
      "bin": "sys:unclassified",
      "sets": []
    }
  ]
}
```

Nodes in `.wb.json` continue to reference resources by `wloc:` URI. The `blossoms-garden.json` `resource.id` and `resource.file` are the bridge between the logical garden and the physical file. Stale detection is a join: resources in the garden whose `file` value does not appear in any `resource` field across all board files.

### Import flow

1. User drops a file onto the canvas → file is copied into `res/` (import) or kept in place (link) → a node is created referencing `wloc:res/<hash>.ext` or `file:///…` → resource record is written to `blossoms-garden.json` with `bin: "sys:unclassified"`.
2. User opens Arrangements later, sees the resource in Unclassified, drags it to the "Images" bin → `bin` field updated in `blossoms-garden.json`. Nothing on disk moves.
3. User deletes the node from the canvas → resource record stays in `blossoms-garden.json`, bin assignment unchanged → resource now appears in the Stale smart set.
4. User opens Arrangements, sees resource in Stale, drags it to Trash → `bin` updated to `sys:trash`.
5. User empties Trash → file deleted from disk, record removed from `blossoms-garden.json`.

### Quickboards

Quickboards have no workspace and no `blossoms-garden.json`. Resources in a quickboard are either embedded (`wbhost:`) or linked (`file:///`). The Arrangements view is unavailable for quickboards. On promotion to a workspace, `wbhost:` resources are extracted to `res/`, written into a fresh `blossoms-garden.json` as Unclassified, and `resource` URIs are rewritten to `wloc:`.


## `wbhost:` inline asset URIs

A URI scheme for embedding binary assets directly inside the board JSON, intended primarily
for quickboards where no workspace `res/` directory exists.

**Motivation.** Drops from a web browser produce no filesystem path — only a remote URL or
blob data. Storing a remote URL as `resource` is fragile (servers can refuse, go down, or
require auth). For quickboards, copying to a local path is also unavailable. The current
workaround (error toast, tell the user to save locally first) is acceptable for v1, but a
proper solution should let quickboards carry self-contained assets.

**Scheme.** `wbhost:<id>` points to a record in a top-level `hosted` map on the board JSON:

```json
{
  "hosted": {
    "img-1": { "mime": "image/png", "encoding": "base64", "data": "iVBORw0KGgo..." }
  },
  "nodes": [
    { "id": "node-1", "resource": "wbhost:img-1", ... }
  ]
}
```

The renderer resolves `wbhost:` by reading from the in-memory board JSON directly — no IPC,
no protocol handler needed. The URI resolver throws for `wbhost:` URIs in workspace context
(they should have been promoted already).

**Promotion on workspace conversion.** When a quickboard is promoted to a workspace, the
promotion flow iterates `hosted`, writes each entry to `res/` as a real file, and rewrites
the corresponding `resource` fields from `wbhost:<id>` to `wloc:res/<id>.<ext>`. The
`hosted` map is then removed from the board JSON. This is the only mutation that touches
`wbhost:` URIs.

**Scope.** Applies to any dropped asset on a quickboard — browser drag (blob from
`dataTransfer.items`), or a local file the user prefers to embed rather than link. Import
vs. link (see below) would control whether a local file drop produces `file:///` or
`wbhost:` on a quickboard; default would be embed (`wbhost:`).

**Size concern.** Large images bloat the board JSON. A reasonable cap (e.g. 5 MB per asset,
configurable) should be enforced at drop time, with a clear error if exceeded. Above the cap,
fall back to the current error toast and tell the user to save locally. Max size should be
configurable as an app-level setting.

**`wbapp:` global resource cache.** The `wbapp:` URI scheme and the app store directory
(`userData/`) are established in Phase 2 as the backing store for transient quickboards.
The `wbapp:res/` subdirectory is reserved but not yet populated. Once populated, `wbapp:`
can back a global asset cache: resources downloaded or embedded at the app level rather
than the workspace level. A quickboard could reference `wbapp:res/img-abc.png` instead of
embedding via `wbhost:`. Going from `wbhost:` to `wbapp:` and vice versa is trivial — both
are local to the machine. A user may select "export as standalone" to embed all referenced
assets (both `wbapp:` and `wloc:`) into the board file as `wbhost:` entries. This would
work for workspaces as well.


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


## Recent boards on the start screen

A "recently opened" list on the start screen, similar to Photoshop's recent documents.

**Storage.** A new `userData/recent-boards.json` file (separate from `settings.json` to avoid the renderer overwriting it on settings save). Each entry is `{ path: string, openedAt: string }`. Capped at 15 entries, deduplicated by path — reopening a board moves it to the front.

**Recording.** The `board:open` IPC handler (main process) appends to the list on every successful open. This covers workspace boards, standalone `.wb.json` files, and promoted quickboards equally. Transient quickboards are intentionally excluded — they already appear as "Unsaved quickboards."

**IPC.** A new `app:list-recent-boards` handler returns the list. Renderer calls it alongside `app:list-transient-boards` when landing on the start screen.

**UI.** A "Recent boards" section in the start screen main area, above the existing "Unsaved quickboards" section. Each tile shows the board name (from filename), the containing directory, and a relative time ("2 days ago"). Clicking a tile calls the same `openBoardByPath` path as the transient board tiles — error handling if the file has moved or been deleted is already in place.

**Key files to touch:** `src/main/services/recent-boards-store.ts` (new), `src/main/ipc/register-board-ipc.ts`, `src/main/ipc/register-app-ipc.ts`, `src/preload/index.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/start-screen/StartScreen.tsx`.


## Leaf modules (third-party canvas widgets)

Allow the module system to target leaf nodes, not just buds. A leaf module is a self-contained canvas widget with no backing file — a clock, a weather display, a countdown timer, a live feed. Whitebloom wouldn't ship these, but third parties should be able to.

**Schema change (minimal).** The `type` field on a leaf currently holds a built-in string (`"text"`). Widen it to also accept a module ID (e.g. `"com.example.clock"`), the same pattern buds already use. No new `kind` value needed.

**State storage.** The `content` field on the leaf stores the module's inline state as JSON — config, cached data, whatever the module needs. This is already part of the leaf schema; no new field required.

**Module registration differences from bud modules:**
- No `extensions` — leaf modules are not file-backed
- No `recognizes` — never claimed on drag-and-drop
- No `defaultRenderer` — no bloom action
- `createDefault()` — returns the initial `content` blob (required)
- A marker (`leaf: true` or similar) to distinguish from bud modules during registration

**Renderer contract difference.** Leaf modules render directly on the canvas at all times (not just as a thumbnail with a bloom action). The Layer 3 binding spec needs a canvas renderer contract for leaf modules, distinct from the bud editor contract. This is a Layer 3 concern only — HEP and CoreData are unaffected.

**Unknown/error semantics.** Unknown leaf module types fall under the existing "unknown is not broken" rule — they render as a generic placeholder. Same as unknown bud types.

**What does not change.** CoreData schema, HEP, the board file format (aside from widening the `type` field description), and all existing bud module behavior.
