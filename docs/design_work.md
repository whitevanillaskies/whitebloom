# Design Work

Reference `design_language.md` for the authoritative token and surface pattern rules.

---

## Canvas Redesign

Four components, in implementation order. Do not skip ahead — each unblocks the next.

---

### 1. Remove `canvas-shell-actions` ✓ Done

The floating top-right button strip has been removed from `Canvas.tsx` and `Canvas.css`.

**Removed buttons — all migrate to `BoardContextBar` (Step 2), none deleted from app:**

| Button | Shown when | Handler | Destination |
|---|---|---|---|
| "Promote to Workspace" | `workspaceRoot === null` (quickboard only) | `handlePromoteToWorkspace()` | BoardContextBar overflow menu (quickboard context) |
| "Move to Trash" | Always | `setTrashBoardConfirmOpen(true)` | BoardContextBar overflow menu (both contexts) |
| "Workspace Home" / "Close Board" | Always (label varies) | `handleCloseBoard()` | BoardContextBar primary action area |

All handlers (`handlePromoteToWorkspace`, `handleTrashBoard`, `handleCloseBoard`) and their
associated state (`promoteInFlight`, `trashBoardInFlight`, `trashBoardConfirmOpen`,
`workspaceActionError`) remain in `Canvas.tsx` — they will be wired into `BoardContextBar`
as props in Step 2.

---

### 2. `BoardContextBar`

The consolidated top-left component. Replaces both the current `BoardTitle` component and
the removed shell actions. Named "Context" because it surfaces the board's context — what
kind of board this is, where it lives, and what can be done with it.

**Layout (left to right):**

```
[identity] [separator] [board name] [save] [new] [⋯]
```

**Identity slot:**
- Workspace board: workspace name as a button → clicking returns to workspace home
- Quickboard: `Zap` icon (no label) as a non-navigating identity marker

**Board name:**
- Inline editable (click to edit), same interaction as the current `BoardTitle`
- Transient boards show "Untitled" or a timestamp slug until named

**Primary actions:**
- `Save` — always present; on a transient board triggers the "Save as…" promote flow
- `New` — context-sensitive label and icon:
  - Workspace board: "New board" (`FilePlus`) → opens `CreateBoardModal`
  - Quickboard: "New quickboard" (`Zap`) → creates a new transient board

**Overflow menu (`⋯`):**
Uses `PetalMenu` (see below). Items vary by context:
- Workspace board: Move to trash / Board settings
- Quickboard: Promote to workspace / Move to trash / Board settings

**Surface:** Floating toolbar — `10–12px` radius, `backdrop-filter`, medium shadow tier.
Same surface class as `CanvasToolbar`. Not an inline card.

---

### 3. `PetalMenu`

A shared floating menu surface used wherever a positioned list of actions is needed.
Covers: `BoardContextBar` overflow, future right-click menus, any trigger-anchored dropdowns.

**Visual spec** (floating toolbar / popover from `design_language.md`):
- Background: `linear-gradient(180deg, rgba(255,255,255,0.75), rgba(248,250,252,0.66))`
- Border: `1px solid rgba(255, 255, 255, 0.24)`
- Shadow: medium tier + inset highlight
- Radius: floating (10–12px)
- `backdrop-filter: blur(12px) saturate(140%)`
- Min-width: `160px`; items `28px` tall, `8px` horizontal padding

**Component API:**
```ts
type PetalMenuItem = {
  id: string
  label: string
  icon?: ReactNode
  intent?: 'default' | 'destructive'
  onActivate: () => void
  disabled?: boolean
}

type PetalMenuProps = {
  items: PetalMenuItem[]
  anchor: { x: number; y: number }  // viewport coords of the trigger
  onClose: () => void
}
```

Dismiss on: Escape, click outside, item activation.
Keyboard: Arrow up/down to navigate, Enter to activate.

**CSS unification with slash command menu:**
`SlashCommandPlugin.css` is refactored to use `.petal-menu` and `.petal-menu__item` class
names. The Lexical lifecycle and positioning logic inside `SlashCommandPlugin` is untouched —
only the class names change. This gives visual parity for free.

Fix while here: `.slash-menu__item--active` currently uses hard-coded yellow
`rgb(255, 244, 146)`. Replace with `rgba(var(--color-accent-blue-rgb), 0.1)` background +
`var(--color-accent-blue)` text — consistent with the token system.

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
