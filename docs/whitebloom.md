# Whitebloom


A whiteboard that blooms into different assets. Imagine this. A whiteboard software (similar to Miro) where you have text, images, connections, code snippets, etc. Now, imagine that some nodes could embed their own assets. For example, we could have a DB Schema node. At the whiteboard level, this node is either represented by a thumbnail of the schema, or via a name and icon. Thus at this level we can add notes, connections, etc. to reason about the schema as a black box, operating at a high abstraction level. But then we double click on the schema node, and a modal window shows up, embedding a react flow driven node view of the schema. Now we're working a a low to mid abstraction level, we're not on the whiteboard anymore. We're inside a node inside the whiteboard. We close this schema. Another node could be a markdown node. Perhaps showing a title, a byline, and an outline paragraph. You double click on this node. The full markdown file shows up, perhaps with a button to switch between editor and preview.

The same can be done for a video node. Or a code node. The idea is that whitebloom is a modular app. Users can define their own nodes. A module would have: a way to describe the node as a node inside the whiteboard, a data schema for the node, and an editor that can be embedded inside a simple div (like a react flow editor is embedded). The only requirement would be, I think, that it must work with React.

This process of showing a modal window from a node would be called blooming, as in the node blooms into the modal.

Not every bloom is an in-app editor. An image node blooms by opening the system photo viewer. A video node opens mpv or VLC. A spreadsheet opens Excel. Blooming routes to whatever handles the asset best — in-app when whitebloom has a meaningful editor, native when a dedicated external app wins. Users can override this per type. In all cases, whitebloom retains the organizational layer: the node on the board, its connections, its thumbnail, its place in the graph.

Thus it's a whiteboard that blooms. Not everything has to bloom. A plain text node on the whiteboard is just a plain text node, like it's on Miro.


## Philosophy: an OS for knowledge

Whitebloom follows the Unix philosophy applied to knowledge work. The board is a filesystem. Each module is a small program that does one thing well to one asset type. Text is the universal primitive — the thing that makes assets diffable, portable, and readable by both humans and LLM agents.

The core principles:

- **Everything is a file.** Every asset on the board is a file on disk. No databases, no binary blobs, no opaque stores.
- **One tool, one job.** A module handles exactly one asset type. Users compose their environment by choosing which modules handle which types, rather than depending on monolithic bundles.
- **Text as the universal interface.** Assets are text files wherever possible. This is what makes Whitebloom meaningfully different from tools like Notion or Obsidian, which are databases dressed up as files.
- **Symbiosis between human and machine.** Modules present two faces — one toward the human (the editor), one toward the agent (the shell). Both are native citizens operating on shared ground. Whitebloom is not a tool for humans that tolerates agents, or an agentic system with a human UI bolted on. It is an environment where both work as peers.
- **Unknown is not broken.** If no editor is registered for an asset type, the node renders as a generic placeholder. If no shell is registered, agents skip the asset. Unknown types do not cause errors or corruption — they are simply unhandled. The board always remains valid. When a node fails to render at runtime (missing file, module crash, bad URI), the canvas shows a generic error node in its place — same position, same size, no data lost, recoverable without touching the board file.
- **Render is not edit.** Whitebloom always owns the board-level representation of an asset: the thumbnail, the preview, the node in the graph. Whitebloom does not have to own the edit action. A module declares whether it handles editing internally or delegates to a native app. The board preview is never delegated.

### Spec-native vs extern modules

**Spec-native** modules treat the asset file as the source of truth. The file is a text file on disk — a `.md`, `.json`, or similar. These modules get the full guarantees: diffability, agent traversability, offline-first operation, no external dependencies.

**Extern** modules treat the asset file as a pointer or stub — the real data lives elsewhere (a database, an API, a remote service). Extern modules opt out of the core guarantees explicitly. The `resource` field in the board schema still points to whatever the module needs — a file path, a connection string, a URI. The schema does not annotate the distinction; the module knows what its `resource` means, just as a Unix file path can point to a regular file, a socket, or a device without the directory entry saying which.

Both are valid. The distinction lives in documentation and tooling, not in the schema.

### Internal vs extern rendering

Every module declares a `defaultRenderer`:

- **`internal`** — the bloom action opens whitebloom's own editor in a modal. The module ships a UI component. Markdown, DB schemas, code, and other formats whitebloom curates are internal by default.
- **`external`** — the bloom action opens the file in the OS default app for that type (`shell.openPath`). Images open in the system photo viewer. Videos open in the user's media player. Spreadsheets open in Excel or LibreOffice. No in-app editor is needed.

Users can override `defaultRenderer` per type in their project config. A programmer who prefers vim for markdown flips it to `external` — they get vim on double-click. A notary who has Word installed leaves `.docx` as external. The default serves most users; the override serves everyone else.

Right-clicking any node always shows **Open With Native Editor** in the context menu, regardless of `defaultRenderer`. This is an escape hatch — it never conflicts with the default, it just supplements it.

The `blossoms/` and `res/` directories reflect this split at the filesystem level:

- `blossoms/` contains assets whose primary creation and editing path is whitebloom. These are internal-by-default modules: markdown documents, DB schemas, structured data whitebloom defines.
- `res/` contains assets that originate outside whitebloom and are referenced by nodes. Images dragged onto the board, videos linked from disk, spreadsheets, PDFs — all land in `res/`. Whitebloom reads and previews them; external apps edit them.

A file's directory is determined by its module's `defaultRenderer`. Internal modules write to `blossoms/`. External modules copy to `res/`.


## LLM friendly CoreData

The CoreData is the foundation of Whitebloom. Everything else — editors, renderers, plugins — is replaceable. The data is not.

### Principles

- **No binary blobs or databases.** Every asset is a `.md`, `.json`, or media file.
- **One file = one asset.** The board is a file. Each bud (bloomable node) is a file. Media assets are files.
- **The board file is the single entry point.** An agent reads one file to understand the entire board's structure, topology, and references. No need to scan directories or parse frontmatter across dozens of files.
- **Renderer-agnostic.** The schema contains no UI framework metadata. No React Flow internals, no viewport state, no selection state. The CoreData could be consumed by a completely different third party platform, just like multiple apps can open .PSD or .FBX files.
- **Stable across versions.** Changing the renderer is an x.5 upgrade. Changing the schema is a breaking change. Get this right first.

### Workspace structure

A **workspace** is a directory containing a `.wbconfig` file. The presence of `.wbconfig` is what makes a directory a workspace — it is the workspace root marker. Workspaces can contain any number of boards, or none at all.

