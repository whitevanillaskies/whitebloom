# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---


## Organization: Groups and Arrangements

Two complementary features that together answer the question "how do I organize my board?" They share a mental model and should be specced together, but implemented in two phases: clusters first (canvas-only, no new modal), Arrangements second.

**UX reference: Linear.** Linear (linear.app) is a project management tool with a command palette (Cmd+K / TAB) that is the primary control surface for the entire app — not just search, but navigation, actions, and opening views. The palette filters as you type and surfaces any app state: tools, modals, commands. This is the model for Whitebloom's palette-as-launcher pattern (extend the palette from just tools to arbitrary commands).


### Phase 1: Clusters (DONE)

STATUS: DONE

A cluster is a visual grouping of nodes on the canvas. It is not a file, not a module, not a subboard — it is a lightweight annotation that moves its children and communicates organizational intent to both humans and agents. It's like Houdini's network box.

**Schema.** Clusters live in the `nodes` array with `kind: "cluster"`:

```json
{
  "id": "cluster-1",
  "kind": "cluster",
  "label": "Auth subsystem",
  "brief": "Everything related to authentication: login, session, token refresh.",
  "children": ["node-1", "node-2", "node-3"],
  "color": "blue"
}
```

- `children` — array of node IDs contained in this cluster. Children remain in the top-level `nodes` array at their absolute board coordinates. The cluster does not wrap them in a nested structure.
- `brief` — optional agent context scoped to this cluster. When an agent is invoked with a cluster as scope, it receives workspace brief + board brief + cluster brief + only the child nodes.
- `color` — one of the design token accent colors (`blue`, `pink`, `red`, `purple`, `green`). Used for the border and label background.

**Positions are absolute.** Children are always stored at their true board coordinates, not relative to the cluster origin. Dragging the cluster translates all children by the delta. No coordinate frame indirection.

