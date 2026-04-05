# Current Work

Transition from single-file boards to a workspace-based architecture with a pluggable module
system, then implement the focus writer as the first module. Legacy test boards are dead —
no backwards compatibility.


## Phase 1: Workspace architecture

STATUS: OK

The foundation everything else depends on. Establishes the workspace as the top-level unit,
introduces the `wloc:` URI scheme, and gives the app a home screen.

### 1.1 Types and schema

STATUS: OK.

- Add `WorkspaceConfig` type to `src/renderer/src/shared/types.ts`:
  `{ version: number, name?: string, brief?: string }`. Current version: 1.
  `name` here is the workspace/project name. `brief` is agent context for the project as a whole ("what I'm working on").
- Document `wloc:resource/path` as the canonical form for workspace-local URIs.
  `file:///absolute/path` for external filesystem links. `https://` reserved for web (future).
- Ensure `Board` type carries its own `name?: string` and `brief?: string`, independent of
  `WorkspaceConfig`. Board `name` is the display label for that board (shown in workspace home,
  UI chrome). Board `brief` is agent context scoped to that board ("what this board is for").
  Both share field names with `.wbconfig` fields; the file they appear in defines their scope —
  no prefixing (`boardName`, `boardBrief`) needed.
- Add `Workspace` runtime type: `{ config: WorkspaceConfig, rootPath: string, boards: string[] }`.

Note: in the future, the settings modal will need to distinguish between app settings, workspace settings, and board settings.

### 1.2 URI resolver

STATUS: OK.

- UNIX paths internally. Resolve to system paths as needed, ideally using proper ts libs.
- Utility function `resolveResource(uri: string, workspaceRoot: string): string` → absolute path.
  - `wloc:blossoms/foo.md` → `{workspaceRoot}/blossoms/foo.md`
  - `file:///C:/path/to/file` → `C:/path/to/file`
  - Unknown scheme → throw (fail loudly, not silently).
- Register a `wloc:` Electron protocol handler in the main process (replacing `wb-file:`).
  Handler resolves URIs against the active workspace root and serves the file.
- Delete the `wb-file:` protocol registration and all call sites.

### 1.3 Main process: workspace IPC

STATUS: OK.

Replace the current board-centric IPC handlers with workspace-aware ones.

New handlers:
- `workspace:open-dialog` — file picker accepting `.wbconfig` or `*.wb.json`.
  If `.wb.json` is chosen, checks for `.wbconfig` in the same directory: found → workspace
  board, not found → quickboard. Returns `{ ok, workspaceRoot?, openBoardPath? }`.
- `workspace:create-dialog` — directory picker; writes a `.wbconfig` with defaults;
  returns `{ ok, workspaceRoot }`.
- `workspace:read(workspaceRoot)` — reads `.wbconfig` and lists `*.wb.json` files;
  returns `Workspace`.
- `board:open(boardPath)` — reads and returns the board JSON. Works for both workspace
  boards and quickboards; caller determines context from whether `workspaceRoot` is known.
- `board:save(boardPath, json)` — writes board JSON to the given explicit path. Used for
  both workspace boards and quickboards. This is the primary save mechanism going forward.
- `board:create(workspaceRoot, name)` — writes an empty `*.wb.json` inside a workspace,
  returns its path. Workspace boards only.
- `quickboard:create-dialog` — file-save dialog to pick a location and filename; writes
  an empty `*.wb.json` at that path (no `.wbconfig` created); returns `{ ok, boardPath }`.

Remove (truly legacy — no new equivalent):
- `board:save-as` — old "save as" dialog that both prompted for a path and wrote the file.
  Superseded by the workspace-driven create flows and explicit `board:save`.
- `board:save-to-path` — old explicit-path save with a different signature. Superseded by
  `board:save(boardPath, json)`.
- `board:load` — old load handler that used an internally stored path. Superseded by
  `board:open(boardPath)` with explicit path.

Note: the old `board:save` (no path argument, used stored internal path) is also removed.
The new `board:save(boardPath, json)` is not legacy — it is the canonical save handler.

### 1.4 Preload and renderer API surface

STATUS: OK.

