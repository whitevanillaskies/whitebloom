# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.

---

## FocusWriter: Mode Overhaul + Caret Color

### Context

`FocusWriterEditor.tsx` currently has two modes: `edit` and `preview`. We are expanding to three modes: **typewriter**, **dynamic**, and **preview**. There is also a bug fix and a caret style change.

---

### Step 1 — Bug Fix: Preview mode key-exit inserts character

STATUS: DONE.

**Problem:** `handlePreviewKeyDown` calls `setMode('edit')` on a regular keypress, but the key event is not prevented, so the character gets inserted into the textarea when focus returns.

**Fix:** In `handlePreviewKeyDown`, remove the "any regular keypress returns to edit mode" branch entirely. Preview mode is exited **only** via `Ctrl+P`. The `Escape` key still flushes and closes.

---

### Step 2 — Mode type update

STATUS: DONE.

Change the mode type from `'edit' | 'preview'` to `'typewriter' | 'dynamic' | 'preview'`.

Default mode: `'typewriter'` (matches current edit behavior most closely).

Add a mode toggle bar or keyboard shortcuts:
- `Ctrl+P` — toggle preview on/off (returns to whichever writing mode was active before)
- `Ctrl+T` — switch to typewriter mode
- `Ctrl+D` — switch to dynamic mode
- `Escape` — flush save and close (all modes)

---

### Step 3 — Typewriter mode

STATUS: DONE.

Behavior: the active paragraph is scrolled to vertical center of the viewport. Other paragraphs are dimmed (existing behavior). Active paragraph is bright.

Implementation notes:
- The editor root (`fw-editor`) must be a `position: relative` scrollable container (or use `window` scroll).
- The mirror's paragraph `<span>` elements have real DOM positions. Read the active span's `offsetTop` + `offsetHeight`, then scroll the container so that midpoint lands at `containerHeight / 2`.
- On every `activePara` change, run the centering scroll (smooth).
- On initial mount and mode entry, run once after a rAF so layout is settled.
- The textarea grows to match content (existing behavior); make sure the container has enough top/bottom padding so the first and last paragraphs can actually reach center.

---

### Step 4 — Dynamic mode

STATUS: DONE.

Two internal sub-states (not exposed as top-level mode): `seek` and `focused`.

**Seek sub-state** (default on mode entry):
- All paragraphs rendered at full opacity — no dimming.
- Cursor is free; user can click/arrow anywhere.

**Focused sub-state**:
- Active paragraph is bright; all others are dimmed (same visual as typewriter).
- No centering scroll.

**Transitions:**
- `seek → focused`: any printable character keypress (`e.key.length === 1 && !isMod`).
- `focused → seek`: `Ctrl+L`, OR cursor moves to a **different** paragraph (detected by comparing `activePara` before vs. after `onSelect` / `onClick`).

Implementation notes:
- Track sub-state in a `useRef` (or `useState`) scoped inside the dynamic-mode branch.
- In `MirrorContent`, accept an `allBright` boolean prop; when true, render all spans with the active class (or a neutral class) instead of dimming.
- The paragraph-change detection: capture `activePara` at the start of a click/select handler, then after `rAF` read the new value; if different, switch to `seek`.

---

### Step 5 — Caret color

STATUS: DONE. Used `var(--color-accent-blue)` (`#1e87ff`).

In `FocusWriterEditor.css`, add to the textarea rule:

```css
caret-color: var(--color-primary-blue);  /* or the actual token from the design system */
```

Confirm the exact CSS variable name from the existing design tokens / CSS variables in the codebase before hardcoding.

---

### Step 6 — Mode indicator UI (small)

Add a minimal mode label or icon in a corner of the editor so the user knows which mode they are in. Keep it subtle (low opacity, small caps). This is optional but recommended for discoverability.

