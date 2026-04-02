# Current Work

Quality of life features for text editing, bug fixes, etc.

---

## Phase 1, 2, DONE.

## Phase 3 - Improve text editing layout, wrapping, and commit consistency

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

Define and persist text layout fields and content format in board state.

- Change content storage from `string` to Lexical EditorState JSON.
- Add node layout properties: `widthMode`, `wrapWidth`.
- `maxAutoWidth` is an app-level constant, not stored per node.
- Set safe defaults for existing nodes.
- Ensure content + layout updates are committed atomically.

Deliverable:

- Board store can save and restore Lexical content and layout behavior without UI assumptions.
- Plain text previously stored as strings can be loaded safely (migration shim if needed).

#### Work Unit 2 - Lexical integration and keyboard contract

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

On edit entry, snap the viewport to frame the node within a safe zone, then derive
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
7. Add/adjust tests for model, keyboard behavior, and edit-commit parity.
8. Run full QA pass on desktop flows:
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
