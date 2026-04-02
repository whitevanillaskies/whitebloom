# Current Work

## Text node selection, framing, toolbars, handles, and inline editing

### Phase 1 — Selection frame

When a text node is selected, show a visible frame around it. No toolbar yet, no handles yet.

React Flow already applies a `selected` prop to nodes. We use this to conditionally apply a CSS class on the TextNode wrapper that adds a border/outline. Style it to match the design language: thin, clean, not Fisher Price.

**Files touched:** `TextNode.tsx`, `TextNode.css` (new)

---

### Phase 2 — NodeToolbar on selection

When a text node is selected, show a floating toolbar above it using React Flow's built-in `NodeToolbar`. For now it is empty (or has a placeholder label). The goal is to get the positioning and styling right.

**Files touched:** `TextNode.tsx`, `TextNode.css`

---

### Phase 3 — Connection handles on selection

Show four connection handles (top, bottom, left, right) only when the node is selected. Handles are currently hidden (`visibility: hidden`). On selection, they become visible. Style to match design language: small, clean dots, accent color.

No actual edge creation logic yet — just visual handles.

**Files touched:** `TextNode.tsx`, `TextNode.css`

---

### Phase 4 — Inline text editing

Double-clicking a text node enters edit mode:
- The text renders as a contenteditable or a textarea.
- `Enter` commits the edit, writes the new content to the Zustand store.
- `Escape` cancels and reverts to the original content.
- Clicking outside the node also commits (blur).

Needs a `updateNodeContent(id, content)` action added to the store.

**Files touched:** `TextNode.tsx`, `TextNode.css`, `stores/board.ts`
