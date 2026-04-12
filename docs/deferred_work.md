# Deferred Work

Work that's not yet needed but it's worth keeping in mind.


## Obsidian vault: double-click notification when not installed

When Obsidian is not installed and the user double-clicks the vault node, the handler currently returns silently. The indicator dot on the label communicates the state persistently, but a momentary feedback on the action would be better UX. Needs an in-app toast system (non-blocking, auto-dismissing) that doesn't exist yet. Alternatively, the Electron `Notification` API could fire a native OS notification from the main process with no new UI infrastructure.


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


## Alert node

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


## Files Window
Goal: introduce the second independent Mica window for workspace file import.

**Work Unit 7.1: Add `Files` command to canvas palette**
- Open an independent Mica window, not coupled to Materials.

**Work Unit 7.2: Build workspace-scoped filesystem browser**
- Scope to workspace root or the chosen root policy.
- Keep it intentionally lightweight.

**Work Unit 7.3: Drag file to canvas**
- Create node plus material record.

**Work Unit 7.4: Drag file to Materials**
- Import as material without placing on a board.

**Work Unit 7.5: Align imported file behavior with URL import behavior**
- Ensure both imported files and imported URLs become material records governed by the same arrangements model.
