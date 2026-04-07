# Arrangements UI/UX Contract

- Arrangements is the workspace desktop.
- Boards and resources live here as material.
- Arrangements is not a file manager.
- The app manages files on disk; the user manages logical placement and meaning.
- Arrangements should feel calm, focused, and uncomplex.
- Avoid breadcrumbs, inspectors, dense chrome, or administrative clutter.

- Only material appears in Arrangements.
- Material means any workspace item with backing file substance.
- Boards are material.
- Bud-backed files are material.
- Leaf nodes are not material and never appear in Arrangements.

- The default Arrangements state is the desktop itself, not an `Unclassified` bin.
- Material may lie loose on the desktop with no bin assignment.
- Loose material is a valid, intentional state.

- Bins are broad logical containers for material.
- Bin assignment is virtual only and must never move files on disk.
- A material may belong to zero or one bin.
- Bins are flat and must never nest.
- Users create and name bins.
- `Trash` is the only required system bin.
- User bins may be placed anywhere on the Arrangements desktop.
- `Trash` is visually represented as a trash bin and stays fixed in place.

- Sending material to `Trash` is an explicit Arrangements action.
- Deleting a node from a board must not send its material to `Trash`.
- Emptying `Trash` permanently deletes the backing files and removes their Arrangements records.
- Before destructive deletion, the UI should surface whether the material is still referenced by any board.

- Sets are conceptual groupings, not containers.
- A material may be included in zero to many sets.
- Set inclusion is independent of bin assignment.
- Including material in a set must never affect its bin.
- Excluding material from a set must never imply deletion, trashing, or removal from the workspace.
- Sets may be hierarchical.
- Set membership is explicit and independent at every level.
- A material included in a child set is not automatically included in any ancestor set.
- A material included in a parent set is not automatically included in any child set.
- Hierarchy exists for organization and scoped operations, not implicit inheritance.

- Set language should reflect inclusion semantics.
- Use `Include in Set` and `Exclude from Set`.
- Avoid `Move to Set` or wording that implies exclusive ownership.
- Parent-level exclusion may offer a hierarchy-aware prompt when child memberships exist.
- Example: excluding from `Refs` may ask whether to also exclude the material from child sets.
- The default should preserve explicit child memberships unless the user opts into the broader exclusion.

- Smart sets are computed lenses over material.
- Smart sets are read-only.
- Smart sets are never stored directly; they are derived from workspace state.
- `Stale` is a core smart set: material not referenced by any board.
- Other smart sets may be added later without changing the core model.

- Boards and other material types should feel like peers in Arrangements.
- A board is one kind of material, not a special admin object above the system.
- Adding a board to a set includes the board only, never its referenced materials.
- Material membership is always explicit and non-recursive.
- Materials should render as simple icon + label objects on the desktop.
- Boards use a distinct icon but are otherwise treated like any other material.

- The main Arrangements surface should feel like a desktop or tabletop, not a sidebar library.
- Loose material is visible in the main field.
- Arrangements is a full-window view, not a settings-style modal.
- The desktop is an infinite canvas with minimap support.
- Loose material and user bins appear within that field.
- `Trash` remains visible as a fixed anchor.
- Sets must still be accessible from the desktop view so loose materials can be included without first entering a bin.
- Sets are presented through a persistent `Sets Island`.
- The `Sets Island` is visible and interactable from the Arrangements Desktop.
- The `Sets Island` holds the hierarchical set tree and smart sets.
- The `Sets Island` should not overpower the desktop metaphor.
- The `Sets Island` is docked to the left edge.
- The `Sets Island` is always visible in v1.
- The `Sets Island` is not floating.
- The `Sets Island` is not collapsible in v1.

- Double-click on desktop items is contextual.
- Double-clicking a bloomable material blooms it.
- Double-clicking a board opens that board.
- If opening a board would discard unsaved board edits, the app prompts first.
- Double-clicking a bin opens Bin View.

- Arrangements should preserve Whitebloom's core product architecture.
- Canvas is for thought in relation.
- Bloom is for opening a material into its full working surface.
- Arrangements is for stewardship of workspace material.

- Arrangements preserves camera position between sessions whenever possible.
- Materials should support drag and drop between Arrangements Desktop and Bin View.
- Drag and drop should allow emergent interactions without extra chrome.
- A material may be dragged from Bin View onto desktop bins.
- A material may be dragged from Bin View onto the desktop `Trash`.
- A material may be dragged from Bin View onto the `Sets Island`.
- A material may be dragged from the desktop into an open bin when that interaction is available.

- Bin View is the focused interior view of one bin.
- Bin View is intentionally uncomplex.
- Bin View has a main content area for the bin's materials.
- Bin View has a top bar for view mode and search.
- Bin View has a sidebar that mirrors all bins as a flat list.
- The sidebar exists primarily for reassignment between bins.
- Sets are not mirrored in the Bin View sidebar.
- The persistent `Sets Island` remains available from Bin View.
- Bin View should avoid breadcrumbs, inspectors, and file-manager complexity.
- Bin View may offer icon view, list view, and search.
- `Trash` opens in the same Bin View model as any other bin.
- In Trash Bin View, deletion via selection plus `Delete` is valid.

- `Sets Island` interactions should avoid reliance on single-click as a primary action.
- Double-clicking a set expands or collapses that set by one level.
- Hierarchy expansion should behave like a code editor project tree: one node at a time, no complicated drill-in model.
- Dragging a material onto a set includes that material in the set.
- Dragging a material out of a set context may surface an exclusion affordance such as `Exclude From Set`.
- Dragging a set out of the tree may surface a removal affordance such as `Remove Set`.
- Exclusion and removal affordances should appear only when relevant and should not add persistent clutter.
- Smart sets use a distinct icon but otherwise live in the same `Sets Island`.
- Smart sets should appear at the bottom of the island in their own section.
- Smart sets are read-only and not removable.

- Arrangements should expose board-aware context for every material.
- The user should be able to see whether a material is referenced by boards.
- The user should be able to jump from a material to the boards that use it.
- Staleness and board usage are more important than filesystem details.

- Quickboards have no Arrangements view because they have no workspace material layer.
