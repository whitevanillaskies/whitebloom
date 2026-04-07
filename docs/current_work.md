# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---


## Organization: Groups and Arrangements

Two complementary features that together answer the question "how do I organize my board?" They share a mental model and should be specced together, but implemented in two phases: clusters first (canvas-only, no new modal), Arrangements second.

**UX reference: Linear.** Linear (linear.app) is a project management tool with a command palette (Cmd+K / TAB) that is the primary control surface for the entire app — not just search, but navigation, actions, and opening views. The palette filters as you type and surfaces any app state: tools, modals, commands. This is the model for Whitebloom's palette-as-launcher pattern (extend the palette from just tools to arbitrary commands).


### Phase 1: Clusters

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

#### Phase 1 implementation plan

This is implementable in a focused pass, but not quite "just add a new node type." It touches schema typing, board-store mutations, React Flow adaptation, canvas rendering order, selection/drag behavior, and creation affordances. Best approach: ship a canvas-first vertical slice, then tighten edge cases.

**1. Extend the board schema and types.**

STATUS: DONE.

- Add `kind: "cluster"` to the board node union instead of forcing clusters through the existing bud/leaf shape.
- Define cluster-specific fields: `label`, optional `brief`, `children`, `color`, `position`, `size`, authorship timestamps.
- Keep cluster children as plain node IDs referencing siblings in the same top-level `nodes` array.
- Preserve board version at `3` for now unless we explicitly decide schema additions require a bump immediately.

**2. Add store-level cluster mutations before UI work.**

STATUS: DONE.

- Add helpers to create, update, and delete clusters.
- Add a single "translate cluster" mutation that moves the cluster and all child nodes by the same delta.
- Add membership operations: create cluster from selected nodes, add node to cluster, remove node from cluster.
- Decide and enforce the v1 invariant that a node may belong to at most one cluster. This keeps drag semantics simple and avoids ambiguous rendering.
- On node deletion, automatically remove the deleted ID from any cluster `children` arrays.

**3. Teach the canvas adapter about clusters.**

STATUS: DONE.

- Add a dedicated React Flow node type for clusters instead of pretending they are buds or leaves.
- Derive cluster bounds from stored `position` + `size`, while children keep absolute coordinates.
- Render clusters behind ordinary nodes and keep edges free to cross boundaries.
- Make sure save/load round-trips preserve cluster data without special casing elsewhere.

**4. Implement cluster visuals as a lightweight canvas annotation.**

STATUS: DONE.

- Build a `ClusterNode` with the floating-surface treatment from the spec: soft fill, thin tinted border, internal top-left label chip.
- Use the existing accent token family for `blue`, `pink`, `red`, `purple`, `green`.
- Keep the cluster visually quiet: it should read as board organization, not as an interactive card competing with real nodes.

**5. Implement drag and selection semantics carefully.**

STATUS: DONE.

- Dragging a cluster should move every child by the same delta and persist all resulting absolute positions.
- Selecting a cluster should not implicitly select all children in v1; treat movement as the special grouped behavior and keep selection semantics simple.
- Dragging a child should not move the cluster; instead, cluster membership remains until explicitly changed.
- If a child is dragged fully outside the cluster bounds, do nothing automatically in v1. Auto-eject sounds nice but creates surprise and extra policy questions.

**6. Add a minimal creation flow.**

STATUS: DONE.

- Palette action: `Create Cluster`.
- Better palette action: `Cluster Selected Nodes` when there is an active multi-selection.
- First pass can create a default labeled cluster with the current selection's bounding box plus padding.
- Editing cluster label/brief/color can live in the existing board-side UI pattern rather than requiring a new modal.

**7. Define v1 bounds behavior explicitly.**

STATUS: DONE.

- Store cluster `position` and `size` directly rather than recomputing them from children on every render.
- On creation from selected nodes, initialize bounds from child extents + padding.
- When children move independently later, do not auto-resize the cluster in v1.
- Add an explicit future action like `Fit Cluster to Children` instead of hidden auto-magic.

