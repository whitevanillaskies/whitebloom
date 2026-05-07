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

# Old current work


---

## Keyboard Ownership

### Problem

Multiple subsystems want to handle the same keys. Lexical handles Ctrl+Z, Backspace, arrows, and Ctrl+A inside a focused text node. Our canvas history system wants Ctrl+Z. A future code editor or PDF annotation surface would have the same claim. Without a clear ownership model, these collide.

The naive fix — guard every affected command with `!inputSurfaceActive` on `enabledWhen` — is wrong. If a keystroke has already reached our command resolution path while Lexical is focused, the collision has already happened architecturally. Command availability is the wrong layer to catch it. Every new embedded surface would require auditing every conflicting binding again.

### Model

Shortcuts fall into three priority tiers, resolved in order:

- **Global** — always get first claim, regardless of focused surface. This list should be very short. Candidates: Escape (as a context unwinder, not a single command), and perhaps one explicitly cross-surface palette shortcut if the product demands it. The bar for adding something here should be high.

- **Owner-local** — belong to the currently focused embedded surface. When a Lexical editor is focused, Ctrl+Z, Backspace, arrows, Ctrl+A, Ctrl+C/V/X, and Tab belong to it. The keybinding dispatcher yields these before considering canvas bindings. When a future code editor is focused, the same tier applies.

- **Mode-scoped** — canvas, PDF, Org, and other mode bindings that fire when no embedded surface has claimed the key. This is where `history.undo`, `selection.delete`, `selection.select-all`, node movement, and similar live.

### Keybinding Dispatcher is the Primary Gate

The dispatcher checks keyboard ownership before resolving any command. It does not route a key into command resolution and then rely on `enabledWhen` to say no. That means `history.undo` and `selection.delete` do not need `!inputSurfaceActive` guards — the dispatcher never reaches them while a text surface is focused.

`enabledWhen` on commands is for palette presentation and semantic availability, not collision prevention.

### Source of Truth: `focusedInputSurface` on the Canvas Snapshot

The canvas `subjectSnapshot` should include a `focusedInputSurface` facet: `'none' | 'text-editor' | 'code-editor' | 'pdf-annotator' | ...`. This is a local semantic fact about the canvas mode, in the same way that active tool or selection shape are. When a Lexical text node is being edited, the canvas snapshot reflects that.

The keybinding dispatcher consults this facet (or the underlying focus state it derives from) to determine the current keyboard owner. The command and palette layers consume the same snapshot for availability and presentation. One source of truth, two consumers.

`keyboardFocusOwner` and `subjectSnapshot` are related but not the same concept. A focused Lexical editor inside canvas should own the keyboard even though the major mode is still canvas. The snapshot captures the local subject; the dispatcher uses it to arbitrate key ownership.

### Short and Medium Term

**Short term** — at the keybinding dispatcher, check `document.activeElement?.closest('input, textarea, [contenteditable]')`. If a match is found, suppress mode-scoped bindings that conflict with text editing. This correctly covers Lexical today without any cooperation from Lexical and without Lexical-specific knowledge in the dispatcher.

**Medium term** — replace the DOM heuristic with a focused-surface registry. Embedded surfaces register and deregister themselves (on mount/unmount and focus/blur) with a central owner registry. The dispatcher consults the registry instead of the DOM. This generalises to non-contenteditable surfaces (a canvas ink tool that claims arrow keys, a future code editor that wants Tab) without changing any call sites.

### Escape as a Context Unwinder

Escape is global — it always gets first claim. But its behavior is context-dependent: it should unwind the deepest active context one level at a time rather than mapping to a single command.

Unwinding order (innermost first):
1. Exit focused embedded editor (blur Lexical, deactivate inline input)
2. Dismiss active modal or overlay
3. Deactivate active tool, return to pointer
4. Collapse selection
5. Return to default mode state

This is a stack of dismissal handlers, not a keybinding to a single action. Each context that can be "escaped" registers a dismissal handler; Escape pops the top one. The canvas, each embedded surface, and each modal layer all participate.

