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
- **Unknown is not broken.** If no editor is registered for an asset type, the node renders as a generic placeholder. If no shell is registered, agents skip the asset. Unknown types do not cause errors or corruption — they are simply unhandled. The board always remains valid.
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

### Directory structure

```
project/
  board.wb.json        # The board manifest — entry point for humans and agents
  blossoms/              # Bloomable assets, one file each
    schema-1.json
    research.md
    procedure-1.json
  res/                 # External assets — images, videos, spreadsheets, docs
    diagram.png        # Files that originate outside whitebloom and open in native apps
    photo.jpg
    .thumbs/           # Auto-generated low-res previews (internal, not committed)
```

The `.wb.json` extension signals "Whitebloom board" while remaining parseable by any JSON tool. The `blossoms/` directory contains only assets that bloom into editors. The `res/` directory contains media referenced by nodes.

### Board schema

```json
{
  "version": 1,

  "brief": "A board for exploring perfume concepts for a spring/summer fashion campaign targeting physically active teens to young adults. Keep current teen trends in mind when suggesting directions.",

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
      "kind": "bud",
      "type": "image",
      "position": { "x": 550, "y": 500 },
      "size": { "w": 400, "h": 300 },
      "label": "System diagram",
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

**Buds** bloom when double-clicked. They always have a `resource` pointing to an external file. On the board they show a compact representation (title, icon, thumbnail, or summary). The bloom action depends on the module's `defaultRenderer`:

- **Internal buds** open whitebloom's editor in a modal. Examples: markdown documents, DB schemas, code files.
- **External buds** open the OS default app for the file type. Examples: images (system photo viewer), videos (media player), spreadsheets (Excel/LibreOffice), PDFs (system reader). The node on the board is a thin wrapper — it stores only the `resource` path and display `size`. No asset data is embedded in the board JSON.

**Leaves** are simple board-level elements that do not bloom. They may have inline `content` (for text). They can have an expanded view but never inject a full editor. Examples: sticky notes, labels.

The distinction in the schema is the `kind` field: `"bud"` or `"leaf"`.

### Media assets

Image, video, and other external assets are stored in `res/` as ordinary files. The board JSON holds only the path and display size — never the asset data itself. This keeps the board file lean and fast regardless of how many or how large the assets are.

```json
{
  "id": "node-4",
  "kind": "bud",
  "type": "image",
  "resource": "res/photo.jpg",
  "size": { "w": 400, "h": 300 }
}
```

The node component renders the asset at the declared size. For images: `<img src={resolvedPath} style="width:100%;height:100%;object-fit:contain" />`. ReactFlow controls position, drag, and resize. The image module adds aspect-ratio lock to the resizer.

**Thumbnails.** `res/.thumbs/` holds auto-generated low-resolution previews. The board displays the thumbnail at normal zoom and switches to full-resolution when zoomed in or the node is large. This directory is generated on demand and should not be committed to version control.

**LLM readability.** Binary formats like `.xlsx` are not directly readable. The HEP `read()` implementation for those types runs a parse transform (e.g. SheetJS for spreadsheets) before handing data to any consumer. The LLM receives a JSON table, not a binary blob. For fully opaque formats (PDF, compiled binaries), the lens `view` field carries the agent-readable representation.

### Drag and drop

Two flows bring external assets onto the board:

**OS-level drag.** The user drags a file from the OS file manager onto the canvas. The main process copies the file to `res/`, returns a relative path, and the renderer creates a new node at the drop position (converted from screen coordinates to canvas coordinates via ReactFlow's `screenToFlowPosition`).

**Media library.** A sidebar panel lists all files in `res/` grouped by type (images, video, audio, documents). Dragging a thumbnail from the panel onto the canvas creates a node using the already-resident file. The library is a view over `res/` — no separate index.

### Field reference

**Board-level fields**

| Field     | Required | Description |
|-----------|----------|-------------|
| `version` | yes      | Schema version |
| `brief`   | no       | Plain text context for agents — describes the board's purpose, domain, constraints, or preferences. Written by the user; read by agents as the first thing in the manifest. |
| `nodes`   | yes      | Array of node objects |
| `edges`   | yes      | Array of edge objects |

**Node fields**

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

1. `cat board.wb.json` to understand the full board: what exists, where it is, how things connect. The `brief` field (if present) appears near the top of the file and gives immediate context about the board's purpose and the user's intentions.
2. Follow `resource` paths to read or edit specific assets.
3. Grep `buds/` for content across all bloomable assets.
4. Understand the topology from `edges` without opening any other file.

The board is a flat manifest. Leaves are inline. Buds are one hop away. No recursive directory scanning, no frontmatter parsing, no database queries.

### Agent write access (future)

Agents can read freely. For writes, a lock mechanism prevents conflicts with the UI: the agent acquires a lock (e.g. `board.lock`), the UI enters read-only mode, the agent makes its changes and releases the lock. Stale locks expire after a timeout. This handles the cooperative case. The adversarial case (a rogue agent ignoring the lock) is mitigated the same way as any destructive human action: git.


## Symbiotic modules

Whitebloom is extended through **symbiotic modules**. A symbiotic module presents two independent interfaces for the same asset type — one for humans, one for agents — designed to work in concert. The name reflects the core design principle: human and machine working as one through a shared interface.

### Design

The system follows the Maya/Blender model: on startup, a loader harvests all modules it can find (local project modules, user-installed modules, or modules discovered via a configurable path). Each module is instantiated, validated, and registered. Conflicts (two modules claiming the same type) are logged as warnings and resolved first-come-first-served. Future versions can surface conflicts to the user and let them choose.

**One module, one type.** A module handles exactly one bud type. This is a deliberate constraint. If a module bundled multiple types (e.g. markdown + code), a user who likes its markdown editor but prefers a different code editor is stuck. One-to-one mapping means users can swap any single type without friction.

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
  id: string              // Unique identifier, e.g. "com.whitebloom.markdown.editor"
  name: string            // Human-readable name, e.g. "Markdown"
  type: string            // The bud type this editor handles, e.g. "markdown"
  icon: string            // Icon identifier (name, path, or emoji for v1)
  fileExtension: string   // e.g. ".md", ".json"
  defaultRenderer: 'internal' | 'external'
  // 'internal' — bloom opens whitebloom's Editor component in a modal.
  // 'external' — bloom opens the file in the OS default app (shell.openPath).
  // Users can override this per type in whitebloom.config.json.

  createDefault(): T
  // Returns the default data written to disk when a new bud of this type
  // is created. For markdown, this might be "# Untitled\n". For a schema,
  // an empty JSON structure. The return value is serialized to a file
  // in blossoms/ using the fileExtension. External modules may return null
  // here — they do not create assets, they reference existing ones.

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

```
user double-clicks bud (type: "markdown")
  → editorRegistry.get("markdown")
  → editor found → render editor.Editor in bloom modal
  → editor not found → show "no editor installed for this type"

