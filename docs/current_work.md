# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

### Subboards

A subboard is a bud node on the canvas whose resource is another `.wb.json` file. It represents true hierarchical containment: blooming opens the nested board. The parent board shows a either a thumbnail of the child board (like the StartScreen or WorkspaceHome) or a generic icon (like the SchemaBloom or ObsidianBloom icons).

This falls out naturally from the existing bud architecture — a board is a file, and a bud points to a file. No special schema is needed beyond registering a `com.whitebloom.board` module.

Key properties:
- The nested board has its own `brief`, its own inbox, and its own agent context.
- Brief hierarchy: workspace brief → parent board brief → cluster brief (if the subboard node is inside a cluster) → subboard's own brief. Narrowest-first.
- Agents can navigate the hierarchy by following `wloc:` references to `.wb.json` files.
- Promoting a cluster to a subboard: select a cluster, invoke "Promote to Subboard" via the Palette. The cluster's children move into a new `.wb.json`, the cluster node becomes a bud referencing it. One-way operation.
- Remember to check for unsaved changes when opening a board from within a board

---
