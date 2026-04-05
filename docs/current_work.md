# Current Work

Transition from single-file boards to a workspace-based architecture with a pluggable module
system, then implement the focus writer as the first module. Legacy test boards are dead —
no backwards compatibility.


## Phase 1: Workspace architecture

The foundation everything else depends on. Establishes the workspace as the top-level unit,
introduces the `wloc:` URI scheme, and gives the app a home screen.

### 1.1 Types and schema

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

### 1.2 URI resolver

- UNIX paths internally. Resolve to system paths as needed, ideally using proper ts libs.
- Utility function `resolveResource(uri: string, workspaceRoot: string): string` → absolute path.
  - `wloc:blossoms/foo.md` → `{workspaceRoot}/blossoms/foo.md`
  - `file:///C:/path/to/file` → `C:/path/to/file`
  - Unknown scheme → throw (fail loudly, not silently).
- Register a `wloc:` Electron protocol handler in the main process (replacing `wb-file:`).
  Handler resolves URIs against the active workspace root and serves the file.
- Delete the `wb-file:` protocol registration and all call sites.

### 1.3 Main process: workspace IPC

Replace the current board-centric IPC handlers with workspace-aware ones.

New handlers:
- `workspace:open-dialog` — file picker accepting `.wbconfig` or `*.wb.json`.
  If `.wb.json` is chosen, walk up to find `.wbconfig` in the same directory.
  Returns `{ ok, workspaceRoot, openBoardPath? }`.
- `workspace:create-dialog` — directory picker; writes a `.wbconfig` with defaults;
  returns `{ ok, workspaceRoot }`.
- `workspace:read(workspaceRoot)` — reads `.wbconfig` and lists `*.wb.json` files;
  returns `Workspace`.
- `board:open(boardPath)` — reads and returns the board JSON.
- `board:save(boardPath, json)` — writes board JSON to the given path.
- `board:create(workspaceRoot, name)` — writes an empty `*.wb.json`, returns its path.

Remove: `board:save-as`, `board:save-to-path`, `board:save` (legacy), `board:load`.

### 1.4 Preload and renderer API surface

- Update `preload/index.ts` to expose the new workspace IPC surface.
- Remove old board API from `window.api`.

### 1.5 Board store: workspace awareness

- Replace `currentBoardFilePath` Canvas state with `workspaceRoot` + `boardPath` in the board
  store (or a new workspace store — decide during implementation).
- Save and load actions use `board:save` and `board:open` with explicit paths.
- The store exposes the active `workspaceRoot` so the URI resolver and future IPC calls can
  use it without prop-drilling.

### 1.6 App shell and workspace home UI

- `App.tsx` becomes a shell that routes between two states:
  - **No workspace open** → `StartScreen` (open workspace / create workspace buttons).
  - **Workspace open, no board** → `WorkspaceHome` (board list, new board, open board).
  - **Board open** → `Canvas` (existing board editor).
- `WorkspaceHome`: lists all `*.wb.json` files in the workspace, click to open, button to
  create a new board, workspace name/brief display.
- `StartScreen`: minimal — two actions, no clutter.

### 1.7 Migrate image node to `wloc:`

- Update `ImageNode` to use `wloc:` URIs resolved via the new protocol handler.
- Update drag-and-drop: copy dropped file into workspace `res/` directory (via new IPC
  handler `workspace:copy-to-res(workspaceRoot, srcPath)`), create `wloc:res/filename` URI.
- Drop the `measureDroppedImage` inline resource approach; resource is now a URI string.


## Phase 2: Module registry

Makes node types pluggable. Text and image become built-in modules. Canvas stops caring about
specific node implementations.

### 2.1 Module contract types

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

### 2.2 Module registry

New file: `src/renderer/src/modules/registry.ts`.

- `registerModule(module: WhitebloomModule): void`
- `resolveModuleById(id: string): WhitebloomModule | undefined`
- `resolveModuleByExtension(ext: string): WhitebloomModule[]`  (multiple modules may share extensions)
- `getAllModules(): WhitebloomModule[]`

Registry is a plain module-level Map. Populated by static imports at app startup — no dynamic
loading yet, but the interface is compatible with it later.