agent encounters bud (type: "markdown")
  → shellRegistry.get("markdown")
  → shell found → read module_agents.md, list available lenses and skills
  → shell not found, asset is internal → agent reads the raw file directly
  → shell not found, asset is extern → agent skips the asset
```

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
5. Registers editors in a `Map<string, WhitebloomEditor>` keyed by `type`.
6. Registers shells in a `Map<string, WhitebloomShell>` keyed by `type`.
7. If a type is already registered, the new module is skipped and a warning is logged.

The discovery path can be extended later (environment variable, manifest file, or a package manager) without changing the module contracts.

### Example module

```ts
// modules/markdown/index.ts

import { MarkdownEditor } from "./editor"

export const editor: WhitebloomEditor<string> = {
  id: "com.whitebloom.markdown.editor",
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

### Project config

A `whitebloom.config.json` file at the project root controls which editors and shells handle which asset types. This is where users express their preferences for mixing and matching.

```json
{
  "types": {
    "markdown": {
      "editor": "com.whitebloom.markdown.editor",
      "shell": "com.community.markdown.shell",
      "renderer": "external"
    },
    "db-schema": {
      "editor": "com.whitebloom.db-schema.editor",
      "shell": "com.whitebloom.db-schema.shell",
      "lenses": [
        "community/security-audit.lens.json",
        "community/normalization.lens.json"
      ]
    },
    "image": {
      "editor": "com.whitebloom.image.editor",
      "renderer": "external"
    }
  }
}
```

The `lenses` array allows users to layer additional community or custom lenses on top of whatever the shell ships. These are resolved as paths relative to a configurable lens directory.

When no config file exists, the app falls back to default resolution: the first registered editor and first registered shell for each type.

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
│  openExternal(absolutePath) → void              │
│  watchRes(path, cb) → Unsubscribe               │
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
      BloomModal.tsx      # Modal shell — looks up editor, renders Editor component
    ui/                   # @whitebloom/ui — shared components + CSS variables
      variables.css
      Panel.tsx
      Button.tsx
      Tabs.tsx
      ...
  modules/                # Built-in symbiotic modules
    markdown/
      index.ts            # Exports WhitebloomEditor<string>
      editor.tsx          # Markdown editor component
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
    types.ts              # Board schema, WhitebloomEditor<T>, BudEditorProps<T>
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

- **Thumbnail providers.** Editors can register a `Thumbnail` component for richer board-level previews. External modules (images, video) will generate thumbnails automatically into `res/.thumbs/`; the board switches between thumbnail and full-resolution based on zoom level.
- **Media library panel.** A sidebar listing all `res/` assets grouped by type, with thumbnails. Supports drag-from-panel-to-canvas to create nodes from already-resident files.
- **Commands API.** An optional `activate(api)` hook where editors can register commands, shortcuts, and menu items — like Maya's `cmds` or Blender's `bpy.ops`.
- **Conflict resolution UI.** When two modules claim the same type, the user picks which one to use.
- **Module marketplace.** Discovery from a remote registry. Editors, shells, lenses, and skills are all independently publishable.
- **Leaf modules.** Same symbiotic pattern, for custom leaf types.
- **Shell SDK.** Tooling for shell authors — lens validation, skill testing, `module_agents.md` linting.