- Update `preload/index.ts` to expose the new workspace IPC surface.
- Remove old board API from `window.api`.

### 1.5 Board store: workspace awareness

STATUS: OK.

Two Zustand stores, not one.

**`workspace.ts`** — workspace-level context. Populated when a workspace is open; all fields
null when no workspace is active (including quickboard mode).
- `root: string | null` — absolute path to the workspace directory
- `config: WorkspaceConfig | null` — parsed `.wbconfig` contents
- `boards: string[]` — list of `*.wb.json` paths in the workspace

**`board.ts`** — active board state. Populated when any board is open (workspace or quickboard);
cleared when returning to workspace home or start screen.
- `path: string | null` — absolute path to the open `*.wb.json`
- `nodes`, `edges` — board data
- `isDirty: boolean` — unsaved changes flag

**Routing.** `App.tsx` reads both stores to determine which screen to render:
- `workspace.root === null && board.path === null` → `StartScreen`
- `workspace.root !== null && board.path === null` → `WorkspaceHome`
- `board.path !== null` → `Canvas` (workspace board if `workspace.root` is set, quickboard if not)

**URI resolution.** The URI resolver reads `workspace.root`. For quickboards this is `null`,
so any `wloc:` URI throws — the quickboard constraint is enforced automatically without
special-casing in the resolver.

**Save and load.** Both use `board:save(boardPath, json)` and `board:open(boardPath)` with the
explicit path from `board.path`. No stored implicit paths anywhere.

### 1.6 App shell and workspace home UI

STATUS: OK.

- `App.tsx` becomes a shell that routes between three states:
  - **No workspace open** → `StartScreen` (open workspace / create workspace / new quickboard).
  - **Workspace open, no board** → `WorkspaceHome` (board list, new board, open board).
  - **Board open** → `Canvas` (existing board editor, workspace or standalone).
- `WorkspaceHome`: lists all `*.wb.json` files in the workspace, click to open, button to
  create a new board, workspace name/brief display.
- `StartScreen`: minimal — three actions. "New Quickboard" calls `quickboard:create-dialog`
  to create a `*.wb.json` at a user-chosen location without creating a workspace.
- Standalone boards open directly into `Canvas`. The canvas header/toolbar should surface
  a "Promote to Workspace" action when a standalone board is open. No workspace home is
  shown for standalone boards — there is no workspace to browse.

### 1.7 Migrate image node to `wloc:`

STATUS: OK.

- Update `ImageNode` to use URIs resolved via the new protocol handler.
- Drop the `measureDroppedImage` inline resource approach; resource is now a URI string.

**Drag & drop mechanics.** Electron exposes `dataTransfer.files[i].path` in the renderer —
this is the absolute filesystem path of the dropped file, not a buffer. Drops from a web
browser do not produce a file path (`path` is empty); `dataTransfer.getData('text/uri-list')`
gives the remote URL instead. The drop handler branches on context:

- **Workspace, local file** (`workspace.root !== null`, `file.path` non-empty): call
  `workspace:copy-to-res(workspaceRoot, srcPath)` to copy into `res/`; store
  `wloc:res/filename` as the node's `resource`.
- **Quickboard, local file** (`workspace.root === null`, `file.path` non-empty): store the
  original path as a `file:///absolute/path` URI directly — no copy, no `wloc:`. Quickboards
  are not portable by design; absolute paths are the expected consequence.
- **Any context, browser drag** (`file.path` empty): show an error toast —
  *"Can't embed web resources — save the image to your local drive first, then drop it."*
  No node is created. A fuller solution (`wbhost:` inline bytebuffers) is tracked in
  `deferred_work.md`.


## Phase 2: App store

Introduces an app-level store at `app.getPath('userData')` that backs transient quickboards
and establishes the `wbapp:` URI scheme as the foundation for app-global resources.

### 2.1 `wbapp:` URI scheme

STATUS: OK.

- Register `wbapp:` in the URI resolver: resolves against `app.getPath('userData')`.
- `wbapp:boards/quickboard-{timestamp}.wb.json` — transient board files.
- `wbapp:res/` — reserved for app-global resource cache (directory created here; population
  is deferred — see `deferred_work.md`).