### Relationship to Other Work

This model is a prerequisite for the Commands Refactoring and Undo/Redo work to behave correctly with embedded editors. The `focusedInputSurface` facet should be part of the canvas `subjectSnapshot` contract defined during the Commands Refactoring. The keybinding dispatcher guard should be in place before `history.undo` is wired to Ctrl+Z.

---

## Commands Refactoring

### Problem

The current command architecture is close to supporting contextual commands, but the organizing concept is wrong.

`runtime context` should not be the primary axis anymore. It is effectively a weaker, less meaningful stand-in for major mode, and some of its values are vestigial. `arrangements` in particular should not drive the future design.

What we actually need is a command system that answers three separate questions:

1. Does this command belong in the current mode's vocabulary?
2. Is this command enabled for the current semantic subject?
3. Can the command still safely run when invoked right now?

Today those ideas are muddled together. The result is that commands can only be contextual if the current context object happens to expose the right facts, and major mode participation is not truly first-class.

### Target Model

Commands should be organized around these concepts:

- `modeScope`: the major mode or set of major modes where a command belongs.
- `subjectSnapshot`: a semantic snapshot published by the active surface/editor.
- `enabledWhen`: an optional predicate over the snapshot. If omitted, the command is always enabled within its `modeScope`.
- `run`: the command implementation, which must revalidate before acting.

This is intentionally more precise than the current runtime-context model.

`modeScope` controls discoverability. It answers whether a command should be surfaced at all in the current mode.

`subjectSnapshot` controls contextuality. It answers whether there is a meaningful subject right now. Commands should inspect semantic facts, not raw editor internals.

`enabledWhen` controls present-time availability. Some commands are only valid in certain snapshots. Others are always available. For example, a `tool.select-text` command can always be available in canvas-related modes because invoking it simply switches the active tool to text.

`run` revalidates because the snapshot may have changed between browse time and execution time.

### Subject Snapshot

The snapshot should be semantic and read-only. It should not be a giant bag of optional fields.

Each host should publish a normalized snapshot appropriate to its mode:

- Canvas:
  - current selection shape: none, single node, multiple nodes, edge selection, etc.
  - focused or primary node summary
  - selected module identity
  - active bloom if relevant
  - active tool
- PDF:
  - active PDF document
  - file/resource identity
  - page count
  - current page or current page selection if relevant
- Org:
  - element at point
  - enclosing entry at point
  - TODO state if present
  - clockability or other task-related semantic facts
- Other modules:
  - the equivalent semantic subject for that mode, not raw widget state

Commands should never have to reconstruct meaning from low-level editor state if the active mode can publish it once.

### Discoverability Rule

Only surface commands that are relevant to the current mode and currently available from context.

We are explicitly not following the Emacs model of surfacing a broad swamp of commands and then erroring late for many of them. Whitebloom should be more contextual than Emacs here. If a command is not meaningfully available from the current snapshot, it should not clutter the palette.

That means:

- `modeScope` gates whether the command belongs in the current mode at all.
- `enabledWhen` gates whether it appears as available for the current subject snapshot.
- `run` still revalidates for safety.

### Example: `pdf.extract-pages`

This should be one semantic command, not two unrelated public commands.

The user intent is the same in both places: extract pages from the active PDF into workspace materials. The only difference is host-specific follow-up behavior.

Shared behavior:

- identify the target PDF
- prompt for page selection
- extract selected pages as images into workspace files
- create or update a materials set such as `Extracted > PDF > <PDF Name>`

Host-specific behavior:

- In canvas mode with a selected PDF node, lay out the extracted pages on the canvas.
- In PDF mode, do not lay them out because there is no canvas host effect.

The command should therefore have:

- a shared semantic identity
- shared extraction logic
- host-specific post-actions that depend on the current subject (in this case, only canvas iff a pdf node is selected, or also PDF mode)

### Architectural Direction

We should move away from the old idea that commands are keyed primarily by runtime context like `canvas` or `arrangements`.

Instead:

