# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.


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

Store board thumbnails beside board data as generated cache files, not inside the board JSON. For workspace boards, use a hidden thumbnail directory under the workspace root using a mirrored path structure. Quickboard thumbnails are deferred — the intended approach is inline embedding via wbhost URI, which keeps quickboards self-contained and portable. Until that lands, skip thumbnail generation for quickboards entirely.

Shape:
- workspace board: `<workspace>/.wbthumbs/<board-relative-path>.jpg`
  - e.g. board at `workspace/notes/meeting.wbb` → thumbnail at `workspace/.wbthumbs/notes/meeting.jpg`
  - mirrored structure is collision-safe across nested board directories and requires no lookup table

The thumbnail path is always derivable from the board path (workspace root + `.wbthumbs/` + relative board path, extension swapped to `.jpg`). No secondary index needed.

`.wbthumbs/` is generated cache and should not be committed. Workspace creation must write a default `.gitignore` that includes `.wbthumbs/` so workspaces that are (or become) git repos suppress it automatically. See step 2a below.

**2a. Workspace default `.gitignore`**

When a new workspace is created, write a `.gitignore` file at the workspace root (or append to an existing one) that suppresses generated cache directories:

```
.wbthumbs/
```

This must happen in workspace creation, not thumbnail generation, so the gitignore is present even before any thumbnail is ever written. If a `.gitignore` already exists at the workspace root, append the entry only if it is not already present.

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
- `src/main/services/workspace-files.ts` (workspace creation must write default `.gitignore`)
- `src/main/services/app-storage.ts`
- `src/main/services/recent-boards-store.ts` (new, when recent boards lands)
- `src/main/services/board-thumbnails.ts` (new)

### What stays unchanged

- Board schema/version: no new thumbnail field in board JSON.
- Board viewport semantics: existing `viewport` remains the source of truth for reopen position.
- Missing-thumbnail behavior: never block open/save UX on preview generation.

