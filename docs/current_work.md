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

## Mica window manager.

`Mica` is Whitebloom's generic window manager: a lightweight UI system for floating windows, named after the layered stone. It should behave like a tiny Quartz, but intentionally constrained for Whitebloom's calmer surface language. Arrangements is the first screen that should adopt it, but `Mica` should not be defined as Arrangements-only infrastructure.
- `Mica` owns floating window instances.
- A window instance must have its own id.
- `Mica` should be host-based: each screen that needs floating windows provides a `Mica` host region with its own bounds and policy.
- A host may choose whether it allows one window, multiple windows, or one window per kind.
- In v1, the Arrangements host should allow only one primary floating window at a time. Even if more windows are supported later, the ability to enforce "only one window of this kind" should remain.
- Opening a different bin while an Arrangements window is already open should retarget that same window to the new bin instead of spawning another one.
- Windows should remain screen-space relative to their host container, not world-space inside transformed content.
- Window position should persist when switching content within the same open window.
- The floating window layer should remain visually separate from the content layer beneath it.

**What `Mica` needs to manage.**

- Window identity: a UI-level `windowId`.
- Window kind: a generic discriminator such as `bin-view`, `inspector`, or other future window types.
- Window content routing: payload data owned by the feature using the window kind. For Arrangements v1, this is `kind: "bin-view"` with a referenced `binId`.
- Window geometry: at minimum `x` and `y`; likely also `width` and `height` even if resize is deferred.
- Window visibility lifecycle: open, retarget, close.
- Window focus policy: with one window this is simple, but the model should still preserve the idea that windows are focusable UI entities.
- Window chrome interactions: dragging by title bar, non-draggable controls inside the chrome, and safe pointer capture rules so canvas pan does not fight the window.
- Host coordination: the content layer and the window/overlay layer must remain separate so a floating window never accidentally inherits transforms from the underlying screen content.
- Renderer registration: features should be able to register how a given window kind is rendered inside a `Mica` host.
- Host policy: each host should be able to define limits such as single-window-only, one-window-per-kind, or unrestricted multi-window behavior.

**State model direction.**

- Build `Mica` as generic UI infrastructure rather than a special-case Arrangements store field.
- Keep domain state and UI state separate: bins remain content; windows remain presentation instances.
- Each host should own or scope the set of active windows that belong to it.
- Even with a single open window, model it as a window record rather than "the active bin."
- Feature-level payload changes should update a window's routed content, not recreate the window conceptually.
- Local per-window UI state should be considered explicitly: view mode, search query, selection, and last geometry.
- Arrangements should stop owning a bespoke `activeBinView` concept and instead talk to `Mica` through host-level open, retarget, move, and close actions.

**Behavior rules to settle before implementation.**

- Whether view mode is global to all bin windows or stored per window. Per window is probably cleaner.
- Whether search resets when changing bins. Resetting is likely less confusing.
- Whether selection always clears on bin switch. It probably should.
- Whether a host remembers window position across sessions or only while that host remains mounted.
- Whether future non-bin windows are in scope for the same manager. The state shape should leave room for that even if v1 implements only bin windows.
- Window chrome convention: if `Mica` adopts a left-side close control, that placement should become the long-term pattern for all Whitebloom windows and modals, not just Arrangements. The current app is not yet consistent here, so this should be treated as a normalization pass over time rather than a one-off exception.
- The close control should not be a literal macOS traffic light by default. Whitebloom should leave room for a custom close button that respects the same placement and interaction pattern while developing its own visual identity.
- How renderer registration works in practice: static registry, host-provided mapping, or explicit render prop wiring.
- Whether `Mica` state lives in one shared app store, separate host stores built on common primitives, or a hybrid model. Favor a generic subsystem with per-host scoping rather than a single global pile of unrelated window state.

**Why this is worth doing.**

- It keeps Arrangements from accreting one-off overlay behaviors.
- It gives Whitebloom a single window grammar instead of separate local patterns per feature.
- It creates a clean seam between feature content and floating UI surfaces.
- It lets Bin View feel movable and desktop-native without locking the architecture to Arrangements forever.
- It gives Whitebloom a named UI primitive that can be extended later without rethinking the architecture from scratch.

**Implementation plan.**

1. Define `Mica` as a generic subsystem rather than an Arrangements feature.
   - Create a shared `Mica` model for window records, host identity, geometry, focus, and lifecycle.
   - Model a window as a UI record with its own `id`, `kind`, routed payload, geometry, and visibility state.
   - Keep the shape generic enough for future window kinds even if v1 only implements `bin-view`.
   - Decide which pieces belong in persisted UI state versus transient session state.

