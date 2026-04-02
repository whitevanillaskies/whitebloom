# Whitebloom


A whiteboard that blooms into different assets. Imagine this. A whiteboard software (similar to Miro) where you have text, images, connections, code snippets, etc. Now, imagine that some nodes could embed their own assets. For example, we could have a DB Schema node. At the whiteboard level, this node is either represented by a thumbnail of the schema, or via a name and icon. Thus at this level we can add notes, connections, etc. to reason about the schema as a black box, operating at a high abstraction level. But then we double click on the schema node, and a modal window shows up, embedding a react flow driven node view of the schema. Now we're working a a low to mid abstraction level, we're not on the whiteboard anymore. We're inside a node inside the whiteboard. We close this schema. Another node could be a markdown node. Perhaps showing a title, a byline, and an outline paragraph. You double click on this node. The full markdown file shows up, perhaps with a button to switch between editor and preview.

The same can be done for a video node. Or a code node. The idea is that whitebloom is a modular app. Users can define their own nodes. A module would have: a way to describe the node as a node inside the whiteboard, a data schema for the node, and an editor that can be embedded inside a simple div (like a react flow editor is embedded). The only requirement would be, I think, that it must work with React.

This process of showing a modal window from a node would be called blooming, as in the node blooms into the modal.

Thus it's a whiteboard that blooms. Not everything has to bloom. A plain text node on the whiteboard is just a plain text node, like it's on Miro.


## LLM friendly CoreData

The CoreData is the foundation of Whitebloom. Everything else — editors, renderers, plugins — is replaceable. The data is not.

### Principles

- **No binary blobs or databases.** Every asset is a `.md`, `.json`, or media file.
- **One file = one asset.** The board is a file. Each bud (bloomable node) is a file. Media assets are files.
- **The board file is the single entry point.** An agent reads one file to understand the entire board's structure, topology, and references. No need to scan directories or parse frontmatter across dozens of files.
- **Renderer-agnostic.** The schema contains no UI framework metadata. No React Flow internals, no viewport state, no selection state. The CoreData could be consumed by a completely different third party platform, just like multiple apps can open .PSD or .FBX files.
- **Stable across versions.** Changing the renderer is an x.5 upgrade. Changing the schema is a breaking change. Get this right first.

### Directory structure

```
project/
  board.wb.json        # The board manifest — entry point for humans and agents
  blossoms/              # Bloomable assets, one file each
    schema-1.json
    research.md
    procedure-1.json
  res/                 # Media assets (images, videos, etc.)
    diagram.png
    photo.jpg
```

The `.wb.json` extension signals "Whitebloom board" while remaining parseable by any JSON tool. The `blossoms/` directory contains only assets that bloom into editors. The `res/` directory contains media referenced by nodes.

### Board schema

