# Design Work

Reference `design_language.md` for the authoritative token and surface pattern rules.

---

## Canvas Redesign

---

### 4. `PetalPalette`

A context-scoped, searchable command palette triggered by Tab. The direct equivalent of
Houdini's Tab menu and Substance Designer's node search — always answers the question
"what can I do *from here*?" scoped to the current context.

**The palette itself is context-blind.** It receives an array of items and renders them.
The *caller* determines what items are relevant. This means:

- Canvas (nothing selected): node creation items (Text, Image, …)
- Canvas (node selected): node operation items (Wrap width, Snug, Delete, …)
- Bloomed node / module editor: editor-specific commands (format, insert block, …)
- Future modules register their own items without touching the palette

As modules are built, each registers palette items for its bloom context. The palette
scales to the entire system without any central item registry.

**Component API:**
```ts
type PaletteItem = {
  id: string
  label: string
  icon?: ReactNode
  hint?: string      // keyboard shortcut badge, e.g. "T", "⌘S"
  onActivate: () => void
}

type PetalPaletteProps = {
  items: PaletteItem[]
  onClose: () => void
  placeholder?: string
}
```

**Surface:** Centered in viewport. Wide search input at top (full panel width), filtered
list below. Not a tooltip, not a panel — its own surface class.
- Width: `520px` fixed
- Search input: prominent, auto-focused on open, clears on close
- List: `auto-scroll`, max ~8 visible items before scroll
- Radius: `var(--radius-border-frame)` (panel, not floating — it's centered, not anchored)
- Shadow: elevated tier

**Tab binding in `Canvas.tsx`:**
- Tab opens palette, passes items appropriate to current canvas state
- Escape closes (handled internally by `PetalPalette`, same pattern as `PetalPanel`)
- Tab again while open: closes (toggle)
- Item activation always closes the palette

**Bloomed node access:**
When a node is bloomed (editor open), the bloom surface intercepts Tab and passes
its own item set. The palette component is the same — only the items differ. This is the
mechanism by which any future module can expose its own command surface without
coordination with Canvas.tsx.