- Register an Electron protocol handler for `wbapp:` in the main process alongside the
  existing `wloc:` handler.
- Unknown `wbapp:` paths throw like any other unresolvable URI.

### 2.2 Transient boards

STATUS: OK

- `Board` type gains `transient?: true`. Absent means permanent.
- `quickboard:create` no longer shows a file-save dialog. It:
  - Generates a timestamped filename (`quickboard-{timestamp}.wb.json`).
  - Writes the empty board to `userData/boards/`.
  - Sets `transient: true` in the board JSON.
  - Returns the board path; caller opens it in Canvas.
- Auto-save writes to the transient path on every change. No dirty-flag tracking needed for
  transient boards — just write on every mutation.
- The "Save" toolbar action checks `board.transient`:
  - `true` → shows a file-save dialog; on confirm, writes to the chosen path, deletes the
    transient file, updates `board.path`, clears `transient` from both the store and the
    written JSON.
  - `false` → saves in place (existing behavior).

### 2.3 Start screen: transient boards

STATUS: OK

- `StartScreen` reads `userData/boards/` and lists any `*.wb.json` files found under
  "Unsaved quickboards".
- Clicking one opens it directly (no dialog) — natural recovery path after closing without
  saving.
- A discard action (trash icon) deletes the file immediately.
- A trash icon on the toolbar to delete boards perhaps? 

### 2.4 IPC changes

STATUS: OK.

New handlers:
- `quickboard:create` — creates transient file in `userData/boards/`, returns its path.
  No dialog. Replaces the old `quickboard:create-dialog`.
- `board:promote(transientPath, targetPath, json)` — writes `json` to `targetPath`, deletes
  `transientPath`. Called by the save flow when promoting a transient board.
- `app:list-transient-boards` — lists `*.wb.json` files in `userData/boards/`; used by
  `StartScreen`.
- `app:discard-transient-board(path)` — deletes a transient board file.

Remove:
- `quickboard:create-dialog` — superseded by `quickboard:create`.


## Phase 3: Module registry

Makes node types pluggable. Text and image become built-in modules. Canvas stops caring about
specific node implementations.

### 3.1 Module contract types

New file: `src/renderer/src/modules/types.ts`.

```ts
interface WhitebloomModule {
  id: string                          // e.g. 'com.whitebloom.focus-writer'
  extensions: string[]                // e.g. ['.md']
  defaultRenderer: 'internal' | 'external'
  recognizes?(resource: string): boolean   // marks module as specific
  createDefault?(): string            // default file content for palette-created buds

  // React binding (Layer 3)
  NodeComponent: React.ComponentType<BudNodeProps>
  EditorComponent?: React.ComponentType<BudEditorProps>  // internal modules only
}

interface BudNodeProps {
  id: string
  label?: string
  resource: string      // wloc: or file: URI — unresolved; component resolves if needed
  size: Size
  selected: boolean
  onBloom: () => void   // called by double-click; dispatched by BudNode wrapper
}

interface BudEditorProps {
  resource: string          // wloc: URI of the blossom file
  workspaceRoot: string
  initialData: string       // raw file contents as returned by blossom:read
  onSave: (data: string) => Promise<void>
  onClose: () => void
}
```

Leaves keep their existing props shape — they do not go through the module registry for
rendering. The registry is for buds only.

### 3.2 Module registry

New file: `src/renderer/src/modules/registry.ts`.

- `registerModule(module: WhitebloomModule): void`
- `resolveModuleById(id: string): WhitebloomModule | undefined`
- `resolveModuleByExtension(ext: string): WhitebloomModule[]`  (multiple modules may share extensions)
- `getAllModules(): WhitebloomModule[]`

Registry is a plain module-level Map. Populated by static imports at app startup — no dynamic
loading yet, but the interface is compatible with it later.

### 3.3 Built-in modules

- `src/renderer/src/modules/image/` — `com.whitebloom.image`
  - `extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tiff', '.svg']`
  - `defaultRenderer: 'external'`
  - No `recognizes` (generic module — does not stamp a type on drag-and-drop)
  - `NodeComponent`: existing `ImageNode` adapted to `BudNodeProps`
  - No `EditorComponent` — bloom calls `file:open` via IPC

