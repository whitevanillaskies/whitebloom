# Arrangements UI/UX Contract

- Arrangements is the workspace desktop.
- Boards and resources live here as material.
- Arrangements is not a file manager.
- The app manages files on disk; the user manages logical placement and meaning.

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

- Sending material to `Trash` is an explicit Arrangements action.
- Deleting a node from a board must not send its material to `Trash`.
- Emptying `Trash` permanently deletes the backing files and removes their Arrangements records.
- Before destructive deletion, the UI should surface whether the material is still referenced by any board.

- Sets are conceptual groupings, not containers.
- A material may be included in zero to many sets.
- Set inclusion is independent of bin assignment.
- Including material in a set must never affect its bin.
- Excluding material from a set must never imply deletion, trashing, or removal from the workspace.

- Set language should reflect inclusion semantics.
- Use `Include in Set` and `Exclude from Set`.
- Avoid `Move to Set` or wording that implies exclusive ownership.

- Smart sets are computed lenses over material.
- Smart sets are read-only.
- Smart sets are never stored directly; they are derived from workspace state.
- `Stale` is a core smart set: material not referenced by any board.
- Other smart sets may be added later without changing the core model.

- Boards and other material types should feel like peers in Arrangements.
- A board is one kind of material, not a special admin object above the system.
- Adding a board to a set includes the board only, never its referenced materials.
- Material membership is always explicit and non-recursive.

- The main Arrangements surface should feel like a desktop or tabletop, not a sidebar library.
- Loose material is visible in the main field.
- Bins appear as broad placement targets within that field.
- Sets belong in a sidebar because they are conceptual overlays rather than physical placement.

- Arrangements should preserve Whitebloom's core product architecture.
- Canvas is for thought in relation.
- Bloom is for opening a material into its full working surface.
- Arrangements is for stewardship of workspace material.

- Arrangements should expose board-aware context for every material.
- The user should be able to see whether a material is referenced by boards.
- The user should be able to jump from a material to the boards that use it.
- Staleness and board usage are more important than filesystem details.

- Quickboards have no Arrangements view because they have no workspace material layer.