**8. Leave agent-scoped behavior schema-ready but implementation-light.**

- Store `brief` now so the data model is correct.
- Do not block phase 1 on agent integration unless the agent entrypoint already exists and is easy to thread through.
- If agent scope wiring is already near at hand, scope should be: workspace brief + board brief + cluster brief + child nodes only.

**9. Verify with a tight acceptance pass.**

- Create/save/reopen a board with multiple clusters.
- Drag cluster, verify all child coordinates persist correctly.
- Delete child, verify cluster membership cleans up.
- Connect edges across cluster boundaries.
- Open old boards with no clusters and confirm nothing regresses.

**Recommended implementation order in code:** shared types -> board store invariants/mutations -> cluster node component/CSS -> canvas mapping and drag behavior -> palette affordance -> persistence verification.

### Phase 2: Arrangements

The Arrangements view is a modal management interface for organizing workspace resources into bins and sets. It is not a canvas feature — it lives in a dedicated modal accessed via the palette or keyboard shortcut. The canvas shows clusters and subboards; organizational structure lives in Arrangements.

**What goes in Arrangements: buds with backing files only.** Only nodes that reference a file on disk are eligible for bins and sets. This includes:
- Any bud (markdown, schema, image, etc.)
- Boards (`.wb.json` files) — a board is a file and a valid resource to organize

Leaf nodes (text, sticky notes) are not eligible. They have no file lifecycle, no path, nothing to organize at the workspace level.

**Adding a board to a set adds the board only.** If a board references ten images and five markdown files, adding that board to a set does not pull in any of its resources. Membership is always a single explicit action per item. Non-recursive.

**Nothing is auto-added to sets.** The user decides what enters a set. The system never populates sets automatically. (Bins are different — new resources land in `Unclassified` by default, which is a system bin. But sets are always user-initiated.)

**Bins — exclusive ownership, flat.**

- A resource belongs to exactly one bin.
- System bins (read-only): `Unclassified` (default for all new resources), `Trash` (soft delete).
- User bins: named by the user, no nesting. Examples: "Boards", "Images", "References", "Data".
- Deleting a node from the canvas does not move its resource to Trash. The resource stays in its bin and may become stale. Trash is an explicit user action inside Arrangements.
- Emptying Trash permanently deletes files from disk and removes their records.

**Sets — non-exclusive, hierarchical.**

- A resource can appear in any number of sets simultaneously.
- Sets can nest arbitrarily. A set "Q2" can contain a child set "Sprint 3".
- Sets are always manual. The user drags resources into them.
- A resource in a set retains its bin assignment independently.

**Smart sets — computed, read-only.**

- `Stale` — resources not referenced by any `*.wb.json` in the workspace. Computed by scanning all board files. Stale resources retain their bin assignment; the user decides whether to trash them.
- `Linked` — resources with `file:///` URIs (externally linked, not workspace-owned). The natural home for the "Import to Local" action.
- Smart sets are never stored — they are derived on demand. They cannot be modified.

**Accessing Arrangements.**

- Palette (TAB): type "arr" or "arrangements" → select → modal opens.
- Right-click any eligible node on the canvas → "Add to set..." → opens Arrangements with that node pre-selected, or a quick inline set-picker for the micro-action case.
- Keyboard shortcut (TBD).

**Arrangements modal layout.**

The modal follows the standard modal surface pattern from the design language. Two-panel layout:
- Left panel: bin list + set tree (hierarchical). Drag targets.
- Right panel: resources in the selected bin or set, shown as a grid or list. Draggable into bins/sets on the left.

The split is conceptually similar to a music library: left panel is the "sidebar" (playlists = sets, library sections = bins), right panel is the track list for the selected view.

No canvas interaction while the Arrangements modal is open. It is a focused management task.

**Storage.** The `blossoms-garden.json` file at the workspace root (per the Arrangements spec in `deferred_work.md`) stores bins, sets, and resource metadata. Smart sets are not stored. Quickboards have no Arrangements view — the modal is unavailable without a workspace.


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
