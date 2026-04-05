# Design Work

CSS files that deviate from the design language and need to be brought in line. Address one at a
time. Reference `design_language.md` for the authoritative token and surface pattern rules.

---

## 1. `src/renderer/src/components/start-screen/StartScreen.css`

STATUS: DONE

**Problems:**
- `border-radius: 18px` on cards — far above the 12px ceiling; should be frame (6px)
- Shadow blur of 44px on cards — above the 32px ceiling; use subtle tier
- Hard-coded `rgba(255,255,255,...)` gradients instead of the clean single-color card surface
- `clamp()` in padding — not needed, desktop fixed layout
- Action card hover uses `border-color: var(--color-accent-blue)` which is fine, but the
  base border is an opaque white gradient border that looks disconnected from the token system

**Target surface pattern:** inline card for `.start-screen__transient-card` and `.start-screen__action`.
Keep the frosted overlay background of the screen itself — it is a full-page surface, not a card.

---

## 2. `src/renderer/src/components/workspace-home/WorkspaceHome.css`

STATUS: DONE

**Problems:**
- `border-radius: 18px` on board cards and trash button — use frame (6px)
- Shadow blur of 44–54px — use subtle tier on cards, medium on hover lift
- Hard-coded `#172033`, `#1f2937`, `#8a1d3d` — replace with CSS variables throughout
- `.workspace-home__board-title` uses `color: #172033` directly; use `var(--color-primary-fg)`
- `clamp()` on the title font size — not needed
- `@media (max-width: 720px)` breakpoint — remove entirely
- `.workspace-home__button--primary` uses a dark gradient (`#172033 → #234772`); re-examine
  whether a primary action button belongs here and what it should look like per the design language

**Target surface pattern:** inline card for `.workspace-home__board`. The trash column button is
a secondary inline control — no floating treatment.

---

## 3. `src/renderer/src/components/workspace-home/CreateBoardModal.css`

STATUS: TODO

**Problems:**
- `border-radius: 24px` on the modal panel — use frame (6px)
- Shadow blur of 60px — use elevated tier (32px ceiling)
- Hard-coded `#172033`, `#1f2937` — replace with CSS variables
- `.create-board-modal__button--primary` dark gradient same issue as above
- `@media (max-width: 560px)` breakpoint — remove
- Input focus ring is correct in spirit (blue ring) but uses raw hex; align with token values

**Target surface pattern:** modal/dialog — see surface patterns in `design_language.md`.
The overlay backdrop is correct; the panel itself needs radius and shadow corrected.
