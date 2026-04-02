# Current Work

Quality of life features for text editing, bug fixes, etc.

---

## Phase 1, 2, DONE.

## Phase 3 - Improve text editing layout, wrapping, and commit consistency

## Phase 3.5 - Parallel interaction track for width handles and drag ergonomics

This phase runs in parallel with late Phase 3 polish and isolates interaction work that is
too risky to deliver as a single one-shot change.

### Goals

- Introduce horizontal width handles on both left and right edges.
- Keep text editing active while width is being adjusted.
- Avoid gesture conflicts between text width resizing and future connection handles.
- Preserve existing width model behavior (`auto` to `fixed`, persisted `wrapWidth`).

### Parallel Workstreams

#### Stream A - Dual-edge width resizing (LTR + RTL friendly)

- Right edge drag: keep left edge fixed, grow/shrink width.
- Left edge drag: keep right edge fixed by updating node x-position and width together.
- Clamp to a minimum width so narrow drags remain usable.

#### Stream B - Resize while editing

- Allow resizing even when Lexical is focused.
- Prevent blur-commit while a resize drag is active.
- Keep live wrapping updates visible during drag and while typing.

#### Stream C - Visual affordances and mode separation

- Show horizontal-resize affordance when hovering node edges.
- Add a Lucide-based resize cue near the active edge to make intent explicit.
- Offset React Flow connection handles slightly outside the node edge (Miro-like spacing)
  to reduce overlap/conflict with width-resize hit zones.

### Technical Spec (Geometry and Interaction Priority)

Use screen-space hit testing for pointer intent and convert deltas to flow units only when
applying size/position updates.

#### Constants (initial values, tune after QA)

- `EDGE_RESIZE_ZONE_PX = 6` (inside node bounds on left/right edges)
- `EDGE_ICON_OFFSET_PX = 10` (Lucide cue offset from active edge centerline)
- `CONNECTION_HANDLE_OUTSET_PX = 8` (outside node bounds)
- `MIN_WRAP_WIDTH = 120` (flow units)
- `RESIZE_HOVER_DEBOUNCE_MS = 0` (no delay initially)

#### Hitbox partition (per vertical edge)

- Inner zone (inside edge): resize only.
- Outer zone (outside edge, offset): connection handle only.
- No overlap between zones; if overlap appears at small zoom, resize takes priority.

#### Cursor and icon behavior

- On resize-zone hover: show `ew-resize` cursor.
- Show Lucide `MoveHorizontal` cue near hovered edge.
- Icon appears only while selected or while actively resizing.
- Hide connection handle visual when resize zone is actively hovered/dragged on that edge.

#### Drag math

- Let `deltaFlow = deltaScreen / viewport.zoom`.
- Right edge drag:
  - `newWidth = clamp(startWidth + deltaFlow, MIN_WRAP_WIDTH, maxAllowedWidth)`
  - `x` unchanged.
- Left edge drag:
  - `newWidth = clamp(startWidth - deltaFlow, MIN_WRAP_WIDTH, maxAllowedWidth)`
  - `newX = startRight - newWidth` (right edge remains fixed).

#### Mode and persistence rules

- First resize gesture in `auto` mode switches node to `fixed` immediately.
- During drag: live-update width (and x for left edge) for instant visual feedback.
- On pointer up: persist `widthMode='fixed'` and `wrapWidth=newWidth`.
- If editing is active, text focus remains in Lexical after drag ends.

#### Event priority

- Edge resize pointerdown suppresses node drag/pan and does not trigger editor commit.
- Connection handle pointerdown is allowed only in the outer offset zone.
- Keyboard behavior remains unchanged (`Enter` newline, `Ctrl/Cmd+Enter` commit, `Escape` cancel).

### Exit Criteria for Phase 3.5

- User can resize from both edges reliably.
- Editing session is not interrupted by resize gestures.
- Edge hover clearly communicates horizontal resize intent.
- Resize and connection interactions can coexist without accidental trigger conflicts.

### Problem Description

Current inline editing uses a fixed-size single-line input, which creates several UX and
data-consistency problems:

- Overflow while editing: text becomes hidden before commit.
- No multiline editing: Enter commits instead of inserting a newline.
- Layout mismatch: what the user sees while editing can differ from committed display.
- Missing width model: no clear behavior for horizontal growth vs wrapping.

Target behavior follows a Miro-like model:

