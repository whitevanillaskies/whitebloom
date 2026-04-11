# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Refactoring Arrangements

### Rationale

The Arrangements desktop modeled (still tries to do) bins as spatially positioned objects on an infinite 2D canvas. On a board canvas, spatial position carries meaning — nodes relate to each other. Bins do not have spatial relationships. Whether one bin is 200px left of another means nothing. The infinite canvas complexity was paying no dividend.

The deeper problem was the context switch. The most common material management action happens while working on a board: grab a resource, check what's stale, include something in a set. The desktop-as-separate-route forced a full navigation break to do any of that. The Mica floating window model eliminates that break — Materials is reachable from the canvas palette without leaving the board.

The data model (bins, sets, smart sets, materials, staleness) is correct and unchanged in structure. Only the presentation layer is wrong.

The Arrangements desktop (infinite 2D canvas with spatially positioned bins) is quarantined. Remove all direct navigation links to it. Keep it accessible via a dev shortcut only. It may be revisited later, but do not polish it further.

The Arrangements data model (bins, sets, smart sets, materials) is sound and unchanged. What changes is the surface.
Materials includes boards, bud-backed files, and imported URLs. URL materials participate in bins, sets, and smart sets exactly like other materials. If a URL is no longer referenced by any board, it remains in Materials and appears in `Stale`.

### Materials window

Add a `Materials` command to the canvas palette. It opens a Mica floating window.

**Layout:**
- Left sidebar, split into three vertical sections:
  - **Bins** — a single navigation anchor entry (not a list of individual bins). Clicking it returns to the bins-organized view. Selected by default when the window opens.
  - **Sets** — hierarchical, collapsible. Same tree structure as the former SetsIsland.
  - **Smart Sets** — at the bottom, read-only. `Stale` is the first entry.
- Main content area to the right of the sidebar.

**Content area behavior:**
- When **Bins** is selected: materials shown as a flat document with collapsible bin sections. Loose materials appear as an ungrouped section above the bins. Each bin section expands to show its materials inline.
- When a **Set or Smart Set** is selected: acts as a filter/lens — shows a flat list of all materials matching that set. No collapsible sections. Clicking **Bins** exits the lens and restores the bin-organized view.
- URL materials appear in these views alongside other materials. Activating one opens it in the browser for now.

**View modes:** None. Single list view throughout — for both bins and sets. One level of hierarchy does not justify the complexity of a column/list toggle.

### Files window

Add a separate `Files` command to the canvas palette. It opens a second independent Mica floating window — a filesystem browser scoped to the workspace root (exact scope TBD). Supports drag to canvas (creates a node + material record) and drag to the Materials window (imports as material without placing on a board).

Imported URLs should likewise create material records. URL nodes are not second-class board decorations; they are workspace materials that can be organized into bins and sets and can become stale when no board references them.

These two windows are independent. The user opens each on demand. They are never co-launched.

### What is reused

Mica windows, drag coordinator, drop targets, and the SetsIsland tree interaction are all directly applicable. The main new component is the Materials list with collapsible bin sections.

## Implementation


## Phase 7: Files Window
Goal: introduce the second independent Mica window for workspace file import.

**Work Unit 7.1: Add `Files` command to canvas palette**
- Open an independent Mica window, not coupled to Materials.

**Work Unit 7.2: Build workspace-scoped filesystem browser**
- Scope to workspace root or the chosen root policy.
- Keep it intentionally lightweight.

**Work Unit 7.3: Drag file to canvas**
- Create node plus material record.

**Work Unit 7.4: Drag file to Materials**
- Import as material without placing on a board.

**Work Unit 7.5: Align imported file behavior with URL import behavior**
- Ensure both imported files and imported URLs become material records governed by the same arrangements model.

## Phase 8: Board-Aware Context
Goal: preserve the most important stewardship information.

**Work Unit 8.1: Show board reference status**
- Expose whether each material is used by any boards.

**Work Unit 8.2: Jump-to-boards interaction**
- Allow navigating from a material to boards that reference it.

**Work Unit 8.3: Staleness computation validation**
- Confirm stale logic is correct for boards, files, and URLs.
