# Design Work

Reference `design_language.md` for the authoritative token and surface pattern rules.

---

## Completed

### 1. `StartScreen` — DONE
### 2. `WorkspaceHome` — DONE

---

## Active

### 3. Petal — Shared UI Component System

A minimal set of token-correct, reusable UI primitives that replace the six-plus hand-rolled
modal implementations and inconsistent button/field patterns across the codebase. Named Petal
for the same reason macOS named its design system Aqua — the look deserves a name.

**Callsites that motivate this work:**

| Location | Pattern |
|---|---|
| `CreateBoardModal` | overlay + panel + field + buttons |
| `SettingsModal` | overlay + panel + fields |
| `Canvas.tsx` × 4 | inline overlay + panel + buttons (imageDropError, workspaceActionError, pendingDocumentAction, trashBoardConfirm) |
| `canvas-shell-actions__button` | button variants |

Six modal implementations, all hand-rolled, all carrying token violations. Extract once, fix once.

---

#### Component: `PetalPanel`

The modal surface. Models NSAlert / NSPanel — a self-contained, focusable layer above the
canvas with instant dismiss (no fade, per design language rule).

**Props:**
```ts
type PetalPanelProps = {
  title: string
  body?: string          // secondary informative text below title
  children?: ReactNode   // form content, field slots
  onClose: () => void
  'aria-label'?: string
}
```

- Escape key → `onClose` (bound internally, not delegated to consumer)
- Overlay click → `onClose`
- `stopPropagation` on panel click (standard)
- Dismiss is instantaneous — no CSS transition on visibility

**Surface spec** (modal/dialog from `design_language.md`):
- Overlay: `rgba(255, 255, 255, 0.4)` + `backdrop-filter: blur(12px) saturate(130%)`
- Panel background: `linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,246,250,0.94))`
- Border: `1px solid rgba(255, 255, 255, 0.36)`
- Shadow: elevated tier `0 12px 32px rgba(15,23,42,0.16)` + inset highlight
- Radius: `var(--radius-border-frame)` (6px)
- Width: `440px` fixed — no `min()`, no `clamp()`

---

#### Component: `PetalButton`

Token-correct button with semantic intents. Models NSButton / SwiftUI button roles — the
vocabulary of `intent` over visual description forces callers to state purpose, not appearance.

**Props:**
```ts
type PetalButtonProps = {
  intent?: 'default' | 'primary' | 'destructive'  // default: 'default'
  size?: 'md' | 'sm'                               // default: 'md'
} & React.ButtonHTMLAttributes<HTMLButtonElement>
```

**Visual spec:**
- `default` — `rgba(255,255,255,0.9)` bg, `1px solid rgba(0,0,0,0.1)` border,
  `var(--color-primary-fg)` text, subtle shadow
- `primary` — `var(--color-accent-blue)` bg, white text, no border
- `destructive` — transparent bg, `var(--color-accent-red)` text, red-tinted border

Radius: `var(--radius-border-frame)` on all variants. No pill, no hard-coded hex, no gradients.

macOS convention: in any panel with a primary and cancel action, the primary button is `intent="primary"`,
cancel is `intent="default"`. For irreversible actions (delete, discard) use `intent="destructive"`.
The Enter key equivalent is always the `type="submit"` button or the first primary-intent button.

---

#### Component: `PetalField`

Label + input or textarea. Models NSTextField — the label is part of the component, not
a sibling element, so layout and focus association are never the consumer's problem.

**Props:**
```ts
type PetalFieldProps = {
  label: string
  hint?: string          // secondary label line (usage note, character limit, etc.)
  as?: 'input' | 'textarea'  // default: 'input'
} & React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>
```

**Visual spec:**
- Height (input): `36px`
- Border: `1px solid rgba(0, 0, 0, 0.12)`
- Background: `rgba(255, 255, 255, 0.9)`
- Radius: `var(--radius-border-inner)` (4px)
- Focus ring: `border-color: var(--color-accent-blue)` + `box-shadow: 0 0 0 3px rgba(30,135,255,0.14)`
- No hard-coded hex on text or background

---

#### Implementation order

1. Create `src/renderer/src/components/petal/`
2. `PetalButton.tsx` + `PetalButton.css` — no dependencies, used everywhere
3. `PetalPanel.tsx` + `PetalPanel.css` — depends on nothing
4. `PetalField.tsx` + `PetalField.css` — depends on nothing
5. `petal/index.ts` — barrel export of all three

---

### 4. `CreateBoardModal` — refactor as first Petal consumer

Fix token violations and refactor to use Petal primitives. First real consumer validates
the API before SettingsModal and the Canvas inline modals are touched.

**Token violations to clear:**
- `border-radius: 24px` on panel → `var(--radius-border-frame)`
- Shadow blur 60px → elevated tier
- `border: rgba(255,255,255,0.64)` → modal pattern border
- `color: #172033` (title, field label, input) → `var(--color-primary-fg)`
- `color-mix(..., #273349)` → `var(--color-secondary-fg)`
- `border-radius: 14px` on input → `var(--radius-border-inner)`
- `border-radius: 999px` on buttons → `var(--radius-border-frame)`
- `background: linear-gradient(#172033, #234772)` on primary → `var(--color-accent-blue)`
- `color: #1f2937` on button → `var(--color-primary-fg)` / white
- `@media (max-width: 560px)` → remove
- `width: min(460px, ...)` → `440px` fixed

**After refactor:** `CreateBoardModal.css` should contain only layout-level rules
(panel width, header spacing, actions row alignment). All surface, radius, shadow, and
color rules live in Petal.

---

### 5. Backfill remaining callsites

After CreateBoardModal proves the Petal API, refactor in order:

1. **`SettingsModal`** — PetalPanel + PetalField throughout, SettingsModal.css reduced to
   sidebar layout and section spacing only
2. **`Canvas.tsx` inline modals (×4)** — all four collapse to `<PetalPanel>` + `<PetalButton>`
   rows; the inline CSS classes (`canvas-modal__*`) are deleted entirely
3. **`canvas-shell-actions__button`** — audit whether these belong as PetalButton or stay
   as toolbar-context buttons (different surface, different rules)