- Default mode: text grows horizontally first.
- Auto-wrap mode: once width reaches a max auto width, keep width capped and grow down.
- Fixed-width mode: if user manually resizes width, that width is persisted and all future
  editing/display wraps to that width.
- Commit consistency: edit-mode wrapping and committed wrapping must match exactly.
- Wrap width is not a newline: auto wrapping text at max width should not insert a line break.
  It should simply make the text continue on the next line.

### Architecture Decision: Lexical

The editing surface will be built on **Lexical** (Meta's embedded rich text editor library)
rather than a textarea. This decision is driven by future requirements:

Planned features — color, text style (bold/italic), size, text alignment, highlight/background,
lists — require inline markup (different spans of text with different properties). A textarea
cannot represent this. Building WU2–4 on textarea and migrating later would mean rewriting
the measurement engine, the data model, and the display renderer.

Lexical is chosen over alternatives because:

- React-first, lightweight, designed for embedded (not full-document) editors.
- Serializes to JSON, not innerHTML — safe, diffable, migratable.
- No built-in UI: toolbar buttons are wired by dispatching Lexical commands, using our own
  Lucide icons inside the existing NodeToolbar. The toolbar and editor share the editor
  instance via `useLexicalComposerContext` inside a `LexicalComposer` wrapper.
- Read-only rendering mode renders committed content from the same serialized state,
  guaranteeing display parity by construction rather than by CSS synchronization.
- Adding formatting (bold, color, lists, etc.) later is additive — new nodes/plugins —
  with no changes to the measurement or parity architecture.

Out of scope for Phase 3: no formatting features will be enabled yet. Lexical starts in
plain-text-only configuration.

### Functional Requirements

- Replace single-line input with Lexical editor surface.
- Enter inserts newline.
- Ctrl+Enter (Cmd+Enter on macOS) or click outside commits.
- Escape cancels.
- Top-left anchor stays fixed while height grows.
- Persist width behavior in node state:
  - widthMode: `auto` or `fixed`
  - wrapWidth: number or null
  - maxAutoWidth: computed once at edit entry from the viewport safe zone (see below)
- Content stored as Lexical EditorState JSON, not a plain string.
- Committed view renders from the same JSON using Lexical read-only mode.
- On entering edit mode, if the node is outside the viewport safe zone, snap the viewport
  instantly (no animation) to bring it within bounds before editing begins.

### Work Units

#### Work Unit 1 - Data model and store contract

STATUS: DONE.

Define and persist text layout fields and content format in board state.

- Change content storage from `string` to Lexical EditorState JSON.
- Add node layout properties: `widthMode`, `wrapWidth`.
- `maxAutoWidth` is an app-level constant, not stored per node.
- Set safe defaults for existing nodes.
- Ensure content + layout updates are committed atomically.

Deliverable:

- Board store can save and restore Lexical content and layout behavior without UI assumptions.
- Do not concern with backward compatibility for previously saved files. Previous files are broken now, that's fine.

#### Work Unit 2 - Lexical integration and keyboard contract

STATUS: DONE.

Replace the input element with a Lexical editor and wire interaction behavior.

- Wrap `TextNode` in `LexicalComposer` so both the editor and the `NodeToolbar` share the
  editor instance.
- Mount `RichTextPlugin` in plain-text-only configuration.
- Implement keyboard rules via a Lexical command listener:
  - Enter = newline (default Lexical behavior)
  - Ctrl/Cmd+Enter = commit
  - Escape = cancel
- Preserve focus/select-all behavior for quick edits (double-click to enter, focus on open).
- Stop pointer/mouse events from propagating to ReactFlow during editing.

Deliverable:

- User can type, paste, and edit multiline text without hidden overflow.
- Keyboard commit/cancel contract matches spec.

#### Work Unit 3 - Viewport framing and auto-sizing

STATUS: DONE.

On edit entry, snap the viewport to frame (PAN only, no zoom) the node within a safe zone, then derive
`maxAutoWidth` from that guaranteed position.

**Viewport framing:**

- Define the safe zone as a fraction of window dimensions (e.g. ~12–15% inset on each side).
  Fraction scales correctly across screen sizes; a fixed pixel value does not.
- On double-click (edit entry), check whether the node's current screen-space position falls
  within the safe zone. If it does, do nothing. If it does not, snap the viewport instantly —
  no animation. Power users want to type immediately; a pan transition makes them wait.
- Use ReactFlow's `setViewport` to apply the correction. Only translate, never zoom.
- The snap is justified by the user having initiated the action (double-click). The viewport
  shift is a direct response, not an ambient event, so it is not disorienting.

**maxAutoWidth derivation:**

- After framing, `maxAutoWidth` is computed once from the current viewport state:
  available screen width to the right of the node (in canvas units) minus the safe margin.
  Formula: `(window.innerWidth * (1 - safeZoneFraction) - nodeLeftScreen) / zoom`.
- Computed at edit entry, not reactively. Recomputing on every pan/zoom during editing is
  unnecessary — the node is already framed.
- Floor `maxAutoWidth` at a minimum canvas-unit width so unusually narrow windows cannot
  produce an unusable editing surface.

**Sizing during edit:**

- In `auto` mode: remove width constraint on the container and read `offsetWidth` after each
  `onChange`. Cap at `maxAutoWidth`. Once the cap is reached, constrain width and let height
  grow freely.
- In `fixed` mode: set container CSS width to `wrapWidth`, height is always `auto`.
- On each size change, update the ReactFlow node's measured dimensions so the top-left
  anchor stays fixed (height grows downward only).

Deliverable:

- Node is always within the safe zone before editing begins.
- Live editor resizes predictably in both modes.
- Top-left anchor does not shift during editing.

#### Work Unit 4 - Committed view via Lexical serialization

STATUS: DONE.

Render the committed node from the same serialized EditorState used during editing.
Parity is guaranteed by construction: same data, same renderer.

- Display mode mounts Lexical in `editable={false}` (read-only) with the stored JSON state.
- Apply the same width constraint logic as the edit surface (widthMode + wrapWidth).
- No separate CSS synchronization required between edit and display.

Deliverable:

- No visual jump in size or wrapping when exiting edit mode.
- Committed display is identical to the final edit-mode state.

#### Work Unit 5 - Manual width constraint integration

Respect user-resized width as a persistent layout constraint.

- Hook width drag/resize events into node layout state.
- On resize: set `widthMode = fixed`, persist `wrapWidth` from the dragged size.
- Support drag from both left and right edges.
- Show horizontal-resize affordance on edge hover (including Lucide icon cue).
- Keep resize hit zones and connection handles spatially separated by offsetting
  connection handles slightly outside the node edge.
- Subsequent edits and display both use the fixed width until the user resizes again.

Deliverable:

- User-controlled width persists correctly across edits and reloads.

#### Work Unit 6 - Validation and regression tests

- Unit tests: auto vs fixed width measurement logic.
- Interaction tests: keyboard commit/cancel/newline; Lexical command dispatch.
- Persistence tests: save/load of Lexical JSON state and layout properties.
- Visual/manual checks: no overflow, no wrapping mismatch on commit.

Deliverable:

- Reliable protection against regressions in editing and layout behavior.

### Implementation Plan

1. Update shared types and board store: content becomes Lexical JSON, add widthMode/wrapWidth.
2. Integrate LexicalComposer into TextNode, wrapping both editor and NodeToolbar.
3. Wire keyboard contract (Ctrl+Enter commit, Escape cancel) via Lexical command listener.
4. Implement viewport framing: on edit entry, snap to safe zone (fraction of window size), derive maxAutoWidth.
5. Implement committed view: Lexical read-only renderer using stored JSON + same width logic.
6. Integrate resize handle to set widthMode=fixed and persist wrapWidth.
7. Add dual-edge behavior, edge-hover resize affordance (Lucide cue), and connection-handle
  offset spacing to prevent interaction conflicts.
8. Add/adjust tests for model, keyboard behavior, and edit-commit parity.
9. Run full QA pass on desktop flows:
   - create new text node
   - long single line
   - explicit multiline (Enter key)
   - auto-width to wrap transition
   - fixed-width resize then edit
   - save/reload parity

### Acceptance Criteria

- Editing never hides typed text.
- Multiline input works with Enter.
- Ctrl/Cmd+Enter commits; Escape cancels.
- On edit entry, viewport snaps instantly (no animation) to frame the node within the safe zone.
- In auto mode, node grows horizontally first, then vertically after max width.
- In fixed mode, node wraps at persisted width and grows downward.
- Committed layout matches what was visible in edit mode — no snap or jump.
- Behavior remains correct after board save/reload.
- Architecture supports future addition of inline formatting (bold, color, lists, etc.)
  without changes to the measurement or serialization systems.