- Make major mode the first-class discovery axis via `modeScope`.
- Make contextuality depend on a published `subjectSnapshot`.
- Treat host capabilities and post-actions as separate from command identity.
- Let commands belong to more than one mode when that reflects one coherent user intent.

This solves the important cases cleanly:

- A command can exist in both PDF mode and canvas mode without being duplicated.
- A command can be always available in a mode when its job is to change host state.
- A command can be narrowly contextual when it needs a specific semantic subject.

### Implementation Goals

1. Remove or retire the current `runtime context` abstraction as the primary command-model axis.
2. Replace it with a mode-scoped command model built around `modeScope`, `subjectSnapshot`, optional `enabledWhen`, and `run`.
3. Remove vestigial support that assumes `arrangements` is still a meaningful future command context.
4. Introduce a normalized snapshot contract that each major mode provides.
5. Ensure the palette only surfaces commands that pass both mode-scope and contextual availability.
6. Keep execution-time revalidation so commands remain safe under changing state.
7. Migrate ad hoc contextual commands into the canonical command path once the new model exists.

### Design Notes

- `enabledWhen` should be optional. Omitted means effectively "always enabled in this mode scope".
- The snapshot contract should be semantic, stable, and intentionally small.
- Host capabilities should remain available to command execution, but should not replace the snapshot.
- Avoid a giant untyped context object full of unrelated optionals.
- Prefer one command identity per user intent. Only split into separate public commands when the user intent itself diverges.

### Org-Mode Analogy

Org remains a useful contrast, but not a template.

In Emacs/Org, many commands are broadly exposed at the mode level and validate late against the current item or heading. Our goal is stricter and better contextual surfacing: commands should appear when they are actually meaningful for the current semantic subject, not merely because the user is somewhere inside a broad mode family.

For Org-like modes in Whitebloom, the important snapshot idea is:

- the current element at point
- the enclosing entry at point
- the TODO state
- any other semantic task facts needed for command enablement

That is the level at which commands such as TODO-state changes or clock actions should make availability decisions.

---

## Undo/Redo

### Current State

There is no canvas-level undo/redo. Text node editors use Lexical's `HistoryPlugin`, so text-editing undo works in isolation, but no broader history system exists for board-level operations (node placement, deletion, moves, connections, etc.).

The command infrastructure already lays useful groundwork:

- Every execution produces a `WhitebloomCommandExecutionEnvelope` with a stable `executionId`, `commandId`, and optional `groupId`.
- `subscribeToCommandExecutions` allows external listeners to observe every command start and finish.
- `groupId` / `createCommandExecutionGroupId` already groups related multi-command operations (e.g., placing a batch of materials) into a single logical unit.
- Commands have a typed `args` / `normalizedArgs` on their envelope, so what was requested is always recoverable.

What is missing: commands carry no inverse logic, no before/after state is captured, and there is no history stack.

### Design Direction

Every command that mutates persistent state must declare an `undo` function. Commands without one simply do not participate in history. There is no snapshot fallback.

This matches how Maya, Houdini, Illustrator, Word, Excel, and Unreal Engine 5 handle undo — all use explicit command inverses. The snapshot model (Photoshop, ZBrush) only makes sense for raster or sculpt operations where there is no analytic inverse, e.g. a brush stroke or a blur filter. Whitebloom's domain is structured data: adding a node, deleting a node, moving a node. All have trivial exact inverses. A snapshot fallback would be hiding an incomplete command behind a memory allocation and giving up meaningful undo labels in the process.

The contract is therefore strict: if you write a command that changes board state, you own its inverse. If a command is genuinely non-mutating (view zoom, palette open, mode navigation), it is marked `undoable: false` and does not appear in history at all.

### What Needs to Be Built

1. **`undoable: false` on non-mutating commands** — a flag to explicitly exclude commands from history. Non-mutating commands (pure navigation, view toggles, palette interactions) are marked `undoable: false`. Any command that mutates state and lacks an `undo` is an incomplete command, not a case the runtime silently ignores.

2. **`undo` on the command contract** — a function `(args: TArgs, result: TResult, context: TContext) => void` that exactly reverses the command's effect. Required for any command that pushes to history. Parallel to `run`.