```json
{
  "version": 1,

  "nodes": [
    {
      "id": "node-1",
      "kind": "bud",
      "type": "markdown",
      "position": { "x": 300, "y": 200 },
      "size": { "w": 320, "h": 200 },
      "label": "Research notes",
      "resource": "blossoms/research.md"
    },
    {
      "id": "node-2",
      "kind": "bud",
      "type": "db-schema",
      "position": { "x": 800, "y": 200 },
      "size": { "w": 280, "h": 180 },
      "label": "Users table",
      "resource": "blossoms/schema-1.json"
    },
    {
      "id": "node-3",
      "kind": "leaf",
      "type": "text",
      "position": { "x": 550, "y": 50 },
      "size": { "w": 200, "h": 80 },
      "content": "TODO: revisit this connection"
    },
    {
      "id": "node-4",
      "kind": "leaf",
      "type": "image",
      "position": { "x": 550, "y": 500 },
      "size": { "w": 400, "h": 300 },
      "resource": "res/diagram.png"
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

**Buds** bloom into full editors when double-clicked. They always have a `resource` pointing to an external file. On the board they show a compact representation (title, icon, thumbnail, or summary). Examples: markdown documents, DB schemas, procedures, code files.

**Leaves** are simple board-level elements that do not bloom. They may have inline `content` (for text) or a `resource` (for images). They can have an expanded view but never inject a full editor. Examples: sticky notes, image thumbnails, labels.

The distinction in the schema is the `kind` field: `"bud"` or `"leaf"`.

### Field reference

| Field      | Required | Description |
|------------|----------|-------------|
| `id`       | yes      | Unique identifier for the node |
| `kind`     | yes      | `"bud"` or `"leaf"` |
| `type`     | yes      | Asset type (e.g. `"markdown"`, `"db-schema"`, `"text"`, `"image"`) |
| `position` | yes      | `{ x, y }` coordinates on the board |
| `size`     | yes      | `{ w, h }` bounding box |
| `label`    | no       | Display name on the board |
| `content`  | no       | Inline content for leaves (e.g. sticky note text) |
| `resource` | no       | Relative path to the asset file (required for buds, optional for leaves) |

Edges have `id`, `from`, `to`, and an optional `label`.

### Why this works for LLM agents

An agent can:

1. `cat board.wb.json` to understand the full board: what exists, where it is, how things connect.
2. Follow `resource` paths to read or edit specific assets.
3. Grep `buds/` for content across all bloomable assets.
4. Understand the topology from `edges` without opening any other file.

The board is a flat manifest. Leaves are inline. Buds are one hop away. No recursive directory scanning, no frontmatter parsing, no database queries.

### Agent write access (future)

Agents can read freely. For writes, a lock mechanism prevents conflicts with the UI: the agent acquires a lock (e.g. `board.lock`), the UI enters read-only mode, the agent makes its changes and releases the lock. Stale locks expire after a timeout. This handles the cooperative case. The adversarial case (a rogue agent ignoring the lock) is mitigated the same way as any destructive human action: git.


## Modular approach

Whitebloom is extended through **modules**. A module teaches the app how to handle one type of bud — how to create it, what icon to show on the board, and what editor to render when it blooms.

### Design

The system follows the Maya/Blender model: on startup, a loader harvests all modules it can find (local project modules, user-installed modules, or modules discovered via a configurable path). Each module is instantiated, validated, and registered. Conflicts (two modules claiming the same type) are logged as warnings and resolved first-come-first-served. Future versions can surface conflicts to the user and let them choose.

### Module contract (v1)

A module is a plain object. No base class, no framework coupling.

```ts
type WhitebloomModule<T = unknown> = {
  id: string              // Unique identifier, e.g. "com.whitebloom.markdown"
  name: string            // Human-readable name, e.g. "Markdown"
  type: string            // The bud type this module handles, e.g. "markdown"
  icon: string            // Icon identifier (name, path, or emoji for v1)
  fileExtension: string   // e.g. ".md", ".json"
  // Optionally, a user-facing description in markdown or whatever (for v2, if we add a module settings window)

  createDefault(): T
  // Returns the default data written to disk when a new bud of this type
  // is created. For markdown, this might be "# Untitled\n". For a schema,
  // an empty JSON structure. The return value is serialized to a file
  // in blossoms/ using the fileExtension.

  Editor: React.ComponentType<BudEditorProps<T>>
  // The React component rendered inside the bloom modal when the user
  // double-clicks this bud. Receives the asset data and a save callback.
}