```
my-project/
  .wbconfig              # Workspace manifest — presence of this file defines the workspace root
  research.wb.json       # A board (any name, any number of boards per workspace)
  sprint-planning.wb.json
  research.inbox.json    # Per-board agent proposal queue (sits alongside its board)
  blossoms/              # Workspace-wide bloomable assets, shared across all boards
    schema-1.json
    research-notes.md
  res/                   # Workspace-wide external assets, shared across all boards
    diagram.png
    photo.jpg
    .thumbs/             # Auto-generated low-res previews (internal, not committed)
    .inbox-snapshots/    # Pre-edit snapshots for binary asset diffs (internal, not committed)
```

**Opening a workspace.** Two entry points, one app:
- Open `.wbconfig` → load workspace, show workspace home (board list), no board open.
- Open `*.wb.json` → find `.wbconfig` in the same directory, load workspace, open that board.

An empty workspace (no boards) is a valid and intentional state — it is the default for a new workspace.

**Inbox naming.** Each board has its own inbox: `<board-stem>.inbox.json` alongside its board file (e.g. `research.inbox.json` for `research.wb.json`).

### Standalone boards (quickboards)

Not every board needs a workspace. A `*.wb.json` file that lives in a directory without a `.wbconfig` is a **standalone board** — informally a *quickboard*. This is the scratchpad mode: open the app, start a new board, draw some things, write some notes, and move on. No workspace setup required.

**Detection.** When the app opens a `*.wb.json`, it checks for `.wbconfig` in the same directory. Present → workspace board. Absent → quickboard. No field in the board file marks the mode; the directory context is the entire signal.

**What works in quickboards.** The board file format is identical to a workspace board. Leaves (text, sticky notes) work without restriction — they carry inline `content` and need no external files. External assets can be linked via `file:///` absolute paths or `https://` URIs on drop.

**What doesn't.** Quickboards do not support `wloc:` URIs — there is no workspace root to resolve them against. Blossoms are not available. Drag-and-drop links files in place (by absolute path) rather than copying them into a `res/` directory. Quickboards have no inbox — there is no agent proposal queue, no ghost elements, no review flow. The inbox is a workspace-level collaboration contract between the user and agents operating on a sustained project; it has no place on a fire-and-forget board.

**Portability tradeoff.** Standalone boards with `file:///` assets are not portable: move the board file or open it on another machine and those links break. This is expected — the user chose not to use a workspace, and absolute paths are the consequence. It is the right tradeoff for ephemeral boards and no tradeoff at all for boards that never move.