3. **History store** — a Zustand store (or a separate module) that maintains:
   - a per-mode undo stack of `HistoryEntry` values
   - a per-mode redo stack
   - a maximum depth cap per mode
   - a notion of the current "open group" for coalescing grouped commands

   A `HistoryEntry` records the `groupId` (if any), the command envelope(s), and a bound `undoFn` that closes over the args and result captured at execution time.

4. **Runtime integration** — on successful completion of an undoable command, the runtime binds the command's `undo` with the recorded args and result into an `undoFn`, constructs a `HistoryEntry`, and pushes it to the history store under the command's `majorMode`. Groups of commands sharing a `groupId` collapse into one entry.

5. **Coalescing for continuous operations** — drag-to-move fires many intermediate state updates. The history system must not push every intermediate position. The right seam is at the command boundary: a `node.move` command should be dispatched once on drag-end with the final position, not on every pointer move. This is also the right fix for drag correctness generally.

6. **`undo` and `redo` commands** — two first-class commands in the command registry that pop from the respective stacks and apply the reversal. These should be in the `modeScope` for all modes where history is meaningful (canvas at minimum). Standard key bindings: Ctrl+Z / Ctrl+Shift+Z.

7. **History scope** — undo context belongs to the active major mode, not to a global timeline. The history store maintains a separate stack per major mode, all scoped to the current board session and cleared on board close. When the user switches modes, the active stack switches with them; history is preserved across mode round-trips within the same session. This means Ctrl+Z in canvas undoes canvas actions, and returning to FocusWriter later still lets the user undo FocusWriter actions — the two histories never interleave.

   Mode transitions themselves are not recorded as history entries. They are navigation, not mutations. A future navigation buffer (back/forward across mode visits or board visits) is the right home for that; it should not be designed here.

   Text-editing undo inside Lexical nodes is already handled by Lexical's `HistoryPlugin` independently. The FocusWriter mode stack may therefore only need to cover structural operations outside of text editing, or may delegate to Lexical entirely for its undo domain. Either way, Lexical undo should not bubble into the canvas stack.

   Operations that structurally span a mode transition (e.g., a canvas command that opens FocusWriter and seeds content) should record on the initiating mode's stack, since that is the context from which the user would naturally want to undo them.

8. **UI affordance** — at minimum, the palette should show `undo` / `redo` as available or disabled commands based on stack depth. A future "last action" status label is a natural follow-on but not required for the initial implementation.

### Relationship to Commands Refactoring

This work is compatible with the Commands Refactoring section above and benefits from it. The `subjectSnapshot` contract clarifies what a command's semantic subject is, which informs what `undo` needs to reverse. The two can progress in parallel. If the refactoring lands first, `undo` should be part of the new command contract shape from the start.

### Implementation Plan

#### Phase 1 — History Store and Contract Extensions

The goal of this phase is to introduce the data structures and type-level contracts without changing any runtime behavior yet. Nothing executes differently at the end of this phase; it only lays the shape everything else attaches to.

- [ ] Add `undoable?: false` to `WhitebloomCommandCore`. Absence means the command participates in history; presence of `false` opts it out. Non-mutating commands (palette open, view zoom, mode navigation) should be marked `undoable: false` as they are encountered.
- [ ] Add `undo?: (args: TArgs, result: TResult, context: TContext) => void` to `WhitebloomCommandCore`. Required for any command that will push to history. No command needs to implement it yet; the field is introduced first so the shape is stable.
- [ ] Define the `HistoryEntry` type: `{ id, groupId?, modeKey, envelopes: WhitebloomCommandExecutionEnvelope[], undoFn: () => void, redoFn: () => void }`. Both `undoFn` and `redoFn` close over the args and result captured at execution time.
- [ ] Create `src/renderer/src/history/store.ts` — a Zustand store with per-mode undo and redo stacks keyed by `WhitebloomCommandModeKey`, a depth cap (e.g. 100 per mode), and an open-group cursor for coalescing. Expose `push`, `undo`, `redo`, `clear`, and `peek`. No external code calls it yet.

