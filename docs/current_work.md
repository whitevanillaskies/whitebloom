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

## Window Chrome and Toolbar Refactor

The current `MicaWindow` API is carrying too much responsibility. It is acting as window shell, titlebar, toolbar surface, and toolbar control styling host at the same time. This makes simple usage easy but makes Finder-like layout composition awkward: grouped controls, intentional gaps, and toolbar-specific affordances such as search do not have a clear architectural home. The goal of this refactor is to separate window chrome from toolbar composition so Bin View and future windows can express toolbar layout deliberately.

### Track 1: Refactor What We Already Have

This track is about cleaning up the existing structure without changing the conceptual model yet.

- Audit `MicaWindow.tsx`, `MicaWindow.css`, and current toolbar consumers to identify what is true window chrome versus what is actually toolbar UI.
- Remove toolbar control styling rules from `MicaWindow.css`, especially generic descendant rules that style arbitrary `button` elements inside the window header.
- Move current button and search field presentation into dedicated reusable components or control-specific styles so the shell no longer owns their appearance.
- Introduce a small window-chrome vocabulary for the pieces `MicaWindow` should continue to own: frame, titlebar drag region, close control, title, sidebar split, and main content region.
- Rename `headerActions` to a more accurate intermediate slot such as `toolbar` if needed, while still allowing the current window implementations to keep working during the transition.
- Update Bin View to consume the extracted control primitives instead of depending on `MicaWindow`-owned button/search styling.
- Do a visual pass against `design_language.md` so the remaining titlebar chrome reads as premium macOS-inspired shell rather than boxed toolbar controls.

#### Track 1 Audit Findings

- `MicaWindow` currently conflates shell and controls. It owns frame and titlebar, which is correct, but it also styles arbitrary toolbar buttons and the search field, which is not. This is the core architectural problem.
- `BinView` is currently the only `MicaWindow` consumer. That makes this a good refactor target because we can narrow the shell contract before more windows depend on the wrong model.
- `BinView` is already expressing a Finder-like toolbar need: two related view-mode controls and one search field. The current `headerActions` slot can render them, but it cannot express grouping or spacing semantically.
- The app already has at least two distinct button primitives in practice:
- `PetalButton` for dialog and panel actions
- `PetalToolbarButton` for floating icon-only toolbar controls
- Several surfaces are still bypassing those primitives and styling buttons locally:
- `MicaWindow` titlebar actions and search
- `CanvasToolbar`
- `SettingsModal` navigation, close button, confirmation actions, and select-like controls
- `ArrangementsView` top bar back button
- The codebase is therefore missing a formal hierarchy of interaction roles, not missing buttons in general.

#### Proposed Primitive Hierarchy

Use macOS as the mental model: AppKit does not use one button class for every role. Dialog buttons, toolbar items, sidebar selections, close controls, and segmented controls are distinct roles even when they are all clickable.

- `PetalButton`
- Purpose: dialog and panel actions, especially confirm, cancel, save, destructive.
- macOS analogue: standard dialog `NSButton`.
- Current home: `PetalPanel` action rows and confirmation prompts.
- `PetalToolbarButton`
- Purpose: floating icon-only controls on canvas-adjacent surfaces.
- macOS analogue: compact toolbar or palette icon control, but for floating Whitebloom surfaces rather than window headers.
- Current home: SchemaBloom canvas toolbar.
- `WindowTrafficLightButton` or equivalent window-chrome control
- Purpose: close/minimize/zoom-style titlebar chrome. This belongs to window shell, not to toolbar primitives.
- macOS analogue: traffic-light window controls.
- Current home: `MicaWindow` close button, but currently styled ad hoc inside the shell CSS.
- `WindowToolbarButton`
- Purpose: icon-only or icon-leading controls that live inside a window toolbar.
- macOS analogue: `NSToolbarItem` button.
- Not yet implemented; currently faked by raw buttons inside `MicaWindow`.
- `WindowToolbarSegmented`
- Purpose: tightly grouped mutually exclusive view toggles such as icon/list.
- macOS analogue: segmented toolbar control used by Finder and many AppKit windows.
- Not yet implemented; currently faked as two independent buttons in `BinView`.
- `WindowToolbarSearch`
- Purpose: search field specifically designed for window-toolbar placement.
- macOS analogue: `NSSearchToolbarItem`.
- Not yet implemented; currently styled through `MicaWindow.css`.
- `TopbarNavButton` only if needed
- Purpose: lightweight app-level navigation such as the Arrangements back button.
- This should exist only if it proves materially different from the other primitives after refactor; otherwise it should be expressed through an existing primitive with a variant.

#### Immediate Refactor Targets

