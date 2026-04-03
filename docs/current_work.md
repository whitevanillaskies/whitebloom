# Current Work: Image Node Support

Two features to implement: **drag-and-drop file support** (prerequisite) and **image nodes** (the main goal).

---

## Phase 1 — Drag & Drop Infrastructure

### 1.1 — Canvas drop handlers

STATUS: DONE.

File: `src/renderer/src/canvas/Canvas.tsx`

- Add `onDragOver` prop to `<ReactFlow>`: call `e.preventDefault()` and set `e.dataTransfer.dropEffect = 'copy'`. This is required to make the element a valid drop target.
- Add `onDrop` prop to `<ReactFlow>`: read `e.dataTransfer.files`, filter for image MIME types (`image/*`), call `screenToFlowPosition({ x: e.clientX, y: e.clientY })`, then dispatch `addNode` with `type: 'image'`.
- Guard: only handle drops when `activeTool === 'pointer'` or `activeTool === 'hand'`.

### 1.2 — Initial image size on drop

STATUS: DONE.

In the `onDrop` handler, create a temporary `Image` object to read `naturalWidth`/`naturalHeight` before creating the node. Cap the initial size to a max of a fraction of the current window size (perhaps 40%) on the longest side while preserving the aspect ratio. If the image can't load (path error, etc.), either avoid creating the node or delete it right after, and show an error modal. Create the node after the measurement resolves.

> Note: In Electron's renderer, `File.path` gives the full absolute disk path. No IPC needed for drop.

---

## Phase 2 — Image Node Component

### 2.1 — Component skeleton

STATUS: DONE.

Create `src/renderer/src/canvas/ImageNode.tsx` and `ImageNode.css`.

- Register as `nodeTypes.image` in `Canvas.tsx`.
- Props: standard RF custom node props — use `data.resource` (file path), `data.size`.
- Render `<img src={\`file://${data.resource}\`} decoding="async" />` inside a wrapper div sized to `data.size`.
- Apply CSS: `contain: layout paint;` on the wrapper to limit browser layout scope.
- Map image nodes in `Canvas.tsx`'s `schemaNodes` useMemo: pass `{ resource: n.resource, size: n.size }` as `data`. Image nodes have no `content`.

### 2.2 — Viewport-aware rendering (300–500ms debounce)

STATUS: DONE.

Inside `ImageNode`:

- Call `useViewport()` to get `{ x, y, zoom }`.
- Call `useStore(s => ({ width: s.width, height: s.height }))` to get canvas pixel dimensions.
- Maintain local `isVisible` state (start `true` to avoid flash on creation).
- `useEffect` watching `[x, y, zoom, xPos, yPos]`: start a 400ms debounced timeout that computes whether the node's screen-space bounding box intersects the viewport (expanded by a 15% buffer on each side). Set `isVisible` from the result. Clear the timeout on cleanup.
- When `!isVisible`: render a plain `<div>` placeholder with the same dimensions instead of the `<img>`. This unloads the image from the render tree without causing layout shift.

Bounding box check:
```
nodeScreenX = xPos * zoom + x
nodeScreenY = yPos * zoom + y
nodeScreenW = size.w * zoom
nodeScreenH = size.h * zoom
bufferX = width * 0.15
bufferY = height * 0.15

visible = nodeScreenX + nodeScreenW > -bufferX
       && nodeScreenX < width + bufferX
       && nodeScreenY + nodeScreenH > -bufferY
       && nodeScreenY < height + bufferY
```

### 2.3 — Double-click to open in system viewer

STATUS: DONE.

- Add IPC handler in `src/main/index.ts`: `ipcMain.handle('file:open', (_event, filePath: string) => shell.openPath(filePath))`.
- Add `openFile(filePath: string): Promise<void>` to the `api` object in `src/preload/index.ts`.
- Add the type declaration to `src/preload/index.d.ts`.
- `ImageNode` attaches `onDoubleClick` → calls `window.api.openFile(data.resource)`.
- Prevent double-click from propagating to ReactFlow (call `e.stopPropagation()`).

---

## Phase 3 — Proportional Resize

### 3.1 — Resize handle UI

Add corner drag handles (absolute-positioned `<div>` elements, 8×8px) to `ImageNode` at the four corners. Only the bottom-right corner is needed for proportional resize; optionally add all four for UX symmetry (each should resize toward the opposite corner as origin).

CSS: handles are `position: absolute`, outside the image clip, visible only on node hover/select.

### 3.2 — Resize interaction

Track resize in local React state within `ImageNode` (do not write to the store on every pointer move — only on release):

- `onPointerDown` on handle: record `startX`, `startY`, `startW`, `startH`, compute `aspectRatio = startW / startH`. Call `e.currentTarget.setPointerCapture(e.pointerId)`. Set local `isResizing = true`.
- `onPointerMove`: compute `dx = e.clientX - startX`, derive `newW = clamp(startW + dx, MIN_W, MAX_W)`, `newH = newW / aspectRatio`. Update local size state (this drives the wrapper div dimensions immediately for smooth feedback). Do **not** call `useReactFlow`'s `setNodes` or the store during drag.
- `onPointerUp`: call `updateNodeSize(id, newW, newH)` (already in the board store, no changes needed there). Clear `isResizing`.

Minimum size: 80×80px. No maximum enforced (users can make large images).

---

## Files Touched

| File | Change |
|---|---|
| `src/renderer/src/canvas/Canvas.tsx` | Add `onDragOver`/`onDrop` handlers; register `image` nodeType; map image nodes in `schemaNodes` |
| `src/renderer/src/canvas/ImageNode.tsx` | **Create** — image node component with viewport culling, double-click, resize |
| `src/renderer/src/canvas/ImageNode.css` | **Create** — styles for image node and resize handles |
| `src/main/index.ts` | Add `file:open` IPC handler via `shell.openPath` |
| `src/preload/index.ts` | Expose `openFile` API |
| `src/preload/index.d.ts` | Add `openFile` type declaration |

No changes needed to `BoardNode` types (already has `resource?: string`), the board store (already has `updateNodeSize`), or serialization (`handleSave` already skips non-text nodes).