#### Phase 2 — Runtime Integration

Wire the history store into the command execution path so that history is recorded automatically for commands that declare `undo`.

- [ ] In `runtime.ts`, after a successful execution (`outcome.ok === true`), check whether the command has `undo` defined and `undoable !== false`. If so, bind `undoFn` and `redoFn` from the command's `undo` and `run` respectively, close over the recorded args and result, and push a `HistoryEntry` to the history store under the command's `majorMode`.
- [ ] If a command is undoable but does not declare `undo`, log a development-time warning. Do not push to history and do not silently absorb it.
- [ ] Implement group coalescing: if a command carries a `groupId` matching the current open group on the stack, append its envelope to that entry rather than pushing a new one. Close the group when a command without that `groupId` arrives.
- [ ] On failed execution, do not push to history.
- [ ] Clear the redo stack for a given mode whenever a new entry is pushed to that mode's undo stack.
- [ ] Write a simple integration test: execute two fake undoable commands, assert two entries on the canvas stack and an empty redo stack.

#### Phase 3 — Undo and Redo Commands

Expose undo and redo as executable commands so the existing command dispatch and keybinding infrastructure handles them.

- [ ] Register `history.undo` and `history.redo` as built-in commands in `builtins.ts`. Both belong to all modes where history is meaningful; `modeScope` can start as canvas-only and expand.
- [ ] `history.undo` pops the top entry from the active mode's undo stack, calls its `undoFn`, and moves the entry to the redo stack.
- [ ] `history.redo` pops the top entry from the redo stack, calls its `redoFn` (the original `run` bound over the recorded args), and moves the entry back to the undo stack.
- [ ] Both commands should be marked `undoable: false` so they do not themselves appear in the history.
- [ ] Bind `Ctrl+Z` to `history.undo` and `Ctrl+Shift+Z` to `history.redo` in the keybinding configuration.
- [ ] Mark the commands as unavailable (`enabledWhen`) when their respective stack is empty so they are suppressed from the palette when there is nothing to act on.

#### Phase 4 — Drag Coalescing

Continuous drag operations currently fire many intermediate state updates. This phase ensures moves are recorded as single atomic history entries.

- [ ] Audit the canvas drag path. Identify where node position updates are applied during drag (likely directly against the board store, not via a command).
- [ ] Introduce a `node.move` command (or equivalent) that takes the final resting position. Dispatch it once on `onNodeDragStop`, not on every pointer move.
- [ ] Remove any direct store mutations for node position that bypass the command path, or suppress them from history by not dispatching a command mid-drag.
- [ ] Verify: dragging three nodes, then undoing, should restore all three to their pre-drag positions in one step (they would share a `groupId` set at drag-start).

#### Phase 5 — Inverses for Core Canvas Commands

Implement `undo` on the most frequently used canvas commands so they participate in history. Until a command has `undo`, it simply does not push to the stack.

- [ ] `board.add-bud` / `board.add-node` variants — undo deletes the created node by id.
- [ ] `selection.delete` — undo re-inserts the deleted nodes and edges. The `run` function must return the deleted items so `undo` can restore them.
- [ ] `node.move` (from Phase 4) — undo restores the pre-drag positions recorded at dispatch time.
- [ ] Edge creation — undo removes the created edge by id.
- [ ] Grouped placement operations (placing materials, importing files) — undo removes the entire group by their shared node ids.

#### Phase 6 — UI Affordances

Surface history availability in the UI.

- [ ] Palette entries for `history.undo` and `history.redo` should show as disabled (not hidden) when the stack is empty, with a label like "Nothing to undo".
- [ ] Display the label of the last undoable action in the undo command description if available (e.g., "Undo Delete Node"). This comes from the command's `presentations` title or a dedicated `label` field on `HistoryEntry`.
- [ ] (Deferred) A visible undo history panel showing the last N actions per mode is a natural follow-on but is not needed for the initial implementation.

---

## Ink Eraser

