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

Target behavior should follow a Miro-like model:

- Default mode: text grows horizontally first.
- Auto-wrap mode: once width reaches a max auto width, keep width capped and grow down.
- Fixed-width mode: if user manually resizes width, that width is persisted and all future
  editing/display wraps to that width.
- Commit consistency: edit-mode wrapping and committed wrapping must match exactly.
- Wrap width is not new line: auto wrapping text at max width should not insert a line break. It should simply make the text continue on the next line.

### Functional Requirements

- Replace single-line input with multiline editing surface.
- Enter inserts newline.
- Ctrl+Enter (Cmd+Enter on macOS) or click outside text area commits.
- Escape cancels.
- Top-left anchor stays fixed while height grows.
- Persist width behavior in node state:
  - widthMode: auto or fixed
  - wrapWidth: number or null
  - maxAutoWidth: app default
- Committed view uses same typography and wrapping rules as edit mode.

### Work Units

#### Work Unit 1 - Data model and store contract

Define and persist text layout fields in board state.

- Add node layout properties: widthMode, wrapWidth, maxAutoWidth.
- Set defaults for existing nodes (migration-safe behavior).
- Ensure updates are atomic with text content commits.

Deliverable:

- Board store can save and restore text + layout behavior without UI assumptions.

#### Work Unit 2 - Editing surface upgrade

Move from input to textarea and enable multiline interaction.

- Replace inline input with textarea.
- Implement keyboard rules:
  - Enter = newline
  - Ctrl/Cmd+Enter = commit
  - Escape = cancel
- Keep focus/select behavior stable for quick edits.

Deliverable:

- User can type, paste, and edit multiline text without hidden overflow.

#### Work Unit 3 - Measurement and auto-sizing engine

Create deterministic measurement shared by edit and display.

- Implement measurement strategy (hidden mirror or equivalent).
- In auto mode, grow width from content up to maxAutoWidth.
- After maxAutoWidth, keep width fixed and increase height.
- In fixed mode, always measure/wrap at wrapWidth.

Deliverable:

- Live editor resizes predictably and keeps top-left anchor fixed.

#### Work Unit 4 - Commit/display parity

Guarantee WYSIWYG parity between editing and committed node.

- Align font, size, line-height, padding, white-space, and word-break rules.
- Render committed node with same width decision used during editing.
- Prevent post-commit snap-back to a single line.

Deliverable:

- No visual jump in wrapping or size when exiting edit mode.

#### Work Unit 5 - Manual width constraint integration

Respect user-resized width as a persistent layout constraint.

- Hook width drag/resize into text node layout state.
- Switching to fixed mode sets wrapWidth from user resize.
- Subsequent edits keep fixed wrapping until user changes width again.

Deliverable:

- User-controlled width behaves as expected across edits and reloads.

#### Work Unit 6 - Validation and regression tests

Add test coverage for behavior and persistence.

- Unit tests: measurement logic for auto vs fixed width.
- Interaction tests: keyboard commit/cancel/newline behavior.
- Persistence tests: save/load of layout properties.
- Visual/manual checks: no overflow, no wrapping mismatch on commit.

Deliverable:

- Reliable protection against regressions in editing and layout behavior.

### Implementation Plan

1. Extend shared types and board store with widthMode/wrapWidth/maxAutoWidth.
2. Replace text editor input with textarea and wire keyboard behavior.
3. Add measurement utility and use it for live editor sizing.
4. Apply same measurement rules to committed node rendering.
5. Integrate resize handle updates to switch/maintain fixed width mode.
6. Add/adjust tests for model, keyboard behavior, and edit-commit parity.
7. Run full QA pass on desktop flows:
   - create new text node
   - long single line
   - explicit multiline
   - auto-width to wrap transition
   - fixed-width resize then edit
   - save/reload parity

### Acceptance Criteria

- Editing never hides typed text.
- Multiline input works with Enter.
- Ctrl/Cmd+Enter commits; Escape cancels.
- In auto mode, node grows horizontally first, then vertically after max width.
- In fixed mode, node wraps at persisted width and grows downward.
- Committed layout matches what was visible in edit mode.
- Behavior remains correct after board save/reload.