- Text (leaf) stays as-is. Leaves are not registered in the module registry.

### 3.4 Registry-driven Canvas

- `nodeTypes` in `Canvas.tsx` is derived from the registry at module load time.
- All bud nodes are rendered via a `BudNode` wrapper component:
  - Receives the board node's data
  - Looks up the module from the registry by `type`
  - Renders `module.NodeComponent`
  - Handles double-click → calls `onBloom` → sets bloom state in Canvas
- Unknown bud type (module not registered) → `UnknownBudNode` placeholder (label + question mark icon).
  Board remains valid; no errors thrown. This is a quiescent state — the node will render
  correctly once the module is installed.
- Render failure (file missing, module crash, unresolvable URI) → `ErrorNode` placeholder
  (label + error icon + short reason string). Same position and size as the original node.
  Board data is unchanged — `ErrorNode` is a runtime UI state, never written to disk.
  Distinct from `UnknownBudNode`: unknown type = module not present; error = module tried
  and failed (or resource is inaccessible).

### 3.5 Drag-and-drop module dispatch

- On file drop, iterate registered modules; call `recognizes(resource)` for specific modules first.
  First truthy result claims the file and stamps its `id` as the node `type`.
- If no specific module claims it, fall through to generic modules matched by extension.
- If no module matches at all → create a void-typed bud (`type: null`), `UnknownBudNode` renders it.


## Phase 4: Bloom modal

The container that activates when a bud is double-clicked.

### 4.1 Bloom state

- Canvas holds `activeBloom: { nodeId: string, module: WhitebloomModule, resource: string } | null`.
- `BudNode`'s `onBloom` callback sets this state.
- Clearing `activeBloom` (Escape, close button, save-and-close) returns to the board.

### 4.2 IPC: blossom read/write

- `blossom:read(workspaceRoot, resource)` — resolves `wloc:` URI, reads file, returns string.
- `blossom:write(workspaceRoot, resource, data)` — resolves URI, writes file.
- Both handlers live in the main process alongside workspace handlers.

### 4.3 Bloom modal shell

New component: `src/renderer/src/canvas/BloomModal.tsx`.

- Full-screen overlay rendered above the canvas (not replacing it).
- On mount: calls `blossom:read`, passes result as `initialData` to the module's `EditorComponent`.
- Provides `onSave(data)` → calls `blossom:write`.
- Provides `onClose()` → clears `activeBloom` in Canvas.
- For `defaultRenderer: 'external'` modules: `onBloom` calls `file:open` directly; no modal mounts.
- Autosave vs explicit save: decide during implementation. Start with explicit save-on-close.


## Phase 5: Focus writer module

The first real module. IA Writer-style prose editor for `.md` files.

### 5.1 Module definition

`src/renderer/src/modules/focus-writer/index.ts`

- `id: 'com.whitebloom.focus-writer'`
- `extensions: ['.md']`
- `defaultRenderer: 'internal'`
- `recognizes(resource)`: reads the file path — returns `true` for `.md` files. This is a
  specific module, so the module id gets stamped as `type` on drag-and-drop.
- `createDefault()`: returns `''` (empty string — blank markdown file).

### 5.2 Canvas node component (`FocusWriterNode`)

- Compact bud card: label (filename if no label) + first non-empty line of content as a subtitle.
- Content preview populated from the blossom file (read once on mount, not live).
- Shows a small document icon.

### 5.3 Editor component (`FocusWriterEditor`)

- IA Writer aesthetic: centered column, generous line height, minimal chrome.
- Editing surface: decide between raw `<textarea>` with monospace markdown styling vs. CodeMirror
  with markdown mode. Start simple — a well-styled textarea is fine for v1.
- `onSave` called on close (and optionally on a debounced interval while editing).
- No preview mode for v1 — editing is the primary action.

### 5.4 Create flow (palette)

- New toolbar action or canvas keyboard shortcut to create a focus-writer bud.
- On activate: prompts for a filename (or auto-generates one), writes empty `.md` to
  `blossoms/`, adds bud node at cursor position, immediately opens bloom modal.
- Exact UX (shortcut key, inline prompt vs dialog) decided during implementation.