**Visual treatment.** The cluster renders as a labeled rectangle behind its children, using the floating surface pattern (light fill, thin border in the cluster color, no backdrop-filter — it's not physically floating). The label sits in the top-left corner inside the border. The border uses the cluster color at reduced opacity so it reads as an organizational boundary, not a UI chrome element.

**Edges cross cluster boundaries freely.** A cluster is not a namespace. An edge from node-1 (inside cluster A) to node-7 (outside) is fully valid. The cluster is a visual annotation, not a semantic isolation boundary.

**Agent context boundary.** The cluster `brief` enables scoped agent passes. Asking an agent to "work on the auth cluster" gives it a bounded context: the cluster brief as the primary directive, and only the child nodes as the graph it operates on. This is a significant improvement over full-board agent passes for large boards.

### Phase 2: Arrangements

The Arrangements view is the workspace desktop. Boards and resources live here as material. It is not a canvas feature and not a file manager — it is a dedicated, full-window view accessed via the palette or keyboard shortcut where the app manages files on disk and the user manages logical placement and meaning. It should feel calm, focused, and uncomplex.

**What goes in Arrangements: material only.** Material means any workspace item with backing file substance. This includes:
- Any bud-backed file (markdown, schema, image, etc.)
- Boards (`.wb.json` files) — a board is material too
- Linked files are materials too. Whether they appear as normal materials or with a link arrow to show they're not local is irrelevant. A picture is material whether it lives locally or points to some external file.

Leaf nodes (text, sticky notes) are not material. They have no workspace file lifecycle and never appear in Arrangements.

**The default state is the desktop itself.** There is no `Unclassified` bin. A material may simply lie loose on the Arrangements desktop with no bin assignment. This is a valid, intentional state.

**Adding a board to a set adds the board only.** If a board references ten images and five markdown files, including that board in a set does not pull in any of its referenced materials. Membership is always a single explicit action per item. Non-recursive.

**Bins — broad placement, exclusive, flat.**

- A material belongs to zero or one bin.
- Bin assignment is virtual only. It must never move files on disk.
- User bins are named by the user and never nest.
- User bins may be placed anywhere on the Arrangements desktop.
- `Trash` is the only required system bin.
- `Trash` is visually represented as a trash bin and stays fixed in place.
- Deleting a node from the canvas does not move its material to Trash. The material stays wherever it already lives in Arrangements and may become stale.
- Sending material to Trash is an explicit Arrangements action.
- Emptying Trash permanently deletes files from disk and removes their Arrangements records.
- Before destructive deletion, the UI should surface whether the material is still referenced by any board.

**Sets — conceptual, non-exclusive, hierarchical.**

- A material can be included in any number of sets simultaneously.
- Sets can nest arbitrarily. A set "Q2" can contain a child set "Sprint 3".
- Sets are always manual. The user includes materials in them explicitly.
- A material in a set retains its bin assignment independently.
- Set membership is explicit and independent at every level.
- A material included in a child set is not automatically included in any ancestor set.
- A material included in a parent set is not automatically included in any child set.
- Hierarchy exists for organization and scoped operations, not implicit inheritance.
- Use inclusion language: `Include in Set`, `Exclude from Set`.
- Avoid `Move to Set` or wording that implies exclusive ownership.
- Parent-level exclusion may offer a hierarchy-aware prompt when child memberships exist.
- Example: excluding from `Refs` may ask whether to also exclude the material from child sets.
- The default should preserve explicit child memberships unless the user opts into the broader exclusion.

- Internationalization note: In Spanish, Set is "Grupo" which should not be confused with Clusters. Clusters should be translated as "Racimos." 

**Smart sets — computed, read-only.**

- `Stale` — material not referenced by any `*.wb.json` in the workspace. Computed by scanning all board files. Stale material retains its bin assignment; the user decides whether to trash it.
- `Linked` — materials with `file:///` URIs (externally linked, not workspace-owned). The natural home for the "Import to Local" action.
- Smart sets are never stored — they are derived on demand. They cannot be modified.

**Accessing Arrangements.**

- Palette (TAB): type "arr" or "arrangements" → select → Arrangements opens as a full-window view.
- Right-click any eligible node on the canvas → "Add to set..." → opens Arrangements with that node pre-selected, or a quick inline set-picker for the micro-action case.
- Keyboard shortcut (TBD).

**Arrangements desktop layout.**

Arrangements is a full-window infinite canvas with minimap support.
- Main field: the Arrangements desktop itself — loose material and user bins live here as icon + label objects.
- `Trash` stays visible as a fixed anchor.
- Boards use a distinct icon but are otherwise treated like any other material.
- Sets are presented through a persistent `Sets Island`.
- The `Sets Island` remains visible and interactable from the Arrangements Desktop.
- The `Sets Island` holds the hierarchical set tree and smart sets.
- Loose materials can be included in sets directly from the desktop via the `Sets Island`.
- The `Sets Island` is docked to the left edge.
- The `Sets Island` is always visible in v1.
- The `Sets Island` is not floating and not collapsible in v1.

The main plane should feel more like a desktop or tabletop than a file browser.

**Desktop interactions.**

- Double-clicking a bloomable material blooms it.
- Double-clicking a board opens that board.
- If opening a board would discard unsaved board edits, the app prompts first.
- Double-clicking a bin opens Bin View.
- Camera position should persist whenever possible.
- Materials should support drag and drop between Arrangements Desktop and Bin View.
- A material may be dragged from Bin View onto desktop bins.
- A material may be dragged from Bin View onto desktop `Trash`.
- A material may be dragged from Bin View onto the `Sets Island`.
- These interactions should exist as natural affordances without extra clutter.

No canvas interaction while Arrangements is open. It is a focused management task.

**Bin View.**

Opening a bin enters Bin View: a focused interior view of one bin. It should be Finder-like in clarity but intentionally reduced and uncomplex.
- Top bar: view mode toggle and search.
- Main content area: the bin's materials.
- Sidebar: all bins as a flat mirrored list.
- The sidebar exists primarily so materials can be reassigned between bins.
- Sets are not mirrored in the Bin View sidebar.
- The persistent `Sets Island` remains visible and interactable from Bin View.
- Avoid breadcrumbs, inspectors, and file-manager complexity.
- Features should stay minimal: icon view, list view, and search are enough for v1.
- Trash uses the same Bin View model.
- In Trash Bin View, deletion via selection + `Delete` is valid.

**Sets Island interactions.**

- Avoid relying on single-click as a primary action.
- Double-clicking a set expands or collapses that set by one level.
- Hierarchy expansion should behave like a code editor project tree.
- Dragging a material onto a set includes that material in the set.
- Dragging a material out of a set context may surface an exclusion affordance such as `Exclude From Set`.
- Dragging a set out of the tree may surface a removal affordance such as `Remove Set`.
- These affordances should appear only when relevant and should not add persistent clutter.
- Smart sets use a distinct icon but otherwise live in the same `Sets Island`.
- Smart sets appear at the bottom in their own section.
- Smart sets are read-only and not removable.

**Storage.** Arrangements state lives in an app-specific workspace file (see `deferred_work.md`), not in board CoreData. Smart sets are not stored. Quickboards have no Arrangements view — the modal is unavailable without a workspace.


### Phase 2 Implementation Plan

#### Pre-work (decisions and scaffolding before any UI)  (DONE)

**1. State file: `.garden`** (DONE)

STATUS: TEST OK.

Arrangements persistence lives in `.garden` at the workspace root — a dotfile parallel to `.wbconfig`. It is not part of the open CoreData spec and not required by third-party board readers. Smart sets are not stored here; they are derived on demand.

Schema covers: `bins`, `sets`, `memberships`, `desktopPlacements`, `cameraState`, `trashContents`. Material identity uses workspace-relative `wloc:` paths as stable keys.

**2. `AppView` extension** (DONE)

STATUS: TEST OK.

Add `'arrangements'` to the `AppView` union in `App.tsx`. Arrangements is a peer view, not a modal or canvas overlay. The view switch is a simple `setView('arrangements')` call.

**3. Navigation decisions (settle before UI build)** (DONE)

STATUS: TEST OK.

- Palette command available from board: type "arr" or "arrangements".
- Keyboard shortcut: `Cmd+Shift+A` / `Ctrl+Shift+A` as a placeholder, finalize later — does not block implementation.
- Dirty-board gate: opening Arrangements from a dirty board uses the same save/discard/cancel prompt already present for other view transitions. No new behavior needed.
- Return path: Arrangements carries a `returnView` reference so back-navigation lands correctly (board or workspace home).

**4. Material enumeration rules** (DONE)

STATUS: TEST OK.

v1 uses a hybrid approach:
- Filesystem scan of `blossoms/` and `res/` for workspace-owned `wloc:` material.
- Board scan for `file:///` references to populate the `Linked` smart set.
- Top-level `*.wb.json` boards from the existing `workspace-files.ts` service.

All three sources feed the material list. Stale computation (materials not referenced by any board) is deferred to v1.1 — it requires a full reference index and does not block the core Arrangements surface.

**5. Arrangements Zustand store** (DONE)

STATUS: TEST OK.

Dedicated store (not local component state) given the state surface area. Shape:
```ts
{
  materials: ArrangementsMaterial[]      // all discovered workspace material
  bins: Bin[]                            // user bins + system Trash
  sets: SetNode[]                        // hierarchical set tree
  memberships: SetMembership[]           // material ↔ set relationships
  binAssignments: Record<materialKey, binId>
  desktopPlacements: Record<materialKey, { x: number; y: number }>
  cameraState: { x: number; y: number; zoom: number }
  activeBinView: string | null           // null = desktop; binId = Bin View
}
```
Smart sets (`Stale`, `Linked`) are derived selectors, not stored state.

**6. IPC surface** (DONE)

STATUS: OK.

Add to `register-app-ipc.ts` and `preload/index.ts`:
- `arrangements:read` — load `.garden` for the current workspace
- `arrangements:write` — persist `.garden`
- `arrangements:enumerate-material` — filesystem + board scan returning material list
- `arrangements:trash-empty` — destructive delete of trashed materials from disk
- `arrangements:referenced-by` — for a given material path, return which boards reference it (used for pre-deletion warning; scoped scan, not a global cache)

---

#### Logic / Structural Work (DONE)

Build in this order:

1. (STATUS: DONE, TEST OK) **`.garden` service** (`src/main/services/garden-store.ts`) — read/write JSON, with safe atomic write (write to `.garden.tmp`, rename). Schema validation on read; corrupt file falls back to empty state with a warning.

2. (STATUS: DONE, TEST OK) **Material enumerator** (`src/main/services/workspace-material.ts`) — scans `blossoms/` and `res/` for non-thumbnail files, reads top-level `*.wb.json` list, returns a flat `ArrangementsMaterial[]` with type, `wloc:` key, display name, and file extension. Board scan for `file:///` URIs runs in the same pass.

3. (STATUS: DONE, TEST OK) **Reference checker** — on-demand scan of all `*.wb.json` in the workspace for references to a specific material key. Called only at trash-empty time or explicit "referenced by" UI query. Not cached in v1.

4. (STATUS: DONE, TEST OK) **Register IPC channels** in `register-app-ipc.ts` and expose through `preload/index.ts`.

5. (STATUS: DONE, TEST OK) **Arrangements store** — implement the Zustand store with actions: `loadArrangements`, `saveArrangements`, `assignToBin`, `removeFromBin`, `includeInSet`, `excludeFromSet`, `moveMaterialOnDesktop`, `moveBinOnDesktop`, `sendToTrash`, `emptyTrash`, `createBin`, `deleteBin`, `createSet`, `deleteSet`, `setCamera`.

6. (STATUS: DONE, TEST OK) **Palette integration** — add "Open Arrangements" command to the `Tab` palette in `Canvas.tsx` and to the workspace home shortcut surface. Both call `setView('arrangements')` on the app view state.

---

#### UI Build

Build in this order, shipping incrementally:

##### 1. Arrangements view shell (DONE)
a full-window `<div>` rendered when `view === 'arrangements'`. 

##### 2.1 PetalIsland component (DONE)
new addition to the Petal component library. A non-modal, non-floating docked panel with its own rounded, elevated surface. Inspired by JetBrains Islands: each tool window is a discrete "island" with its own background, rounded frame, and thin border — giving it visual identity without relying on backdrop-filter or heavy shadows. Unlike `PetalPanel` (which is a centered floating modal with overlay), `PetalIsland` is always-present, embedded in layout flow, and carries no overlay or dismiss behavior. It accepts a `title` slot and a `children` content area. Add to `petal/index.ts`.

##### 2.2 PetalWindow component (DONE)
also new to the Petal library. A Finder-window-on-the-desktop primitive: has window chrome (title bar, back/close button, view toggle slot, search slot), sits *on top of* the Arrangements desktop surface without overlaying it or blocking surrounding elements. No backdrop, no modal behavior, no dismiss-on-outside-click. The desktop behind and around it remains fully visible and interactable — desktop bins, Trash, and the Sets Island all stay live as drag targets. Think of it as an application window placed on a tabletop: it occupies space within the content zone but the tabletop itself is still there. Structurally distinct from `PetalPanel` (modal overlay) and `PetalContainer` (docked layout island). Add to `petal/index.ts`.

##### 3. Desktop Island (DONE)
main content for the Arrangements view. Contains the actual area for arranging materials.

##### 4. Sets Island (DONE)
left-docked `PetalContainer`. Contains the hierarchical set tree (expandable like a code editor project tree) and a separate smart sets section at the bottom. Double-click expands/collapses one level. Drag target for materials. Smart set entries are read-only. `Linked` smart set shows in v1; `Stale` deferred.

##### 5. Material items on desktop (DONE)
icon + label layout objects placed at `desktopPlacements` coordinates. Boards use a distinct icon; other materials use file-type icons from the existing `getSystemFileIcon` IPC. Selection state with keyboard `Delete` to assign to Trash. Double-click dispatches bloom (material) or board open.

##### 6. Bins on desktop (DONE)
same icon + label treatment as material items, but typed as bins. `Trash` is a fixed anchor (bottom-right or equivalent). User bins are repositionable. Double-click enters Bin View.

##### 7. Bin View
rendered as a `PetalWindow` sitting on the Arrangements desktop. Does not replace or obscure the desktop; bins, Trash, and the Sets Island remain visible and interactable around it. Window chrome: back button (returns to desktop), view mode toggle (icon/list), search input. Main content: the bin's materials. Sidebar inside the window: flat list of all bins for drag-target reassignment. Trash Bin View is the same model; selection + `Delete` triggers permanent deletion with reference warning before executing.

##### 8. Drag and drop
wire HTML5 drag across desktop ↔ bins ↔ Trash ↔ Sets Island. Affordances appear on hover during drag; no persistent clutter.

---

#### Appearance Pass

- Base field: `WorkspaceHome.css` visual language — calm, low-chrome, tabletop feel.
- `PetalContainer` (Sets Island): slightly elevated background (`--color-surface-raised` or equivalent), `var(--radius-border-frame)` rounded corners, thin `1px` border at reduced opacity. No backdrop-filter. Own background distinct from the Arrangements field — the "island" quality comes from the layered surface, not from blur or heavy shadow.
- `PetalWindow` (Bin View): looks like a macOS application window placed on the tabletop — same elevated background as `PetalContainer`, visible title bar with chrome, `var(--radius-border-frame)` corners, a slightly more prominent border or shadow to read as "lifted off" the desktop surface beneath it. Sized to occupy a substantial portion of the main content zone without covering the Sets Island. Desktop elements outside the window remain at normal opacity and interactable.
- Material items: generous spacing, icon dominant, label secondary. Avoid card-per-item boxing — items read as placed objects on a surface, not rows in a list.
- Boards: distinct icon (board/canvas symbol), same behavioral treatment as other materials.
- Bin icons: consistent with material icon scale. Trash uses a trash symbol.
- Do a final consistency pass against `design_language.md` — no over-rounding, no unnecessary floating effects, no modal-like chrome.

---

#### What Remains Open

- Final keyboard shortcut (placeholder: `Cmd+Shift+A` / `Ctrl+Shift+A`).
- Whether material icons use native system file icons (existing IPC) or a Whitebloom icon set. Lean on system icons for file-backed materials in v1.
- `Stale` smart set — deferred to v1.1, requires full reference index.
- "Add to set..." right-click entry from canvas nodes — deferred until Arrangements Desktop is stable.


### Subboards

A subboard is a bud node on the canvas whose resource is another `.wb.json` file. It represents true hierarchical containment: blooming opens the nested board. The parent board shows a live miniature preview of the child board inside the bud node.

This falls out naturally from the existing bud architecture — a board is a file, and a bud points to a file. No special schema is needed beyond registering a `com.whitebloom.board` module.

Key properties:
- The nested board has its own `brief`, its own inbox, and its own agent context.
- Brief hierarchy: workspace brief → parent board brief → cluster brief (if the subboard node is inside a cluster) → subboard's own brief. Narrowest-first.
- Agents can navigate the hierarchy by following `wloc:` references to `.wb.json` files.
- Promoting a cluster to a subboard: select a cluster, invoke "Promote to Subboard." The cluster's children move into a new `.wb.json`, the cluster node becomes a bud referencing it. One-way operation.

Defer implementation until clusters and Arrangements are shipped and stable.


---
