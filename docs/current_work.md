# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---


## Organization: Groups and Arrangements

Two complementary features that together answer the question "how do I organize my board?" They share a mental model and should be specced together, but implemented in two phases: clusters first (canvas-only, no new modal), Arrangements second.

**UX reference: Linear.** Linear (linear.app) is a project management tool with a command palette (Cmd+K / TAB) that is the primary control surface for the entire app — not just search, but navigation, actions, and opening views. The palette filters as you type and surfaces any app state: tools, modals, commands. This is the model for Whitebloom's palette-as-launcher pattern (extend the palette from just tools to arbitrary commands).


### Phase 1: Clusters

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


### Subboards (deferred, design only)

A subboard is a bud node on the canvas whose resource is another `.wb.json` file. It represents true hierarchical containment: blooming opens the nested board. The parent board shows a live miniature preview of the child board inside the bud node.

This falls out naturally from the existing bud architecture — a board is a file, and a bud points to a file. No special schema is needed beyond registering a `com.whitebloom.board` module.

Key properties:
- The nested board has its own `brief`, its own inbox, and its own agent context.
- Brief hierarchy: workspace brief → parent board brief → cluster brief (if the subboard node is inside a cluster) → subboard's own brief. Narrowest-first.
- Agents can navigate the hierarchy by following `wloc:` references to `.wb.json` files.
- Promoting a cluster to a subboard: select a cluster, invoke "Promote to Subboard." The cluster's children move into a new `.wb.json`, the cluster node becomes a bud referencing it. One-way operation.

Defer implementation until clusters and Arrangements are shipped and stable.


---