2. Introduce the `MicaHost` concept.
   - Each screen that wants floating windows should provide a host region with explicit bounds.
   - A host should define its own policy: single-window-only, one-window-per-kind, or unrestricted multi-window.
   - A host should provide the overlay plane where `Mica` windows render.
   - A host should remain responsible for how its content layer and overlay layer coexist.

3. Define window renderer registration.
   - Choose how a host maps `window.kind` to a concrete renderer.
   - Keep feature-owned content local to the feature rather than embedding feature logic inside `Mica` core.
   - For Arrangements v1, register `bin-view` as the first concrete window kind.
   - Leave room for future kinds such as inspectors or previews without changing the core model.

4. Build the reusable `Mica` window shell.
   - Upgrade `PetalWindow` or extract from it so the shell becomes generic `Mica` chrome rather than Bin View chrome.
   - Add a left-side close control as the default window-closing affordance.
   - Keep the control pattern compatible with a future Whitebloom-specific button treatment.
   - Make the title bar the drag handle.
   - Exclude buttons, search fields, toggles, and any other interactive controls from drag initiation.
   - Preserve the current calm, reduced visual language: no minimize or maximize in v1.

5. Implement generic draggable window geometry.
   - Track live drag interaction locally for responsiveness and commit final geometry into `Mica` state.
   - Use pointer capture so drag remains stable even if the pointer leaves the title bar.
   - Clamp movement so the title bar cannot disappear completely outside the current host.
   - Keep the initial implementation to movement only; defer resizing until the rest of the system is stable.

6. Adopt `Mica` inside Arrangements as the first host.
   - Replace the special-case `activeBinView` model with host-scoped `Mica` usage.
   - Keep the existing panning desktop world for materials and bins.
   - Add a dedicated `Mica` overlay plane as a sibling layer above the desktop world.
   - Ensure the Arrangements host is screen-space relative to the desktop container, not transformed by camera pan or zoom.

7. Refactor Arrangements open and close behavior around `Mica`.
   - Double-clicking a bin should ask the Arrangements host to open or retarget a `bin-view` window.
   - If no Arrangements window exists, create one with default geometry and route it to the chosen bin.
   - If a compatible window already exists, preserve its identity and geometry while swapping its routed `binId`.
   - Closing the window should clear Arrangements window UI state without mutating bin/domain data.

8. Rework `BinView` to consume routed window content.
   - Make `BinView` render from a `Mica` window record and its routed payload, rather than from a global active-bin singleton.
   - Keep per-window presentation state explicit: view mode, search query, selection, and drag-over feedback.
   - Reset selection on bin switches.
   - Likely reset search on bin switches unless testing shows that persistence is more useful.
   - Preserve geometry and the window instance itself while switching bins from the sidebar.

9. Reconcile host-level window behavior with underlying screen interactions.
   - Prevent title-bar dragging from triggering gestures in the host content underneath.
   - Prevent clicks within a window from causing unwanted deselection or pan behavior in the host.
   - Preserve Arrangements drag-and-drop between desktop, bins, Trash, Sets Island, and Bin View.
   - Verify that a floating window does not block intended drop targets more than necessary.

10. Decide persistence boundaries and app-wide conventions.
   - Persist window geometry only where it helps the host feel stable across sessions.
   - Do not persist ephemeral state such as current selection.
   - Treat search query as session-local unless a stronger use case appears.
   - Persist view mode only if it improves continuity without surprising the user.
   - Treat `Mica` as the first concrete expression of a broader Whitebloom window pattern and plan a later consistency pass for existing windows and modals.

11. Verify Arrangements as the proving ground before extending `Mica`.
   - Test opening, retargeting, dragging, closing, and reopening the window.
   - Test bin switching from the sidebar while the window is in a moved position.
   - Test drag-and-drop from Bin View to desktop bins, Trash, and Sets Island, and from desktop into Bin View.
   - Test edge cases around pointer capture, offscreen movement, and keyboard delete behavior in Trash.
   - Only after this pass should `Mica` be considered ready for additional hosts, multiple windows, resizing, or new window kinds.

**Suggested implementation order.**

- Define the generic `Mica` model and host API.
- Build the shared window shell and drag behavior.
- Add renderer registration and host policy wiring.
- Adopt `Mica` inside Arrangements as the first host.
- Convert bin open/close flows to target the Arrangements host.
- Adapt `BinView` to routed window content.
- Reconcile interaction conflicts with desktop pan and drag-and-drop.
- Add persistence and perform a consistency pass.

**Out of scope for the first pass.**

- Multiple simultaneous floating windows.
- Window resizing.
- Minimize and maximize controls.
- Global cross-screen window sharing between unrelated hosts.
- Modal stacking rules beyond what is needed for a host-local floating window system.
- Non-bin window content types beyond what the state model and renderer registration should leave room for.