### Current State

`perfect-freehand` is already installed. The ink model in `src/shared/ink.ts` is sample-based: each stroke stores an array of point samples plus style and dynamics metadata. `InkToolKind` already includes `'eraser'` as a tool kind. The renderer in `src/renderer/src/canvas/InkOverlay.tsx` converts samples to a filled outline at draw time via `getStroke(...)`. Persistence in `src/main/services/ink-store.ts` only supports `loadInkAcetate` and `appendInkStroke`. `Canvas.tsx` appends new strokes locally and over IPC.

Capture and playback work. What is missing is any stroke replacement or edit pipeline — there is no way to modify or remove existing strokes, either in the store or over IPC.

### Approach

Implement erasure as a **sample-corridor operation** with no new dependencies. The eraser stroke is a sampled path in board space, just like an ink stroke. For each existing stroke, test whether its sample points fall within the eraser's swept corridor (a capsule along the eraser centerline at the eraser radius). Runs of samples that fall inside the corridor are discarded; the surrounding surviving runs become new strokes. The original stroke is replaced atomically by zero, one, or two successor strokes.

This fits the existing data model exactly — samples in, samples out — and keeps undo clean under the command contract already defined for the history system.

**On precision.** The corridor test operates on centerline samples, not on the rendered brush outline. This means the erase boundary is not pixel-matched to the visible stroke edge; near-misses at thick stroke edges and coarse split boundaries at sample granularity are expected. This is acceptable for v1. Exact outline booleans against the rendered brush shape (Illustrator-style) would require either converting samples to Paper.js paths on every operation or migrating the storage model away from samples — neither is justified yet. If that precision is ever needed, the model decision comes first.

**On destructive vs. non-destructive.** Erasure is applied immediately: surviving sample sub-arrays replace the originals in the store, erased runs are gone. Storing eraser strokes and computing the result lazily at render time would complicate every downstream consumer — serialization, export, undo, future edits — for no practical gain at this stage.

**No new library.** Paper.js is a scene-graph model that wants to own the path representation. polybooljs operates on polygons. `@flatten-js/boolean-op` is reasonable for polygon clipping but our strokes are sampled centerlines, not polygons. None of them matches the current model without a conversion layer. Revisit only if exact rendered-outline booleans become a real requirement.

### What Needs to Be Built

1. **Ink edit API in `ink-store.ts`** — add `replaceInkStrokes(acetateId, replacements: InkStrokeReplacement[])` where `InkStrokeReplacement` is `{ remove: strokeId[], insert: InkStroke[] }`. This is the atomic primitive all eraser and future ink-edit operations build on.

2. **IPC channel for stroke replacement** — `appendInkStroke` has a corresponding IPC surface; `replaceInkStrokes` needs one too. `Canvas.tsx` must be able to drive stroke edits over IPC, not just appends.

3. **Corridor computation** — a pure function `eraseFromStroke(stroke: InkStroke, eraserSamples: Point[], eraserRadius: number): InkStroke[]` that returns the surviving sub-strokes. Pure and side-effect free; easy to unit test. Lives in `src/shared/ink.ts` or a sibling module.

4. **`ink.erase` command** — dispatched once when the user lifts the eraser (not on every pointer move). Collects the eraser samples accumulated during the drag, runs `eraseFromStroke` against all strokes whose bounding regions intersect the eraser corridor, calls `replaceInkStrokes` with the diff, and records the affected original strokes so `undo` can restore them exactly. Participates in the history system without special casing.

5. **Render-time split coherence** — verify that `getStroke(...)` called on a sample sub-array that starts or ends mid-original produces a clean visible terminus (no abrupt spike or open gap). May require trimming a sample or two at split boundaries, or capping the endpoint style.

### Undo

`ink.erase` fits the standard command contract. Its `undo` function calls `replaceInkStrokes` with the original strokes re-inserted and the successor strokes removed. No internal ink history stack is needed. An internal stack would only become necessary if erasure were non-destructive (lazy rendering of stacked eraser strokes), which is a different architecture decision and is not being made here.
