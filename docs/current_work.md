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

---

## Future Work: PDF, Ink, and Lecture Capture

### Rationale

Whitebloom has received direct user validation for a very specific local-first teaching workflow:
- Open a multipage PDF onto the canvas.
- Annotate over it live with a stylus while projecting to a lecture hall.
- Optionally save or export the result afterward.

The core value is not document archival or heavy editing. It is responsive lecture-time performance, clarity, and portability. This work should therefore be optimized around a premium, low-friction teaching surface rather than around general-purpose PDF software complexity.

### Product Priorities

**Primary**
- Multipage PDF viewing on the board canvas.
- Live stylus-first annotation over PDFs and over the board itself.
- Local-first performance suitable for live teaching.

**Secondary**
- Reusable ink layers that can be shown, hidden, and selected deliberately.
- Non-destructive annotation workflows for both boards and PDFs.

**Lower priority**
- Baking or exporting annotations into PDF output.
- Session recording to a local video file with audio.

### High-Level Workstreams

#### 1. PDF multipage viewer

Introduce a PDF module that supports the lecturer use case first:
- Open multipage PDFs as first-class board materials.
- Preserve a minimal, Apple-like document feel with restrained chrome.
- Prioritize page visibility, navigation, zoom, and lecture readability over document-authoring depth.
- Treat export, markup persistence, and advanced document manipulation as follow-on concerns unless they directly support live teaching.

Rendering should be built on `PDF.js`, not on Chromium's stock PDF viewer and not on a prebuilt React viewer shell.

**Rationale:**
- Chromium can display PDFs, but its built-in viewer is the wrong abstraction level for Whitebloom.
- Whitebloom needs tight control over the document surface so the experience can match Apple Preview rather than feeling like an embedded browser widget.
- We will need direct control over multipage presentation, zoom behavior, page navigation, and the future ink overlay system.
- The PDF surface must remain visually and behaviorally consistent with Whitebloom's own design language instead of inheriting a generic browser PDF UI.
- `PDF.js` provides the right foundation: a mature PDF rendering engine with enough low-level control to build a custom viewer without surrendering the product surface.

This viewer should feel native to Whitebloom's design language: premium, compact, precise, and free of unnecessary ornament.

#### 2. Ink as a first-class Whitebloom concept

Ink should not be treated as an afterthought bolted onto PDFs alone. It should become a first-class overlay artifact in the workspace model.

At a high level:
- Ink is a Whitebloom-owned annotation resource.
- Ink resources can target compatible surfaces such as the board canvas and PDFs.
- The underlying coordinate model must remain surface-specific.
  - Board ink uses infinite-canvas/world coordinates.
  - PDF ink uses document/page coordinates.
- The user experience should emphasize layers, visibility, and active drawing target rather than raw file mechanics.

Terminology and file extensions can evolve later. The important part is the model: annotations are explicit workspace artifacts, not hidden incidental state.

#### 3. Ink on canvas via a glass layer

Board annotation should use a dedicated overlay layer above the React Flow canvas:
- The overlay remains visually transparent and non-interactive until an ink tool is active.
- When no ink tool is selected, the board behaves exactly like the existing canvas.
- When an ink tool is active, pointer input is routed to the overlay instead of normal board manipulation.
- The overlay stays synchronized with the board viewport so strokes are authored in board/world space rather than screen space.

This separation keeps node and graph interaction independent from annotation rendering, and it enables future layer visibility, locking, and tool expansion without entangling the core canvas implementation.

#### 4. Ink on PDF

PDF annotation should reuse the general ink concept but operate in PDF-specific coordinates:
- Ink belongs to Whitebloom first, not to the PDF file format.
- A PDF can expose zero, one, or multiple compatible annotation layers.
- The lecturer workflow should optimize for immediate, low-friction live markup rather than for PDF-standard editability.
- Exporting or baking annotations back into a PDF should remain an explicit action, not the default editing model.

This keeps Whitebloom free to support non-destructive overlays, quick layers, and more flexible lecture workflows than native PDF annotations alone would comfortably allow.

#### 5. Ink layers

Layers should be treated as a core part of the annotation model, not as a later embellishment.

Expected behavior:
- The user can see existing compatible layers when entering an ink tool.
- The user can choose which layer is active for drawing.
- Layers can be shown or hidden without destroying them.
- Quick temporary layers can be created immediately and saved later if desired.
- Saved layers can be reused deliberately instead of being implicitly fused into the material forever.

This resolves the tension between shared annotations and context-specific annotations: reuse becomes explicit rather than accidental.

#### 6. Baking PDF annotations

Baking/export is useful, but it is not the primary product value for the validated teaching workflow.

Keep this work scoped as a later output concern:
- Preserve Whitebloom-owned overlays as the primary editable state.
- Treat PDF baking/export as a deliberate downstream action.
- Distinguish between flattening annotations into page content and writing native PDF annotation objects; these are separate product choices and should not be conflated.

#### 7. Session recording

Built-in lecture recording is strategically interesting and may become a strong differentiator, especially in restricted education environments where installing separate capture tools is difficult.

However, it should remain lower priority than the PDF + ink workflow itself.

The high-level goal is:
- Capture the live presentation/annotation session locally.
- Include audio.
- Produce a portable output such as MP4.

This should be approached as an adjacent workflow enhancer, not as a blocker for the core lecture annotation experience.