### 2.3 Built-in modules

- `src/renderer/src/modules/image/` — `com.whitebloom.image`
  - `extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.tiff', '.svg']`
  - `defaultRenderer: 'external'`
  - No `recognizes` (generic module — does not stamp a type on drag-and-drop)
  - `NodeComponent`: existing `ImageNode` adapted to `BudNodeProps`
  - No `EditorComponent` — bloom calls `file:open` via IPC

- Text (leaf) stays as-is. Leaves are not registered in the module registry.

### 2.4 Registry-driven Canvas

- `nodeTypes` in `Canvas.tsx` is derived from the registry at module load time.
- All bud nodes are rendered via a `BudNode` wrapper component:
  - Receives the board node's data
  - Looks up the module from the registry by `type`
  - Renders `module.NodeComponent`
  - Handles double-click → calls `onBloom` → sets bloom state in Canvas
- Unknown bud type (module not registered) → `UnknownBudNode` placeholder (name + question mark icon).
  Board remains valid; no errors thrown.

### 2.5 Drag-and-drop module dispatch

- On file drop, iterate registered modules; call `recognizes(resource)` for specific modules first.
  First truthy result claims the file and stamps its `id` as the node `type`.
- If no specific module claims it, fall through to generic modules matched by extension.
- If no module matches at all → create a void-typed bud (`type: null`), `UnknownBudNode` renders it.


## Phase 3: Bloom modal

The container that activates when a bud is double-clicked.

### 3.1 Bloom state

- Canvas holds `activeBloom: { nodeId: string, module: WhitebloomModule, resource: string } | null`.
- `BudNode`'s `onBloom` callback sets this state.
- Clearing `activeBloom` (Escape, close button, save-and-close) returns to the board.

### 3.2 IPC: blossom read/write

- `blossom:read(workspaceRoot, resource)` — resolves `wloc:` URI, reads file, returns string.
- `blossom:write(workspaceRoot, resource, data)` — resolves URI, writes file.
- Both handlers live in the main process alongside workspace handlers.

### 3.3 Bloom modal shell

New component: `src/renderer/src/canvas/BloomModal.tsx`.

- Full-screen overlay rendered above the canvas (not replacing it).
- On mount: calls `blossom:read`, passes result as `initialData` to the module's `EditorComponent`.
- Provides `onSave(data)` → calls `blossom:write`.
- Provides `onClose()` → clears `activeBloom` in Canvas.
- For `defaultRenderer: 'external'` modules: `onBloom` calls `file:open` directly; no modal mounts.
- Autosave vs explicit save: decide during implementation. Start with explicit save-on-close.


## Phase 4: Focus writer module

The first real module. IA Writer-style prose editor for `.md` files.

### 4.1 Module definition

`src/renderer/src/modules/focus-writer/index.ts`

- `id: 'com.whitebloom.focus-writer'`
- `extensions: ['.md']`
- `defaultRenderer: 'internal'`
- `recognizes(resource)`: reads the file path — returns `true` for `.md` files. This is a
  specific module, so the module id gets stamped as `type` on drag-and-drop.
- `createDefault()`: returns `''` (empty string — blank markdown file).

### 4.2 Canvas node component (`FocusWriterNode`)

- Compact bud card: label (filename if no label) + first non-empty line of content as a subtitle.
- Content preview populated from the blossom file (read once on mount, not live).
- Shows a small document icon.

### 4.3 Editor component (`FocusWriterEditor`)

- IA Writer aesthetic: centered column, generous line height, minimal chrome.
- Editing surface: decide between raw `<textarea>` with monospace markdown styling vs. CodeMirror
  with markdown mode. Start simple — a well-styled textarea is fine for v1.
- `onSave` called on close (and optionally on a debounced interval while editing).
- No preview mode for v1 — editing is the primary action.

### 4.4 Create flow (palette)

- New toolbar action or canvas keyboard shortcut to create a focus-writer bud.
- On activate: prompts for a filename (or auto-generates one), writes empty `.md` to
  `blossoms/`, adds bud node at cursor position, immediately opens bloom modal.
- Exact UX (shortcut key, inline prompt vs dialog) decided during implementation.
