# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.

## Type errors

### Analysis

Four files accept a `size` prop they don't actually use, violating the `BudNodeProps` contract defined at `modules/types.ts:4-13`.

**The contract**: `BudNodeProps.size: Size` (`{ w: number; h: number }`) is required. `FocusWriterNode` is the conformant reference — it forwards `size.w` and `size.h` directly to `PetalBudNode`.

**Broken nodes:**
- `ObsidianBloomNode.tsx:27` — destructures `size` from `BudNodeProps`, ignores it, hardcodes `{ w: 88 }` at line 44.
- `SchemaBloomNode.tsx:15` — same pattern, hardcodes `{ w: 88 }` at line 36.
- `NativeFileBudNode.tsx:25` — has its own local props type (not `BudNodeProps`), still accepts `size`, ignores it, hardcodes `{ w: 88 }` at line 49.
- `PetalBudNode.tsx:2` — imports `Size` from shared types but defines its own inline shape and never uses the import. Dead import.

**Architectural decision** (resolved by reading the code): icon-style buds should be **size-driven**, same as the contract. Both `obsidianbloom/index.ts:11` and `schemabloom/index.ts:11` already declare `defaultSize: { w: 88, h: 88 }` — so the board initializes these nodes at 88px wide. The nodes just need to stop ignoring the value they're given. Height remains content-driven: `PetalBudNode` already makes `h` optional, so icon nodes should forward `size.w` only, leaving height free.

**Magic number problem**: `88` is also an unnamed magic number appearing in 5 places. `canvas-constants.ts` already establishes the pattern for this — `BUD_ICON_PX = 52` names the icon glyph size. The node container width needs the same treatment. These are two distinct design values (88 ≈ 52 + ~18px padding each side) and should remain separate named constants, not derived from each other. The constant belongs at the initialization point (`defaultSize` declarations), not inside node components — which should just use `size.w` from the prop.

### Fix plan

1. **`canvas-constants.ts`** — add `BUD_ICON_NODE_W = 88` with a doc comment mirroring the style of `BUD_ICON_PX`.

2. **`obsidianbloom/index.ts`** and **`schemabloom/index.ts`** — import `BUD_ICON_NODE_W` and replace the two `{ w: 88, h: 88 }` literals in `defaultSize` with `{ w: BUD_ICON_NODE_W, h: BUD_ICON_NODE_W }`.

3. **`PetalBudNode.tsx`** — remove the unused `import type { Size }` at line 2.

4. **`ObsidianBloomNode.tsx`** — replace the hardcoded `size={{ w: 88 }}` at line 44 with `size={{ w: size.w }}`. No import of the constant needed — the component just uses what the board passes.

5. **`SchemaBloomNode.tsx`** — same: replace hardcoded `size={{ w: 88 }}` at line 36 with `size={{ w: size.w }}`.

6. **`NativeFileBudNode.tsx`** — same: replace hardcoded `size={{ w: 88 }}` at line 49 with `size={{ w: size.w }}`.

7. Run `npm run typecheck:web` to confirm no new type errors surface.

After this, `88` exists in exactly one place (`canvas-constants.ts`). The module index files reference the constant for initialization; the node components are free of any hardcoded dimension.



## Viewport thumbnails for board tiles

Generate a small screenshot of the current visible canvas area when a board is saved, then use that image in start-screen recent boards and workspace-home board tiles. The thumbnail should reflect the persisted board viewport rather than an auto-fit overview. This makes the tile a "last seen view" preview, which matches how boards reopen today.

### Rules

- Capture the visible board area only, not the whole application window.
- The thumbnail is derived state, not canonical board data. The board JSON continues to own pan/zoom via `viewport`.
- Regenerate only on successful board save paths (explicit save, transient autosave, promotion to permanent board), not on every pan/zoom change.
- Exclude transient UI chrome from capture: toolbars, selection boxes, resize handles, slash menus, open bloom modals, confirm dialogs, and other overlays that would make tiles noisy.
- Missing thumbnails are acceptable; the shell should fall back to the current icon/placeholder tile.

### Steps

**1. Renderer capture helper**

Add a small renderer-side helper that captures the React Flow viewport/container to PNG or JPEG using `html-to-image` pinned to the stable version React Flow documents for export (`1.11.11`). The helper should target the bounded board viewport element and apply a filter that excludes shell/overlay elements.

