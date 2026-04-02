# Current Work

Quality of life features for text editing.

---

## Phase 1 — Fix mouse interaction inside the editing input

**Problem:** While editing a text node, mouse clicks inside the input are not recognized.
The cursor can only be repositioned via keyboard arrows. This is likely ReactFlow
intercepting pointer events on the node before they reach the input.

One thing I notice is that nodes are draggable while text editing is on, which I think may be causing the issue. On editing one should not be able to drag the node, as the interactions conflict each other. In miro if you're editing, dragging the mouse across the text will select text, not drag the node.

**Fix:** Stop pointer event propagation on the input element (mousedown/pointerdown)
so ReactFlow doesn't swallow clicks meant for the input.

---

## Phase 2 — Fix text selection on double-click to edit

**Problem:** Double-clicking a node to enter edit mode calls `selectAll` on the input,
wiping out the user's ability to click into a specific position. Expected behavior
(per tools like Miro) is that the cursor is placed at the click position, not the
whole text selected.

**Fix:** Remove the `select()` call triggered on focus. The browser will naturally place
the cursor where the user clicked if selection is not forced.

---

## Phase 3 — Auto-resize the editing area as the user types

**Problem:** The editing input is a fixed-size `<input>`, so text overflows and becomes
invisible while editing. After committing, the node resizes correctly via CSS, but
during editing the overflow is hidden.

**Fix:** Replace the `<input>` with a `<textarea>` (or a `contenteditable` element).
Use a hidden mirror element or `scrollHeight` trick to grow the textarea to fit its
content as the user types, so the editing surface always shows all text.

---

## Phase 4 — Constrain growth direction and support line breaks

**Problem / goal:** When content grows during editing the node should only expand
downward (top edge stays fixed). Also needs proper line-break support — currently
`Enter` commits the edit, but multiline text should be supported.

**Fix:**
- Decide on commit gesture (e.g. `Escape` to cancel, `Ctrl+Enter` / click-away to commit,
  plain `Enter` inserts a line break — matching Miro/FigJam conventions).
- Ensure the node's ReactFlow position (which is the top-left corner) stays fixed while
  height grows, so the node anchors at the top.
- Verify that the committed content and node height stay in sync in the board store.