**Promoting to a workspace.** A standalone board can be promoted to a full workspace at any time via *Promote to Workspace*. The app:
1. Asks the user to choose or confirm a target directory.
2. Writes `.wbconfig` in that directory.
3. For each `file:///` asset referenced by the board: copies the file into `res/` (or `blossoms/` if the module's `defaultRenderer` is `internal`) and rewrites the node's `resource` field to the corresponding `wloc:` URI.
4. Moves or saves the board file into the new workspace directory.
5. Opens the promoted workspace.

Filename collisions during asset import (two linked files with the same name from different source directories) are resolved by appending a numeric suffix before the extension. The original files are not modified.

**Promotion is one-way.** A workspace board cannot be demoted back to a standalone board. `wloc:` URIs cannot survive without a workspace root, assets in `blossoms/` or `res/` may be shared across multiple boards, and the workspace `name`/`brief` would be silently discarded. The transformation is lossy and has no unambiguous inverse. If a user wants a portable snapshot of a single board, they export it — they do not un-workspace it.

The `.wb.json` extension signals "Whitebloom board" while remaining parseable by any JSON tool. The `blossoms/` and `res/` directories are workspace-level — assets are shared across all boards in the workspace. A node on any board can reference any asset in the workspace.

### Board schema

```json
{
  "version": 3,

  "name": "Perfume Concepts",
  "brief": "A board for exploring perfume concepts for a spring/summer fashion campaign targeting physically active teens to young adults. Keep current teen trends in mind when suggesting directions.",

  "nodes": [
    {
      "id": "node-1",
      "kind": "bud",
      "type": "markdown",
      "position": { "x": 300, "y": 200 },
      "size": { "w": 320, "h": 200 },
      "created": "2026-04-03T10:00:00.000Z",
      "createdBy": "anon",
      "updatedAt": "2026-04-03T10:00:00.000Z",
      "updatedBy": "anon",
      "label": "Research notes",
      "resource": "wloc:blossoms/research.md"
    },
    {
      "id": "node-2",
      "kind": "bud",
      "type": "db-schema",
      "position": { "x": 800, "y": 200 },
      "size": { "w": 280, "h": 180 },
      "created": "2026-04-03T10:05:00.000Z",
      "createdBy": "mae",
      "updatedAt": "2026-04-03T10:08:00.000Z",
      "updatedBy": "mae",
      "label": "Users table",
      "resource": "wloc:blossoms/schema-1.json"
    },
    {
      "id": "node-3",
      "kind": "leaf",
      "type": "text",
      "position": { "x": 550, "y": 50 },
      "size": { "w": 200, "h": 80 },
      "created": "2026-04-03T10:10:00.000Z",
      "createdBy": "anon",
      "updatedAt": "2026-04-03T10:12:00.000Z",
      "updatedBy": "claude",
      "content": "TODO: revisit this connection"
    },
    {
      "id": "node-4",
      "kind": "bud",
      "type": "image",
      "position": { "x": 550, "y": 500 },
      "size": { "w": 400, "h": 300 },
      "label": "System diagram",
      "resource": "wloc:res/diagram.png"
    }
  ],

  "edges": [
    {
      "id": "edge-1",
      "from": "node-1",
      "to": "node-2",
      "label": "describes",
      "style": "dashed-3",
      "color": "fuchsia"
    }
  ]
}
```

Type should be registered via the module system. A module should be able to handle a type of bloom.

### Node types

**Buds** bloom when double-clicked. They always have a `resource` pointing to an external file. On the board they show a compact representation (title, icon, thumbnail, or summary). The bloom action depends on the module's `defaultRenderer`:

- **Internal buds** open whitebloom's editor in a modal. Examples: markdown documents, DB schemas, code files.
- **External buds** open the OS default app for the file type. Examples: images (system photo viewer), videos (media player), spreadsheets (Excel/LibreOffice), PDFs (system reader). The node on the board is a thin wrapper — it stores only the `resource` path and display `size`. No asset data is embedded in the board JSON.

**Leaves** are simple board-level elements that do not bloom. They may have inline `content` (for text). They can have an expanded view but never inject a full editor. Examples: sticky notes, labels.

The distinction in the schema is the `kind` field: `"bud"` or `"leaf"`.

### Error nodes

Any node can fail to render correctly — the linked file may be missing, corrupted, or on a network drive that went offline. When a node cannot be rendered, the canvas replaces it with a generic **error node** in place. The error node:

- Occupies the same position and size as the original node so the layout is preserved
- Shows an error icon, the node's `label` (or filename if no label), and a short reason (e.g. "File not found", "Module failed to load", "URI could not be resolved")
- Does not crash the board or invalidate any other node
- Retains the original node data — nothing is overwritten or deleted
- Can be retried (re-attempt to load the resource) or dismissed (collapse to a minimal tombstone that stays in the graph)

Error nodes are a runtime UI state, not a schema concept. The board JSON is unchanged; the error is in the rendering layer only. An agent or CLI tool reading the board sees the original node data and should not infer anything from the fact that the app showed an error node.

**Distinction from unknown type.** An unknown-type node (`type` field references a module that is not registered) is a normal, valid state — the board is intact and the node will render correctly once the module is installed. An error node means a registered module tried to render and failed, or the underlying resource is inaccessible. These are different problems with different recovery paths: unknown type → install the module; error node → fix the file or the path.

### Media assets

Image, video, and other external assets are stored in `res/` as ordinary files. The board JSON holds only the path and display size — never the asset data itself. This keeps the board file lean and fast regardless of how many or how large the assets are.

```json
{
  "id": "node-4",
  "kind": "bud",
  "type": "image",
  "resource": "wloc:res/photo.jpg",
  "size": { "w": 400, "h": 300 }
}
```

The node component renders the asset at the declared size. For images: `<img src={resolvedPath} style="width:100%;height:100%;object-fit:contain" />`. ReactFlow controls position, drag, and resize. The image module adds aspect-ratio lock to the resizer.

**Thumbnails.** `res/.thumbs/` holds auto-generated low-resolution previews. The board displays the thumbnail at normal zoom and switches to full-resolution when zoomed in or the node is large. This directory is generated on demand and should not be committed to version control.

**LLM readability.** Binary formats like `.xlsx` are not directly readable. The HEP `read()` implementation for those types runs a parse transform (e.g. SheetJS for spreadsheets) before handing data to any consumer. The LLM receives a JSON table, not a binary blob. For fully opaque formats (PDF, compiled binaries), the lens `view` field carries the agent-readable representation.

### Drag and drop

Two flows bring external assets onto the board:

**OS-level drag.** The user drags a file from the OS file manager onto the canvas. The main process copies the file to the workspace `res/` directory, returns a `wloc:res/filename` URI, and the renderer creates a new node at the drop position (converted from screen coordinates to canvas coordinates via ReactFlow's `screenToFlowPosition`).

**Media library.** A sidebar panel lists all files in `res/` grouped by type (images, video, audio, documents). Dragging a thumbnail from the panel onto the canvas creates a node using the already-resident file. The library is a view over `res/` — no separate index.

### Field reference

**Board-level fields**

| Field     | Required | Description |
|-----------|----------|-------------|
| `version` | yes      | Schema version. Current version is `3`. |
| `name`    | no       | Display name for this board — a human-readable label shown in the workspace home screen, board switcher, and UI chrome. Distinct from the workspace `name` in `.wbconfig`. |
| `brief`   | no       | Agent context for this board — describes its purpose, domain, constraints, or editorial preferences. Agents read this first when operating on the board. Distinct from the workspace `brief` in `.wbconfig`, which describes the project as a whole. |
| `nodes`   | yes      | Array of node objects |
| `edges`   | yes      | Array of edge objects |

**Node fields**

| Field      | Required | Description |
|------------|----------|-------------|
| `id`       | yes      | Unique identifier for the node |
| `kind`     | yes      | `"bud"` or `"leaf"` |
| `type`     | yes      | For leaves: a short built-in type string (`"text"`). For buds created via the palette or claimed by a specific module on drag-and-drop: the claiming module's `id` (e.g. `"com.whitebloom.focus-writer"`). For void-typed buds whose handler is unresolved at import time: `null`. |
| `position` | yes      | `{ x, y }` coordinates on the board |
| `size`     | yes      | `{ w, h }` bounding box |
| `created`  | yes      | ISO timestamp for when the node first entered the board |
| `createdBy`| yes      | Username that created the node. Defaults to `"anon"` when no app username is configured. |
| `updatedAt`| yes      | ISO timestamp for the most recent node write |
| `updatedBy`| yes      | Username that performed the most recent node write |
| `label`    | no       | Display name on the board |
| `content`  | no       | Inline content for leaves (e.g. sticky note text) |
| `resource` | no       | URI reference to the asset (required for buds, optional for leaves). Workspace-local files use `wloc:` (e.g. `wloc:blossoms/research.md`). External filesystem paths use `file:///absolute/path`. Web resources use `https://`. |

Edges have `id`, `from`, `to`, and an optional `label`.

Authorship is intentionally lightweight in v3. The board file stores per-node provenance (`createdBy`, `updatedBy`), while the app stores the active username globally in app settings rather than embedding a full user profile in each board.

### Why this works for LLM agents

An agent can:

1. `cat .wbconfig` to understand the workspace: its `name` (the project name), `brief` (what the project is about in general), and module configuration.
2. `ls *.wb.json` to discover all boards in the workspace.
3. `cat research.wb.json` to understand a specific board: what exists, where it is, how things connect. The board's own `name` (its display label) and `brief` (what this board is specifically for) appear near the top and give immediate context. The board `brief` is narrower and more specific than the workspace `brief`.
4. Resolve `wloc:` URIs to workspace-local paths and follow them to read or edit specific assets.
5. Grep `blossoms/` for content across all bloomable assets in the workspace.
6. Understand the topology from `edges` without opening any other file.

The board is a flat manifest. Leaves are inline. Buds are one hop away. No recursive directory scanning, no frontmatter parsing, no database queries.

### Agent write access — inbox system

Agents never wait. Users never lose control of their board. Rather than a file lock, agent writes flow through a **proposal inbox**.

**The double-buffer model**

When an agent modifies a board node, it works from the board state at the time it began (t1). The user may continue editing in the meantime, producing t2. There is no conflict to detect or resolve — only a diff to review. The inbox records what the agent proposed based on t1; the diff window shows t2 (current) alongside the proposal, and the user decides.

**Inbox file**

`<board-stem>.inbox.json` sits alongside its `*.wb.json` board file (e.g. `research.inbox.json` for `research.wb.json`). It is a queue of proposals, each wrapping one or more serialized commands.

```json
{
  "version": 1,
  "proposals": [
    {
      "id": "prop-1",
      "agent": "claude",
      "timestamp": "2026-04-03T10:00:00Z",
      "description": "Added three concept nodes based on brief",
      "rationale": "The brief mentions targeting physically active teens; these three directions are grounded in sport, recovery, and outdoor identity.",
      "atomic": false,
      "commands": [
        {
          "type": "add-node",
          "node": { "id": "node-5", "kind": "bud", "type": "markdown" }
        },
        {
          "type": "update-node",
          "id": "node-1",
          "before": { "label": "Research notes" },
          "after":  { "label": "Research notes — reviewed" }
        }
      ]
    }
  ]
}
```

Each proposal carries two distinct text fields: `description` (what the agent did — a machine-generated summary) and `rationale` (why — the agent's reasoning, the thing the user actually evaluates to decide). When `atomic` is true the proposal must be accepted or denied as a whole; individual commands cannot be split because they are logically dependent.

**When the board is open**: the app polls the inbox ~1/sec. Proposed changes appear on the canvas as ghost elements (see visual treatment below). The user reviews and approves or denies in place.

**When the board is closed**: proposals accumulate in the inbox. On next open, ghost elements appear for all pending proposals. Nothing is silently committed.

A future "trusted agent" mode can commit directly to the board when it is closed, for automated pipelines where the user has explicitly opted out of review.

**Visual treatment**

| Element | Treatment |
|---------|-----------|
| Proposed new node | Dashed colored border, reduced opacity, glow |
| Proposed edited node | Colored glow ring around the existing node |
| Proposed deleted node | Red overlay, strikethrough label |
| Proposed new edge | Dashed colored line |
| Proposed deleted edge | Bold red dashed line; "DELETED ·" repeating along the stroke via SVG `textPath` |

Proposed new nodes appear at the agent's suggested position but are not committed. On approval the node becomes a floating stamp — the user places it wherever they want. No coordinate negotiation.

**Inbox review — keyboard flow**

Pressing the inbox jump key activates review mode: the canvas gets a subtle vignette, and the following keys are captured.

| Key | Action |
|-----|--------|
| A / D | Previous / next proposal, spatially ordered |
| Q | Confirm (soft — undoable via Ctrl-Z) |
| R | Deny |
| Ctrl-Z / Ctrl-Y | Undo / redo a confirm or deny |

Spatial ordering follows the board's reading direction, configurable per user:

| Setting | Order |
|---------|-------|
| `ltr-ttb` | Left-to-right, top-to-bottom (default, Latin scripts) |
| `rtl-ttb` | Right-to-left, top-to-bottom (Arabic, Hebrew) |
| `ttb-ltr` | Top-to-bottom, left-to-right |
| `ttb-rtl` | Top-to-bottom, right-to-left (Japanese, traditional Chinese) |

A persistent badge in the canvas corner shows the pending count and the jump key hint, visible regardless of viewport position. Approving or denying auto-advances to the next proposal. Clicking an inbox item calls `fitView` on the affected nodes to frame them in context.

For edges, approve/deny buttons sit at the midpoint of the proposed edge via React Flow's custom edge API.

**Diff window**

Double-clicking a glowing node opens the diff window:

- **Left**: current node state (t2 — what the user has now)
- **Right**: agent's proposal (what the agent produced from t1)

For new nodes there is no before state; the window shows only approve/deny.

For binary assets (images, video), the diff window is a swiper A/B between the current file and the proposed file. Snapshots for binary proposals are stored in `res/.inbox-snapshots/` keyed to the proposal ID and deleted on resolution.

**Accept as clone**

For text-based and diffable assets, a third option appears alongside approve/deny: **Accept as clone**. The current node (t2) is left untouched and a new sibling node is created containing the agent's proposed content. The user stamps it to a position. The sibling auto-labels as `(agent proposal)` and carries the proposal's `rationale` as a note. The user can then hand-merge, cannibalize, or discard at their own pace.

This option is gated on `Diffable.canMerge` (see Diffable interface below). Binary assets, external modules, and anything where merging has no semantic meaning set `canMerge: false` and the option is not shown.

**Diffable interface**

Every CoreAsset (text node, image node, task list) implements `Diffable`. Third-party modules may optionally implement it. If a module does not, the diff window degrades gracefully to "Content changed" with approve/deny and no detail. Unknown is not broken.

HEP layer — framework-independent data contract:

```ts
interface Diffable<T> {
  diff(before: T, after: T): DiffResult   // pure data, serializable
  canMerge: boolean
}
```

React binding:

```ts
interface DiffableReact<T> extends Diffable<T> {
  DiffView: React.ComponentType<{ before: T, after: T, diff: DiffResult }>
}
```

CoreAssets implement `DiffableReact`. Modules implement `Diffable` at the HEP layer and optionally `DiffableReact` at the React binding layer. If only `Diffable` is present, the app renders `DiffResult` as generic text. The data contract lives at HEP; the view lives in the binding.

**Why not a file lock**

A lock serializes access by exclusion — it either blocks the agent (bad for async workflows) or forces the app into read-only mode (disruptive to the user). More fundamentally, the real problem between a human and an agent is not write contention but conflicting intent. A lock patches the symptom. The inbox surfaces it directly, turns agent writes into reviewable proposals with spatial context, and keeps the user in control without interrupting either party. The adversarial case (a rogue agent bypassing the inbox entirely and writing directly) is mitigated the same way as any destructive action: git.


## Symbiotic modules

Whitebloom is extended through **symbiotic modules**. A symbiotic module presents two independent interfaces for the same asset type — one for humans, one for agents — designed to work in concert. The name reflects the core design principle: human and machine working as one through a shared interface.

### Design

The system follows the Maya/Blender model: on startup, a loader harvests all modules it can find (local project modules, user-installed modules, or modules discovered via a configurable path). Each module is instantiated, validated, and registered.

**Extensions over semantic types.** A module declares the file extensions it handles — not a single semantic type. An image module can declare `.jpg`, `.jpeg`, `.png`, `.webp`, `.tga` and is still one module for one asset family. Multiple modules may handle the same extension — there is no exclusive ownership and no type conflict. Users can mix, swap, and layer handlers freely.

**Generic vs specific modules.** The distinction is made via an optional `recognizes()` method:

- **Generic modules** handle any file of their declared extensions. They do not stamp a type on the board node — the node is *void-typed*, and any generic handler that supports the extension can open it. A plain image viewer or a raw JSON inspector are generic.
- **Specific modules** implement `recognizes(resource)`, which inspects the file content (minimally — a header, a top-level field, not a full parse) and returns `true` if the file belongs to their domain. On recognition, the module's `id` is stamped as the node `type`. A PostgreSQL schema editor that only fires on JSON files structured as its own schema format is specific.

**Void-typed buds.** When no specific module claims a dropped file, the board node stores `type: null`. The resource URI and file extension are the sole identity. At open-time, all generic modules that handle the extension are available as handlers. The OS default app is always available as a fallback regardless of which modules are installed.

### The symbiotic split

A module has two independently resolvable halves:

- **Editor** (`WhitebloomEditor<T>`) — the human interface. A UI component rendered inside the bloom modal when a user double-clicks a bud. Framework-specific (React, Svelte, etc.).
- **Shell** (`WhitebloomShell`) — the agentic interface. Lenses, skills, and agent notes that tell an LLM how to perceive and operate on the asset. Pure data and logic — no framework dependency.

Users can mix and match across developers for the same asset type. A project config might say: markdown assets use the editor from developer A, the shell from developer B, plus two community lenses and a custom skill the team wrote. All of that resolves independently.

This separation means shell authors don't need to write UI, editor authors don't need to think about agents, and domain experts (a security researcher, a fintech analyst) can publish lenses and skills without touching either.

### Editor contract (v1)

The human-facing half. A plain object, no base class.

```ts
type WhitebloomEditor<T = unknown> = {
  id: string              // Unique identifier, e.g. "com.whitebloom.focus-writer"
                          // For specific modules, this is what gets stamped as the
                          // board node's `type` when the module claims a file.
  name: string            // Human-readable name, e.g. "Focus Writer"
  extensions: string[]    // File extensions handled, e.g. [".jpg", ".jpeg", ".png"]
                          // Multiple modules may declare the same extension.
  icon: string            // Icon identifier (name, path, or emoji for v1)
  defaultRenderer: 'internal' | 'external'
  // 'internal' — bloom opens whitebloom's Editor component in a modal.
  // 'external' — bloom opens the file in the OS default app (shell.openPath).
  // Users can override this per type in .wbconfig.

  recognizes?(resource: string): boolean | Promise<boolean>
  // Optional. Marks this as a specific module. Called on drag-and-drop to test
  // whether this module claims the dropped file. Implementations should inspect
  // minimal data — a file header, a top-level JSON field — not parse the whole
  // document. If absent, the module is generic and never stamps a type on nodes.

  createDefault?(): T
  // Optional. Returns the default data written to disk when a new bud of this
  // type is created via the palette tool. For a focus document: "# Untitled\n".
  // For a schema: an empty JSON structure. External-only modules that reference
  // existing files may omit this entirely.

  Editor: React.ComponentType<BudEditorProps<T>> | null
  // The React component rendered inside the bloom modal when the user
  // double-clicks this bud. null for external-default modules that have
  // no in-app editor — the bloom action calls shell.openPath instead.
  // Even external modules may provide an Editor as a fallback (shown when
  // no native app is registered for the file type).
}

type BudEditorProps<T = unknown> = {
  resource: string        // Relative path to the asset file
  read(): Promise<T>
  save(data: T): Promise<void>
}
```

### Shell contract

The agentic half. A shell is a directory of files — no code required, no framework dependency. Shells are portable across domain bindings: a shell written for the web app works identically in a Rust app because there is nothing to port.

```
modules/markdown/
  agents/
    module_agents.md        # What this asset is, how agents should approach it
    lenses/
      default.lens.json     # General-purpose interpretive frame
      outline.lens.json     # Reads the document as an argument structure
    skills/
      summarize.ts          # Generates a summary of the document
      restructure.ts        # Reorganizes sections based on instructions
```

- `module_agents.md` — a plain markdown file describing the asset type, its conventions, and how an agent should interact with it. This is the agent's entry point for understanding the module.
- `lenses/` — interpretive frames (see Lenses below).
- `skills/` — operational tools (see Skills below).

All three are optional. A module can ship just an editor, just a shell, or both.

### Lenses

A lens is an interpretive frame that shapes how an agent perceives an asset. It is not about readability — spec-native assets are already readable text. A lens is about *perspective*. It tells the agent what to look for, what vocabulary to use, what counts as good or bad.

A database schema is readable as raw JSON. But a **data access lens** and a **data modeling lens** ask completely different questions of the same file — just as a DBA and a domain architect look at the same schema from different angles. Lenses let module authors (or users, or agents themselves) encode that expertise as named, invocable perspectives.

#### Lens format

```json
{
  "metadata": {
    "name": "Data modeling lens",
    "source": "internal",
    "description": "Evaluates whether tables map cleanly to domain concepts"
  },
  "notes": "Look at the tables as domain concepts first. Does each table represent a real entity in the problem domain? Are there tables that exist only for implementation convenience? Is this standard practice for this domain? Focus on whether the schema makes sense for the problem it's trying to solve, not on query performance.",
  "view": ""
}
```

| Field | Description |
|-------|-------------|
| `metadata.name` | Human-readable name for the lens |
| `metadata.source` | `"internal"` or `"extern"`. Internal means the agent should read the raw asset file directly — `view` may be empty. Extern means the raw asset is opaque (a URI, a connection string) — the agent should rely on `view` for data. |
| `metadata.description` | What this lens is for, used by agents to decide which lens to apply |
| `notes` | Instructions for the agent — the interpretive frame itself. Written in natural language. |
| `view` | A text rendering of the asset data through this lens. Empty for internal modules (avoids duplication). For extern modules, this is the agent's only window into the data. |

#### Key properties

- **A lens is allowed to be lossy and partial.** Its job is to frame, not to faithfully reproduce.
- **Lenses are just JSON files.** The barrier to authorship is zero. A user can open a lens file, rewrite the notes, and the agent reads the new perspective next time. An agent can rewrite a lens on request.
- **Lenses compose with skills.** The natural workflow is: apply a lens to orient, then invoke a skill to act on what you found.
- **Lenses are shareable across domain bindings.** They have no framework dependency.

#### Example: user-authored lens

A user on a fintech team writes a custom lens for their database schema module:

```json
{
  "metadata": {
    "name": "Multi-tenancy security audit",
    "source": "internal",
    "description": "Evaluates schema for tenant data isolation and access control"
  },
  "notes": "Focus on multi-tenancy security over speed of writes and reads. Look for: tables without tenant_id columns, foreign keys that cross tenant boundaries, missing row-level security policies, indexes that could leak tenant data through timing attacks. Money is involved — err on the side of flagging false positives.",
  "view": ""
}
```

No code. No API. No developer account. The agent reads it next time it opens that asset.

### Skills

A skill is an operational tool that an agent can invoke to act on an asset. Where lenses orient, skills operate.

Skills are written by the module author in a way that they can be invoked by LLMs. By convention, a skill should only interact with the asset type its module handles. A skill that reaches into other asset types is operating outside the spec — the board has no way to detect or prevent this, and the consequences belong to the module.

Skills are optional and additive. A module with no skills is still fully functional — the agent just can't perform surgical operations on the asset beyond raw file editing.

### Resolution flow

**Drag-and-drop import**

```
file dropped onto canvas
  → collect all modules whose extensions[] include the file's extension
  → run recognizes(resource) on all specific modules (those that implement it), in parallel
  → zero specific modules recognize it  → create void-typed bud (type: null)
  → exactly one recognizes it          → stamp module.id as type, create concrete bud
  → multiple recognize it              → show picker ("two modules want to handle this file")
                                          user selects one → stamp that module's id
                                          (treat as a module bug; collision should be near-impossible)
```

**Palette creation**

```
user selects module from palette
  → module.createDefault() is called
  → new file written to blossoms/ (internal) or res/ (external)
  → bud created with type: module.id — always concrete, no ambiguity
```

**Opening a bud**

```
user double-clicks bud (type: "com.whitebloom.focus-writer")
  → editorRegistry.get("com.whitebloom.focus-writer")
  → module found → render module.Editor in bloom modal
  → module not found → show "no editor installed for this type"
                        right-click always offers "Open with native app"

user double-clicks void-typed bud (type: null)
  → collect all generic modules whose extensions[] include the resource's extension
  → if exactly one → open with that module's Editor (or openExternal if defaultRenderer: 'external')
  → if multiple → show "Open With" picker (inline toolbar or small modal)
  → if none → fall back to OS default app via shell.openPath

agent encounters bud (type: "com.whitebloom.focus-writer")
  → shellRegistry.get("com.whitebloom.focus-writer")
  → shell found → read module_agents.md, list available lenses and skills
  → shell not found, resource is text file → agent reads the raw file directly
  → shell not found, resource is opaque binary → agent skips the asset

agent encounters void-typed bud (type: null)
  → look up generic shells by extension
  → shell found → proceed as above
  → no shell → read raw file if text, skip if binary
```

**Open With — secondary handlers**

Any bud, regardless of type, can be opened with an alternative module. Right-clicking a bud (or using a keyboard shortcut on a selected bud) shows all modules whose `extensions[]` include the resource's extension, plus the OS default app. The primary handler (the stamped `type`) is shown first. Selecting a secondary handler opens the file in that module's Editor without changing the node's `type`.

### What a module does NOT do in v1

- **No custom thumbnails.** Buds render as a generic card with the module's icon and the node's label. A future `Thumbnail` component can be added to the editor contract without breaking existing modules.
- **No commands or menus.** Modules cannot register keyboard shortcuts, toolbar buttons, or context menu items yet. The contract is designed to allow this in v2 via an optional `activate(api)` hook — similar to how Maya and Blender plugins start with a registration function and grow into richer API consumers.
- **No inter-module communication.** Modules are isolated. They don't know about each other.

### Module discovery

On startup, the loader:

1. Scans known locations for modules (built-in modules ship with the app, user modules live in a configurable directory).
2. Imports each module's entry point (e.g. `index.ts` exporting a `WhitebloomEditor`).
3. Scans for shell directories alongside editors (`agents/` directory).
4. Validates the contracts (all required fields present, `Editor` is a component, etc.).
5. Registers editors in two indexes: a `Map<string, WhitebloomEditor>` keyed by `id`, and a `Map<string, WhitebloomEditor[]>` keyed by extension (each extension maps to all modules that handle it, in registration order).
6. Registers shells in a `Map<string, WhitebloomShell>` keyed by module `id`, and a `Map<string, WhitebloomShell[]>` keyed by extension for void-typed lookups.
7. Multiple modules handling the same extension is normal and expected — no warnings, no skipping. Order determines the default when a picker is not shown.

The discovery path can be extended later (environment variable, manifest file, or a package manager) without changing the module contracts.

### Example module

```ts
// modules/focus-writer/index.ts

import { FocusWriterEditor } from "./editor"

export const editor: WhitebloomEditor<string> = {
  id: "com.whitebloom.focus-writer",
  name: "Focus Writer",
  extensions: [".md"],
  icon: "file-text",
  defaultRenderer: "internal",

  // Specific module: claims .md files that look like plain markdown documents.
  // Checks for a markdown heading or paragraph — avoids claiming frontmatter-heavy
  // files that belong to a site generator module.
  recognizes(resource) {
    const content = readFileSync(resource, "utf8")
    return /^#{1,6} |^[^\-{]/.test(content.trimStart().slice(0, 200))
  },

  createDefault() {
    return "# Untitled\n"
  },

  Editor: FocusWriterEditor,
}
```

```tsx
// modules/markdown/editor.tsx

export function MarkdownEditor({ read, save }: BudEditorProps<string>) {
  const [text, setText] = useState("")

  useEffect(() => { read().then(setText) }, [])

  return (
    <div>
      <textarea value={text} onChange={e => setText(e.target.value)} />
      <button onClick={() => save(text)}>Save</button>
    </div>
  )
}
```

```
// modules/markdown/agents/module_agents.md

# Markdown module

This module handles markdown documents (.md files). Assets are plain
UTF-8 markdown files stored in blossoms/.

## Reading
The asset file is the source of truth. Read it directly.

## Editing
Edit the file as standard markdown. Preserve existing heading structure
unless explicitly asked to reorganize.

## Available lenses
- default: General-purpose reading frame
- outline: Treats the document as an argument map — focus on thesis,
  evidence, and logical structure rather than prose quality
```

A real v1 would use CodeMirror or Tiptap inside that editor. The point is: the contract doesn't care. The module owns everything inside the bloom modal.

### Workspace config (`.wbconfig`)

`.wbconfig` is a JSON file at the workspace root. Its presence is what makes a directory a workspace. It serves two purposes: workspace identity and per-workspace module configuration.

```json
{
  "version": 1,
  "name": "Perfume Campaign SS26",
  "brief": "Research and planning for the spring/summer 2026 campaign.",
  "modules": {
    "com.whitebloom.focus-writer": {
      "renderer": "external"
    },
    "com.whitebloom.db-schema": {
      "shell": "com.community.db-schema.shell",
      "lenses": [
        "community/security-audit.lens.json",
        "community/normalization.lens.json"
      ]
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `version` | yes | Config schema version. Current version is `1`. |
| `name` | no | Human-readable workspace name — identifies the project as a whole (e.g. "Perfume Campaign SS26"). Distinct from any individual board's `name`. |
| `brief` | no | Agent context for the workspace — describes what you're working on in general: the project's purpose, domain, and constraints. Agents read this to orient themselves before opening any board. Distinct from any individual board's `brief`, which describes what that specific board is for. |
| `modules` | no | Per-module overrides, keyed by module `id`. Each entry can override `renderer`, `editor`, `shell`, or add extra `lenses`. |

The `lenses` array allows users to layer additional community or custom lenses on top of whatever the shell ships. These are resolved as paths relative to a configurable lens directory.

When `modules` is absent or a module has no entry, the app falls back to default resolution: the first registered editor and first registered shell for each type.

### `name` and `brief` at two levels

Both `.wbconfig` and `*.wb.json` carry a `name` and a `brief`, but they mean different things at each level:

| Field   | In `.wbconfig` | In `*.wb.json` |
|---------|---------------|----------------|
| `name`  | The workspace name — identifies the project as a whole (e.g. `"Perfume Campaign SS26"`). | The board's display label — shown in the workspace home screen and UI chrome (e.g. `"Perfume Concepts"`). |
| `brief` | What you're working on in general — project purpose, domain, constraints. Read by agents before they open any board. | What this specific board is for — its scope, editorial direction, constraints. Read by agents before they touch any node on this board. |

The same field names are reused deliberately. Their meaning is fully determined by the file they appear in — `.wbconfig` is the workspace manifest, `*.wb.json` is a board manifest. Prefixing them (`workspaceName`, `boardBrief`, etc.) would be redundant: you always know which file you're reading. The only context in which both appear simultaneously is documentation like this table, and there the file name makes the scope obvious.

### Naming convention for JSON fields and configs

All JSON field names use **`camelCase`**: `createdBy`, `updatedAt`, `defaultRenderer`, `canMerge`. This is already established by the existing schema and consistent with how TypeScript types map directly to JSON without transformation.

Config file and directory names use the convention dictated by their role:
- **Spec-defined files** use existing punctuation: `.wbconfig`, `*.wb.json`, `*.inbox.json` — the dots and stems are load-bearing identifiers, not style choices.
- **Asset directories** use lowercase with no separator: `blossoms/`, `res/`.
- **Module identifiers** (`id` field) use reverse-domain notation: `com.whitebloom.focus-writer`. The dot separators are intentional and do not imply kebab-case elsewhere.

When in doubt: camelCase for JSON keys, lowercase-no-separator for directory names, reverse-domain for module IDs.

### Shared UI kit (`@whitebloom/ui`)

The app ships a small set of CSS variables and React components that editors can use. This isn't a design system — it's a shared vocabulary so that built-in and third-party editors don't each invent their own buttons, panels, and typography.

**CSS variables.** A root-level set of tokens: colors, spacing, radii, font sizes, shadows. Editors that use these will look consistent with the rest of the app. Editors that ignore them still work — they just look out of place, which is their problem.

```css
/* Illustrative, not exhaustive */
--wb-bg
--wb-bg-surface
--wb-fg
--wb-fg-muted
--wb-border
--wb-radius
--wb-font-sans
--wb-font-mono
--wb-space-sm
--wb-space-md
--wb-space-lg
```

**Components.** A handful of primitives that cover the most common editor UI patterns:

```
Panel          — bordered container with optional header
Button         — primary, secondary, ghost variants
Input / TextArea
Tabs           — for editors with multiple views (e.g. edit / preview)
ScrollArea     — consistent scrollbar styling
Toolbar        — horizontal bar for editor actions
Separator
```

That's it. No layout system, no grid, no complex composites. If an editor needs something more specialized, it builds it — but it can still pull in the CSS variables so colors and spacing match.

**What this is not:**
- Not a theming system. Theming can layer on top of these variables later without changing the component API.
- Not mandatory. The module contract doesn't require editors to use `@whitebloom/ui`. It's offered, not enforced.
- Not a full component library. If it grows past ~15 components, it's too big.

## Architecture

Electron + React + TypeScript + Vite. Single package (not a monorepo) — `@whitebloom/ui` and module imports are path aliases, not separate packages. Monorepo tooling can come later if the project grows; for v1 it's overhead.

### Process boundaries

```
┌─────────────────────────────────────────────────┐
│  Main process                                   │
│  Filesystem API only. No business logic.        │
│                                                 │
│  openWorkspace(wbconfigPath) → WorkspaceMeta    │
│  openBoard(wbJsonPath) → { workspace, board }   │
│  resolveUri(workspaceRoot, uri) → absolutePath  │
│  readFile(absolutePath) → string               │
│  writeFile(absolutePath, data) → void          │
│  copyToRes(workspaceRoot, src) → wlocUri        │
│  openExternal(absolutePath) → void             │
│  watchFile(absolutePath, cb) → Unsubscribe     │
│  showOpenDialog(filters) → path               │
└────────────────────┬────────────────────────────┘
                     │ IPC (contextBridge)
┌────────────────────▼────────────────────────────┐
│  Preload                                        │
│  Exposes IPC calls via window.api               │
│  No transformation, no caching.                 │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Renderer (React)                               │
│  Owns all UI state and business logic.          │
│                                                 │
│  Zustand store  ←→  domain model                │
│       ↓                                         │
│  adapter layer  →  React Flow                   │
│       ↓                                         │
│  canvas + bloom modal + UI                      │
└─────────────────────────────────────────────────┘
```

The main process is deliberately thin. It reads and writes files. That's it. All state, all domain logic, all rendering lives in the renderer process.

### State flow

```
Load:   disk → main (reads) → IPC → Zustand store → adapter → React Flow render
Save:   user edit → Zustand store → serialize to domain model → IPC → main (writes) → disk
```

Saves are debounced. The store holds the canonical domain model (the board schema from CoreData). The adapter is a pure function that maps domain nodes/edges to React Flow's format. If the renderer is swapped later, only the adapter and canvas component change.

External changes (an agent editing a `.md` file) are picked up by the file watcher in main, pushed to the renderer via IPC, and merged into the store.

### Project structure

```
src/
  main/
    index.ts              # Window creation, app lifecycle
    ipc.ts                # File I/O handlers — the entire main-process API
  preload/
    index.ts              # contextBridge exposing window.api
  renderer/
    app.tsx               # Entry point — routes between workspace home and board canvas
    stores/
      workspace.ts        # Zustand store — workspace meta, board list, open board
      board.ts            # Zustand store — board state, load/save
    workspace/
      WorkspaceHome.tsx   # Board list view — create, open, rename boards
    canvas/
      Canvas.tsx          # React Flow wrapper
      adapter.ts          # Domain model ↔ React Flow format
      nodes/              # Custom React Flow node components (BudNode, LeafNode)
    bloom/
      BloomModal.tsx      # Modal shell — looks up editor, renders Editor component
    ui/                   # @whitebloom/ui — shared components + CSS variables
      variables.css
      Panel.tsx
      Button.tsx
      Tabs.tsx
      ...
  modules/                # Built-in symbiotic modules
    focus-writer/
      index.ts            # Exports WhitebloomEditor<string>
      editor.tsx          # Focus writer editor component
      agents/             # Shell — agentic interface
        module_agents.md  # Agent-facing description
        lenses/           # Interpretive frames
          default.lens.json
        skills/           # Operational tools
    db-schema/
      index.ts
      editor.tsx
      agents/
        module_agents.md
        lenses/
          modeling.lens.json
          access.lens.json
        skills/
  shared/
    types.ts              # Board schema, workspace types, WhitebloomEditor<T>, BudEditorProps<T>
    uri.ts                # wloc: URI resolution — resolveUri(workspaceRoot, uri) → absolutePath
    constants.ts          # File extensions, default sizes, etc.
```

### Command pattern

Every mutation to the board state is wrapped in a **command** — a plain object describing what changed.

```ts
type Command = {
  type: string                // e.g. "move-nodes", "add-node", "delete-nodes", "add-edge"
  do(): void                  // Apply the mutation to the store
  undo(): void                // Reverse it
}
```

In v1, commands are fire-and-forget: the store executes `do()` and discards the object. The important thing is that **all state mutations flow through commands from day one**. No direct `store.setState()` calls from UI event handlers. This is a discipline constraint, not a feature — it costs almost nothing now and makes undo/redo a matter of pushing commands onto a stack in v2 rather than retrofitting every interaction.

Commands are created by thin factory functions (e.g. `moveNodes(ids, delta)`, `deleteNodes(ids)`). The store exposes a single `dispatch(command)` method. UI code calls factories, never raw mutations.

**What this enables in v2:**
- Undo/redo via a command history stack.
- Action logging / audit trail.
- Collaborative editing (commands as ops).

**What this does NOT do in v1:**
- No history stack. No undo. No redo. Just the dispatch discipline.
- No serialization of commands. They're ephemeral objects.

### Multi-select

Users can select multiple nodes and operate on them as a group:

- **Selection methods:** Click + drag marquee, or Shift+click to toggle individual nodes into the selection.
- **Group operations:** Move, delete, and (in v2) copy/paste apply to the entire selection. Moving one selected node moves all selected nodes by the same delta.
- **Edges follow:** When all endpoints of an edge are in the selection, the edge is included implicitly. Deleting a selection deletes included edges.
- **State:** The selection is UI-only state (a `Set<string>` of node IDs in the Zustand store). It is never persisted to the board file.
- **Single-select is the default.** Clicking a node without Shift clears the selection and selects only that node. Clicking the canvas clears the selection entirely.

This is a canvas-level concern — modules and bloom editors don't know about multi-select.

### Key decisions

- **Workspace root is load-bearing.** The app never holds a board path without a resolved workspace root. Opening a `*.wb.json` always locates `.wbconfig` in the same directory first. A board opened outside a workspace is an error, not a degraded mode.
- **URI resolution is centralized.** All `wloc:` URIs pass through a single `resolveUri(workspaceRoot, uri)` function in `shared/uri.ts`. No component or store constructs absolute paths directly — they pass URIs to IPC calls and let the resolver handle them. This keeps workspace-awareness out of business logic.
- **Modules are statically imported for v1.** A `modules/index.ts` barrel file imports all built-in modules and registers them at startup. No dynamic `import()`, no filesystem scanning. User-installable modules are a v2 concern.
- **Two Zustand stores.** Workspace state (name, brief, board list, active board path) lives in `workspace.ts`. Board state (nodes, edges) lives in `board.ts`. The workspace store is always loaded; the board store is populated when a board is opened and cleared when returning to the workspace home.
- **The adapter is a pure function.** `toReactFlow(board: Board): { nodes: RFNode[], edges: RFEdge[] }`. No side effects, easy to test, easy to replace.
- **Path aliases.** `@whitebloom/ui` → `src/renderer/ui`, `@whitebloom/shared` → `src/shared`. Configured in `tsconfig.json` and `vite.config.ts`.

### Future (v2+)

- **Thumbnail providers.** Editors can register a `Thumbnail` component for richer board-level previews. External modules (images, video) will generate thumbnails automatically into `res/.thumbs/`; the board switches between thumbnail and full-resolution based on zoom level.
- **Media library panel.** A sidebar listing all `res/` assets grouped by type, with thumbnails. Supports drag-from-panel-to-canvas to create nodes from already-resident files.
- **Commands API.** An optional `activate(api)` hook where editors can register commands, shortcuts, and menu items — like Maya's `cmds` or Blender's `bpy.ops`.
- **Conflict resolution UI.** When two modules claim the same type, the user picks which one to use.
- **Module marketplace.** Discovery from a remote registry. Editors, shells, lenses, and skills are all independently publishable.
- **Leaf modules.** Same symbiotic pattern, for custom leaf types.
- **Shell SDK.** Tooling for shell authors — lens validation, skill testing, `module_agents.md` linting.

