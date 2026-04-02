# Current Work — Rich Text

## Goal

Replace the global `SelectionToolbar` with a proper per-node rich text editing experience built on Lexical + React Flow's `NodeToolbar`.

---

## Design

### Node Toolbar (inline formatting)
- Appears **only when a node is in editing mode** (`editing === true`), using React Flow's `NodeToolbar` component
- Positioned above the node automatically by React Flow (no manual coordinate math)
- Operates on the **current Lexical selection** (selected characters or collapsed caret)
- Buttons: **Bold**, **Italic** (nothing else, just a proof of concept)
- Keyboard shortcuts (Cmd+B, Cmd+I, etc.) work independently of the toolbar

### Block Types via Slash Commands
- Typing `/` at the start of an empty block (or start of line) opens a floating slash-command menu
- Menu items: **Paragraph**, **Heading 1**, **Heading 2**, **Heading 3**, **Bulleted List**, **Numbered List**, **Quote** (code block later)
- User can keep typing after `/` to filter; Escape or blur dismisses
- On selection: remove the `/` text, transform the block via `$setBlocksType` (`@lexical/selection`)
- Menu is a fixed-position DOM overlay anchored to the caret position

### Display / Read-only
- Read-only `LexicalComposer` renders the same styled content (headings, lists, quotes, etc.)
- Shared Lexical theme maps node types to CSS classes used in both editing and display modes

---

## Implementation Phases

### Phase 1 — Cleanup & Node Registration
1. Remove `SelectionToolbar` from `Canvas.tsx` and delete `SelectionToolbar.tsx` / `SelectionToolbar.css`
2. Register Lexical block nodes in `editorConfig` and `displayConfig`:
   - `HeadingNode`, `QuoteNode` from `@lexical/rich-text`
   - `ListNode`, `ListItemNode` from `@lexical/list`
3. Add `ListPlugin` and `HistoryPlugin` inside the editing `LexicalComposer`
4. Define a shared Lexical `theme` object (CSS class names for headings, lists, quotes) and wire it to the node's CSS

### Phase 2 — NodeToolbar
1. Add React Flow `NodeToolbar` inside `TextNode`, rendered only when `editing === true`
2. Extract a `FormatToolbar` component that:
   - Reads active formats from Lexical's `$getSelection()` on `SELECTION_CHANGE_COMMAND`
   - Dispatches `FORMAT_TEXT_COMMAND` for bold/italic/underline/strikethrough
   - Dispatches inline style for color (custom command or direct Lexical API)
3. Prevent editor blur/commit when clicking toolbar buttons — use `onMouseDown` + `preventDefault` on toolbar items

### Phase 3 — Slash Command Menu
1. Create a `SlashCommandPlugin` Lexical plugin that:
   - Registers a `KEY_DOWN_COMMAND` listener watching for `/` on an empty/start-of-block position
   - Captures subsequent keypresses to build a filter string
   - Shows/hides a `SlashMenu` React component
2. `SlashMenu` is a portal rendered into `document.body`, positioned via `window.getSelection().getRangeAt(0).getBoundingClientRect()`
3. On item select: delete the slash + filter text, call `$setBlocksType(selection, () => $createXxxNode())`
4. Dismiss on Escape, click-outside, or Enter without a highlighted item

### Phase 4 — Block Styling & Theme
1. Add CSS for all block types (scoped under `.text-node`):
   - H1 / H2 / H3 — size + weight hierarchy
   - `ul` / `ol` — proper indentation and bullets/numbers
   - `blockquote` — left border + muted color
2. Update both editing and display `LexicalComposer` configs to use the shared theme
3. Verify read-only display renders correctly for all block types

---

## Files Touched

| File | Change |
|------|--------|
| `Canvas.tsx` | Remove `SelectionToolbar` import + JSX |
| `SelectionToolbar.tsx` | Delete |
| `SelectionToolbar.css` | Delete |
| `TextNode.tsx` | Register nodes, add plugins, add `NodeToolbar`, wire slash command plugin |
| `TextNode.css` | Add block-type styles and theme classes |
| `FormatToolbar.tsx` | New — inline formatting toolbar component |
| `SlashCommandPlugin.tsx` | New — Lexical plugin for slash command detection |
| `SlashMenu.tsx` | New — floating block-type picker menu |

---

## Out of Scope (for now)
- Code block syntax highlighting
- Links
- Markdown shortcut triggers (e.g. `## ` → heading)
- Images / embeds
- Nested lists beyond one level