- Extract the `MicaWindow` close button into an explicit window-chrome control instead of leaving its look embedded in `MicaWindow.css`.
- Stop `MicaWindow` from styling descendant `button` elements inside `.mica-window__actions`; window shell CSS should style slots and layout only.
- Move `.mica-window__toolbar-search` out of `MicaWindow.css` into a dedicated control or temporary Bin View-specific style until `WindowToolbarSearch` exists.
- Replace the two loose `BinView` view-mode buttons with a temporary grouped control abstraction, even before full `WindowToolbar` exists, so the semantics stop implying unrelated actions.
- Decide whether `PetalToolbarButton` should remain canvas-specific or be generalized into a lower-level icon-button primitive with context-specific wrappers. Do not reuse it blindly for window toolbars without this decision.
- Audit `CanvasToolbar` and migrate it away from bespoke `.canvas-toolbar__button` styling so it either uses `PetalToolbarButton` consistently or becomes a clearer separate primitive.
- Audit `SettingsModal` for controls that should become reusable primitives:
- close affordance
- inline destructive confirmation actions
- select/radio field wrappers where duplication already exists
- Keep `PetalButton` scoped to dialog/panel actions. Do not let it become the universal answer for toolbar buttons, close controls, or sidebar rows.

#### Track 1 Implementation Plan For Button Primitives

- Implement `WindowTrafficLightButton` or equivalent first.
- Scope: replace the current ad hoc close button styling in `MicaWindow`.
- Responsibility: window chrome only, not toolbar controls.
- Follow-up: leave room for minimize/zoom later even if v1 only renders close.

- Implement `WindowToolbarButton` next.
- Scope: the standard clickable item used inside a window toolbar.
- Responsibility: icon-only and icon-leading toolbar actions inside windows.
- Constraint: do not reuse `PetalButton`; dialog actions and toolbar items should remain separate primitives.

- Implement `WindowToolbarSegmented` immediately after `WindowToolbarButton`.
- Scope: grouped mutually exclusive view controls such as icon/list.
- Responsibility: express semantic grouping before full `WindowToolbar` lands.
- First consumer: `BinView` view mode switcher.

- Implement `WindowToolbarSearch`.
- Scope: a toolbar-specific search control with the right height, density, and focus styling for a Finder-like header.
- Responsibility: remove search ownership from `MicaWindow.css`.
- First consumer: `BinView` search field.

- Evaluate `TopbarNavButton` only after the above are in place.
- Scope: app-level back/navigation controls such as the Arrangements top bar.
- Decision rule: only promote this to a primitive if it still feels materially distinct after the shell and toolbar controls are cleaned up.

- Keep `PetalButton` as the dialog/panel action primitive and tighten its intended usage in docs and call sites.
- First target surfaces: `PetalPanel` action rows and confirmation flows such as exit without saving.
- Non-goal: using `PetalButton` for window toolbar actions, titlebar chrome, or floating canvas tool icons.

- Keep `PetalToolbarButton` as the floating toolbar primitive for now, but audit it against the bespoke canvas toolbar implementation.
- First target surfaces: SchemaBloom canvas toolbar and general canvas-adjacent floating palettes.
- Decision rule: either migrate floating toolbars toward `PetalToolbarButton` or deliberately introduce a different canvas-toolbar primitive, but do not leave both patterns unconstrained.

- Defer any formal sidebar-row primitive until more surfaces exist.
- For now, sidebar rows in `BinView` and `SettingsModal` remain local implementations and should not drive the button taxonomy.

#### Refactor Rules for Track 1

- `MicaWindow` may own chrome, structure, and drag behavior.
- `MicaWindow` may not own toolbar button, search field, or segmented-control styling.
- A button primitive must be named by role, not merely by appearance.
- If two clickable controls live in different UX contexts and behave differently in macOS terms, they should not be forced into the same primitive just because they are both small buttons.
- Favor explicit wrappers over generic `variant` explosion. `PetalButton` and `PetalToolbarButton` should be siblings, not one mega-button with ten modes.

### Track 2: Refactor the Window Toolbar Into Its Own Thing

This track establishes `PetalToolbar` as a dedicated layout and composition surface inspired by Finder/AppKit toolbar behavior.

- Introduce a `PetalToolbar` component family separate from `MicaWindow`, with `MicaWindow` responsible only for shell and window structure.
- Define explicit toolbar layout primitives so composition is semantic instead of incidental:
- `PetalToolbar`
- `PetalToolbarGroup`
- `PetalSpacer` with fixed and flexible spacing behavior
- `PetalToolbarButton`
- `PetalToolbarSegmented` or an equivalent grouped toggle control for view mode switches
- `PetalToolbarSearch`
- Decide whether the toolbar lives inside a `toolbar` prop on `MicaWindow` or as an explicit child slot, favoring an API that makes the toolbar feel like a first-class surface instead of a miscellaneous action area.
- Ensure grouping and spacing are caller-controlled so layouts like “view toggles together, then gap, then search” are intentional and stable.
- Make the toolbar surface itself visually distinct from the titlebar when appropriate, while still feeling like one coherent Finder-like window header.
- Migrate `BinView` to the new `PetalToolbar` API and use it as the reference implementation for future windowed views.
- After migration, remove obsolete `headerActions` assumptions and any remaining toolbar-specific selectors from `MicaWindow`.

### Sequencing

- Start with Track 1 so we stop teaching the codebase that toolbar controls belong to the window shell.
- Move to Track 2 once the current controls are extracted and the shell surface is narrow and stable.
- Treat Bin View as the proving ground before expanding the toolbar model to other window types.

### Desired End State

- `MicaWindow` is a shell, not a toolbar framework.
- Toolbar controls own their own styling and behavior.
- Grouping, spacing, and alignment are explicit composition decisions.
- Finder-like window headers become straightforward to build instead of awkward to fake.
