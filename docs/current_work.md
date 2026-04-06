# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.


## Edges MVP

Render and wire edges between nodes on the canvas. The `BoardEdge` type, store state, cascade-delete on node removal, and board snapshot serialization are all already in place. The missing pieces are: connection handles on bud nodes, edge rendering in ReactFlow, store actions for create/delete, and a custom edge component matching the design language.

Every node on the canvas — text nodes, bud nodes, icon-personality nodes, void-typed nodes (`.blend`, `.psd`, native files), unknown-type nodes, and error nodes — must be connectable. The canvas is a knowledge graph; an edge from a Blender file to a TODO list is a valid and meaningful semantic link that an agent reading the board JSON would immediately understand.

### Pieces

**1. Extend `BoardEdge` type** (`src/renderer/src/shared/types.ts`)

Add `style` and `color` to match the schema example already documented in `whitebloom.md`:

```ts
export type BoardEdge = {
  id: string
  from: string
  to: string
  label?: string
  style?: 'solid' | 'dashed' | 'dotted'   // default: solid
  color?: 'blue' | 'pink' | 'red' | 'purple' | 'green'  // default: neutral fg
}
```

**2. Store actions** (`src/renderer/src/stores/board.ts`)

Add `addEdge` and `deleteEdge`. Import `BoardEdge` (currently not imported). Same `set` pattern as `addNode`/`deleteNode`, marks dirty.

```ts
addEdge: (edge: BoardEdge) => void
deleteEdge: (id: string) => void
```

**3. Handles on every node**

TextNode already has 4 handles (Top/Left as target, Bottom/Right as source). BudNode has none.

Fix: restructure `BudNode`'s return so all four render paths (void-typed → `NativeFileBudNode`, unknown module → `UnknownBudNode`, error → `ErrorBudNode`, resolved → `BudNodeInner`) feed into a shared fragment with handles appended after the content. This touches only the `BudNode` function — none of the sub-components change.

```tsx
// BudNode becomes:
export function BudNode({ id, data, selected }: NodeProps) {
  const budData = data as BudData
  const module = resolveModuleById(budData.moduleType)

  let content: React.ReactNode
  if (budData.moduleType === null) {
    content = <NativeFileBudNode ... />
  } else if (!module) {
    content = <UnknownBudNode ... />
  } else {
    content = <BudNodeInner ... />
  }

  return (
    <>
      {content}
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}
```

All four handles must be offset outward from the node boundary — not just left/right. This is a fix for TextNode too (currently only its left/right handles are offset; top/bottom are flush). The four dots should float outside the node on all sides, so the node edge reads purely as framing/resize boundary, not as a connection target.

Extract `CONNECTION_HANDLE_OUTSET_PX` to a shared file (e.g. `src/renderer/src/canvas/canvas-constants.ts`) so both TextNode and BudNode import the same value. Fix TextNode's top/bottom handles to apply the offset (`top: -CONNECTION_HANDLE_OUTSET_PX`, `bottom: -CONNECTION_HANDLE_OUTSET_PX`). Apply all four offsets to BudNode's handles as well.

**4. Custom edge component** (`src/renderer/src/canvas/WbEdge.tsx`, new file)

Uses ReactFlow's `BaseEdge` + `EdgeLabelRenderer` + `getBezierPath`. Design language: thin line (1.5px), follows surface/shadow tokens.

- Default color: `var(--color-secondary-fg)`
- `color` field → design tokens: `blue→--color-accent-blue`, `pink→--color-accent-pink`, `red→--color-accent-red`, `purple→--color-accent-purple`, `green→--color-accent-green`
- `style` field → SVG `strokeDasharray`: solid→none, dashed→`8 4`, dotted→`2 4`
- `label` → rendered via `EdgeLabelRenderer` as a small pill centered at midpoint (subtle shadow, `--color-primary-bg` background, `--radius-border-inner` radius, small sans text)

Edge `data` shape: `{ style?: BoardEdge['style']; color?: BoardEdge['color'] }`.