Questions the helper should settle explicitly:
- exact capture target element (the viewport frame, not the whole `main` shell)
- fixed export dimensions for tiles, e.g. one landscape thumbnail size reused everywhere
- whether to use PNG for fidelity or JPEG for smaller disk usage

**2. Thumbnail file location + naming**

Store board thumbnails beside board data as generated cache files, not inside the board JSON. For workspace boards, use a hidden thumbnail directory under the workspace root. For transient quickboards, use a sibling/generated location under app data.

Suggested shape:
- workspace board: `<workspace>/.wbthumbs/<board-file-stem>.jpg`
- transient board: `userData/boards/.wbthumbs/<board-file-stem>.jpg`

The filename scheme must be collision-safe and stable across repeated saves. The path should be derivable from the board path so the shell can ask for it without maintaining a second lookup table.

**3. Main-process thumbnail write/read service**

Add main-process helpers to:
- derive thumbnail path from a board path
- create parent directories on demand
- write a base64/blob image payload received from the renderer
- delete or trash the thumbnail when the board is trashed
- answer whether a thumbnail exists and expose a safe URL/URI the renderer can display

This should stay separate from `writeBoard()` itself. Board JSON save and thumbnail persistence are related, but they are different artifacts with different failure tolerance.

**4. Preload + IPC surface**

Expose minimal thumbnail IPC from preload. Keep it narrow:
- save thumbnail for board path
- get thumbnail URL/path for board path
- optionally remove thumbnail for board path if trash/delete flows need it explicitly

Renderer should not write thumbnail files directly.

**5. Wire capture into save flows**

Integrate thumbnail generation immediately after successful board save/promotion flows in the renderer shell around the existing save logic.

Cases to cover:
- normal saved workspace/standalone board
- transient quickboard autosave
- transient quickboard promotion via save dialog
- promote quickboard into new workspace

Failure policy:
- board save succeeding must not be rolled back because thumbnail capture failed
- thumbnail failures should log and degrade silently to placeholder tiles

**6. Recent boards store uplift**

When implementing recent boards, include thumbnail resolution in the returned recent-board item model. The recent list should still be driven by path + openedAt; thumbnail presence is optional decoration.

Suggested item shape:
- `path`
- `openedAt`
- `thumbnailResource?`

Do not duplicate thumbnail metadata into `recent-boards.json`; derive it from board path at read time.

**7. Start screen tile rendering**

Update the start-screen recent-board tiles to render the thumbnail when present and fall back to the existing icon preview when absent. Keep the current metadata layout: board name, containing directory, and relative time.

The existing unsaved quickboards section can also consume thumbnails once transient-board thumbnail lookup exists, but that is secondary to the new recent-boards section.

**8. Workspace home tile rendering**

Update workspace-home board tiles to use the same thumbnail component/markup as recent-board tiles so preview behavior stays visually consistent across the shell.

The “new board” tile remains synthetic and should keep its current plus-card treatment.

**9. Visual hygiene hooks**

Add explicit CSS/data-hook markers for UI elements that must be excluded from capture. Do not rely on brittle class-name matching alone if the shell is expected to keep evolving.

Examples:
- `data-board-capture="exclude"` on overlays/chrome
- `data-board-capture="root"` on the viewport capture target

This keeps the capture filter maintainable.

**10. Trash / cleanup behavior**

Extend board trash/delete flows so the generated thumbnail travels with the board lifecycle. If a board is moved to trash, either:
- move its thumbnail alongside the trashed board copy, or
- discard the thumbnail and let it regenerate if the board is ever restored

Pick one rule and keep it consistent. Simpler first version: discard generated thumbnails on trash.

### Key files to touch

- `package.json`
- `src/renderer/src/canvas/Canvas.tsx`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/start-screen/StartScreen.tsx`
- `src/renderer/src/components/workspace-home/WorkspaceHome.tsx`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/main/ipc/register-board-ipc.ts`
- `src/main/ipc/register-app-ipc.ts`
- `src/main/services/workspace-files.ts`
- `src/main/services/app-storage.ts`
- `src/main/services/recent-boards-store.ts` (new, when recent boards lands)
- `src/main/services/board-thumbnails.ts` (new)

### What stays unchanged

- Board schema/version: no new thumbnail field in board JSON.
- Board viewport semantics: existing `viewport` remains the source of truth for reopen position.
- Missing-thumbnail behavior: never block open/save UX on preview generation.

