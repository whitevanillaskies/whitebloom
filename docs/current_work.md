# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

### Subboards

Cross-workspace board linking should not be allowed for subboards. Subboards should stay local to the active workspace because external-board containment would create UI confusion, ambiguous ownership, and extra `wloc:` URI complexity for behavior that likely is not worth supporting.

A subboard is a bud node on the canvas whose resource is another `.wb.json` file. It represents true hierarchical containment: blooming opens the nested board. The parent board shows either a thumbnail of the child board (like the StartScreen or WorkspaceHome) or a generic icon (like the SchemaBloom or ObsidianBloom icons).

This falls out naturally from the existing bud architecture — a board is a file, and a bud points to a file. No special schema is needed beyond registering a `com.whitebloom.board` module.

Key properties:
- The nested board has its own `brief`, its own inbox, and its own agent context.
- Brief hierarchy: workspace brief → parent board brief → cluster brief (if the subboard node is inside a cluster) → subboard's own brief. Narrowest-first.
- Agents can navigate the hierarchy by following `wloc:` references to `.wb.json` files.
- Promoting a cluster to a subboard: select a cluster, invoke "Promote to Subboard" via the Palette. The cluster's children move into a new `.wb.json`, the cluster node becomes a bud referencing it. One-way operation.
- Only boards local to the active workspace can be linked as subboards.
- Dragging or dropping an external board into a subboard target should be rejected with an error panel explaining that only local workspace boards can be linked as subboards.
- Remember to check for unsaved changes when opening a board from within a board

Superseded draft execution plan.

1. Add a `BoardBloom` board bud module, `com.whitebloom.boardbloom`, so a `.wb.json` can be represented as a normal bud with thumbnail-or-icon rendering.
2. Extend bloom/open behavior so opening that bud navigates into the board.
3. Add unsaved-change protection before opening a nested board, reusing the current leave/open safeguards.
4. Restrict subboard linking to boards from the current workspace only. Treat cross-workspace linking as invalid rather than partially supported.
5. Reject external board drag/drop attempts with a clear error panel instead of silently failing or coercing the link.
6. Implement `Promote to Subboard` for a selected cluster: create a new board file, move the cluster's children into it, and replace the cluster with a bud pointing at that board.

### Command Palette For Board Linking

The Command Palette should support a dynamic `Link Board` mode. Flow: press `Tab`, choose `Link Board`, then the Palette clears its normal contents and is repopulated with the boards that are valid to link from the current workspace. This keeps the action focused and avoids mixing general commands with board-picking UI.

This mirrors for example VS Code Ctrl+Shift+P -> Change Language -> contents cleared and populated with available languages

Extension notes:
- The Palette likely needs an explicit transient mode/state so it can swap from command results to contextual board results.
- In `Link Board` mode, only show local workspace boards that are valid subboard targets.
- External boards should not appear in this list at all.
- If an external board is dropped in through some other path, show the same error panel used for invalid cross-workspace linking.

Execution plan.

1. Extend the Command Palette so an action can place it into a contextual selection mode instead of always showing static command results.
2. Implement `Link Board` as a mode switch: `Tab` -> `Link Board` -> Palette clears and repopulates with valid local boards.
3. Add filtering and labeling so the board list is easy to scan and clearly scoped to the current workspace.
4. Ensure exiting or completing the action restores the Palette to its normal command mode cleanly.
5. Verify keyboard flow, empty-state behavior, and consistency with the external-board rejection rules above.

---