**5. Wire Canvas.tsx** (`src/renderer/src/canvas/Canvas.tsx`)

Five coordinated changes, following the exact pattern already established for nodes:

- Import `Edge as RFEdge`, `EdgeChange`, `applyEdgeChanges`, `Connection` from `@xyflow/react`; import `WbEdge`
- `const edgeTypes = { wb: WbEdge }` alongside `nodeTypes`
- `schemaEdges` useMemo: maps `boardEdges` → RF edges (`source: e.from`, `target: e.to`, `type: 'wb'`, `data: { style, color }`)
- `[edges, setEdges]` local state + effect to sync from `schemaEdges` (preserving selection state), mirrors node pattern
- `onEdgesChange`: calls `applyEdgeChanges` for RF local state; on `remove` changes calls `deleteEdge` in store
- `onConnect`: generates a `crypto.randomUUID()` id, calls store `addEdge`
- Pass `edges`, `edgeTypes`, `onEdgesChange`, `onConnect` to `<ReactFlow />`
- Set `connectionLineStyle={{ stroke: 'var(--color-secondary-fg)', strokeWidth: 1.5 }}` for the in-progress drag line

New edges created via drag-from-handle get no `style` or `color` (defaults to solid neutral). Style/color can be set by editing the board JSON until a style picker UI is added later.

### What does not change

- Board schema version (no structural change, just adding optional fields to `BoardEdge`)
- Node sub-components (`NativeFileBudNode`, `UnknownBudNode`, `ErrorBudNode`, `BudNodeInner`, `PetalBudNode`)
- All existing node creation, deletion, and positioning behavior
- The pointer-tool gate (`nodesConnectable={activeTool === 'pointer'}`) already ensures edges can only be drawn in pointer mode

### Open questions

- Handle visibility on hover: ReactFlow shows handles only on node hover by default. Confirm whether always-visible or hover-only is preferred. Hover-only is less noisy for dense boards.


## Edge connection targeting

**Bug:** Connections don't reliably land on the handle the user aimed at. Any handle should be able to be connected to any handle, except perhaps self loops on the same node. Also the preview doesn't match the resulting connection, even on this state, you may drop a connection on some handle and reactflow will show it as valid, but it will create a connection to a different one.

**Why it matters:** The user can't control which destination node the edge attaches to. For a knowledge-management canvas where spatial layout carries meaning, this is a real loss of expressiveness.

## Obsidian Vault Module

A module that recognizes an Obsidian vault dropped onto the canvas, displays it as an icon-personality node, and opens it in Obsidian on double-click.

### Why

Obsidian vaults are opaque directories — the OS has no native file association for them, so `app.getFileIcon()` would return a generic folder icon and `shell.openPath()` would open Finder/Explorer, not Obsidian. A dedicated module gives the node the correct icon, the correct launch behavior, and a meaningful warning when Obsidian isn't installed.

### Pieces

**3. Installation detection**

Add an IPC handler `app:check-protocol` that calls `app.getApplicationNameForProtocol(scheme)` and returns the app name or `null`.

- On module registration (or first render), the renderer calls `window.api.checkProtocol('obsidian://')`.
- If `null`: render a small warning badge on the icon node (amber dot, bottom-right corner).
- On double-click when unregistered: show a non-blocking notification — *"Obsidian is not installed. Download it at obsidian.md to open this vault."* Do not open a broken URI.
- If registered: bloom proceeds normally via `shell.openExternal`.

Cache the protocol check result in module render state — no need to IPC on every render.

### What does not change

- Board schema: `resource: "file:///..."` is already valid for external linked assets.
- Node schema: `type: "com.whitebloom.obsidian-vault"`, `kind: "bud"` — standard fields.
- HEP layer: no new read/save contract needed; this module has no in-app editor.
- All existing file-based module behavior.

### Open questions

- The warning badge competes with selection state visually. Decide whether the badge renders over or under the selection ring.