type BudEditorProps<T = unknown> = {
  resource: string        // Relative path to the asset file
  read(): Promise<T>
  save(data: T): Promise<void>
}
```

That's the entire surface area for v1. No lifecycle hooks, no service registry, no commands API.

**One module, one type.** A module handles exactly one bud type. This is a deliberate constraint. If a module bundled multiple types (e.g. markdown + code), a user who likes its markdown editor but prefers a different code editor is stuck. One-to-one mapping means users can swap any single type without friction.

### What a module does NOT do in v1

- **No custom thumbnails.** Buds render as a generic card with the module's icon and the node's label. A future `Thumbnail` component can be added to the contract without breaking existing modules.
- **No commands or menus.** Modules cannot register keyboard shortcuts, toolbar buttons, or context menu items yet. The contract is designed to allow this in v2 via an optional `activate(api)` hook — similar to how Maya and Blender plugins start with a registration function and grow into richer API consumers.
- **No inter-module communication.** Modules are isolated. They don't know about each other.

### Module discovery

On startup, the loader:

1. Scans known locations for modules (built-in modules ship with the app, user modules live in a configurable directory).
2. Imports each module's entry point (e.g. `index.ts` exporting a `WhitebloomModule`).
3. Validates the contract (all required fields present, `Editor` is a component, etc.).
4. Registers the module in a `Map<string, WhitebloomModule>` keyed by `type`.
5. If a type is already registered, the new module is skipped and a warning is logged.

The discovery path can be extended later (environment variable, manifest file, or a package manager) without changing the module contract.

### Example module

```ts
// modules/markdown/index.ts

import { MarkdownEditor } from "./editor"

export const module: WhitebloomModule = {
  id: "com.whitebloom.markdown",
  name: "Markdown",
  type: "markdown",
  icon: "file-text",
  fileExtension: ".md",

  createDefault() {
    return "# Untitled\n"
  },

  Editor: MarkdownEditor,
}
```

```tsx
// modules/markdown/editor.tsx

export function MarkdownEditor({ read, save }: BudEditorProps) {
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

A real v1 would use CodeMirror or Tiptap inside that editor. The point is: the contract doesn't care. The module owns everything inside the bloom modal.

### Resolution flow

```
user double-clicks bud (type: "markdown")
  → registry.get("markdown")
  → module found → render module.Editor in bloom modal
  → module not found → show "no module installed for this type"
```

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
│  readFile(path) → string                        │
│  writeFile(path, data) → void                   │
│  copyToRes(sourcePath) → relativePath           │
│  watchBoard(path) → change events               │
│  showOpenDialog() → path                        │
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
    app.tsx               # Entry point
    stores/
      board.ts            # Zustand store — board state, load/save
    canvas/
      Canvas.tsx          # React Flow wrapper
      adapter.ts          # Domain model ↔ React Flow format
      nodes/              # Custom React Flow node components (BudNode, LeafNode, ImageNode)
    bloom/
      BloomModal.tsx      # Modal shell — looks up module, renders Editor
    ui/                   # @whitebloom/ui — shared components + CSS variables
      variables.css
      Panel.tsx
      Button.tsx
      Tabs.tsx
      ...
  modules/                # Built-in modules
    markdown/
      index.ts            # Exports WhitebloomModule<string>
      editor.tsx           # Markdown editor component
    db-schema/
      index.ts
      editor.tsx
  shared/
    types.ts              # Board schema, WhitebloomModule<T>, BudEditorProps<T>
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

- **Modules are statically imported for v1.** A `modules/index.ts` barrel file imports all built-in modules and registers them at startup. No dynamic `import()`, no filesystem scanning. User-installable modules are a v2 concern.
- **One Zustand store.** Board state (nodes, edges, viewport) lives in a single store. No per-module state management — modules receive `read`/`save` callbacks and manage their own editor state internally.
- **The adapter is a pure function.** `toReactFlow(board: Board): { nodes: RFNode[], edges: RFEdge[] }`. No side effects, easy to test, easy to replace.
- **Path aliases.** `@whitebloom/ui` → `src/renderer/ui`, `@whitebloom/shared` → `src/shared`. Configured in `tsconfig.json` and `vite.config.ts`.

### Future (v2+)

- **Thumbnail providers.** Modules can register a `Thumbnail` component for richer board-level previews.
- **Commands API.** An optional `activate(api)` hook where modules can register commands, shortcuts, and menu items — like Maya's `cmds` or Blender's `bpy.ops`.
- **Conflict resolution UI.** When two modules claim the same type, the user picks which one to use.
- **Module marketplace.** Discovery from a remote registry.
- **Leaf modules.** Same pattern, for custom leaf types.

