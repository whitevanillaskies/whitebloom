# Design Work

Reference `design_language.md` for the authoritative token and surface pattern rules.

---

## Experiment: Embossed Controls

A subtle neumorphic treatment for controls that sit on a solid, near-white surface. The idea is a raised/pressed vocabulary using paired outer light and dark shadows, with inset shadows added for the pressed state.

**Proposed token values** (scaled for actual button/control sizes, not the outsized codepen demo values):

```css
.embossed-raised {
  box-shadow:
    -4px -4px 8px 0px rgba(255, 255, 255, 0.9),
     4px  4px 8px 0px rgba(13, 39, 80, 0.08);
}

.embossed-pressed {
  box-shadow:
    -4px -4px 8px 0px rgba(255, 255, 255, 0.9),
     4px  4px 8px 0px rgba(13, 39, 80, 0.08),
    inset -3px -3px 6px 0px rgba(255, 255, 255, 0.7),
    inset  3px  3px 8px 0px rgba(13, 39, 80, 0.12);
}
```

**Where it may work well:**
- **Mica window chrome** — the window title bar is already a flat, opaque surface. The close button is a natural first candidate. The bar background may need to be forced to be white for the shadow gradient to read correctly.
- **Settings modals** — modal background is near-white; embossed buttons could feel premium without calling attention to themselves.
- **Popup panels / dialogs** — same reasoning as modals; solid white background is the prerequisite.

**Where it will likely break:**
- Floating toolbars and glass panels that use `backdrop-filter` + a gradient background — the non-uniform background destroys the shadow illusion. Consider it potentially broken on any surface that isn't a flat solid color.
- Dark mode (if ever adopted) — neumorphism fails entirely on dark surfaces.

**Constraints to respect regardless:**
- Shadow blur must stay within the 32px ceiling from `design_language.md`.
- Keep offsets small (4–6px) to avoid the puffy Fisher Price look.
- This is an additive shadow treatment only — do not change border-radius or add borders alongside it.

**First trial:** Mica window close button. If it reads well there, expand to other controls on solid-white surfaces.

---

