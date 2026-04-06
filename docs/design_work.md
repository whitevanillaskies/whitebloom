# Design Work

Reference `design_language.md` for the authoritative token and surface pattern rules.

---


## Icon node visual unification

All bud icon nodes — badge-style (SchemaBloom), custom SVG (Obsidian), and OS-provided system icons (NativeFileBudNode) — must render at a single hardcoded icon size. Consistent sizing is what makes a canvas grid feel coherent and premium (macOS Dock / Finder icon view).

### The constant

```ts
// canvas-constants.ts
export const BUD_ICON_PX = 52
```

52 px is the icon content size along the longest axis. No transparent outer wrapper — the icon element itself is the full visual element, centered inside the 88 px wide `PetalBudNode` container by `align-items: center`. Node total height becomes 52 + 7 (gap) + ~16 (label) ≈ 75 px.

### Three archetypes

**Badge icons** (SchemaBloom, any future Lucide-based module)

`PetalIconBadge` renders at exactly `BUD_ICON_PX × BUD_ICON_PX`. The colored square with rounded corners and drop-shadow IS the icon — no outer wrap. Inner glyph at 50 % of badge size (`Math.round(BUD_ICON_PX * 0.5)` = 26 px). The `size` prop on `PetalIconBadge` drives both values; callers must now pass `BUD_ICON_PX`, not a hardcoded `64`.

**Custom SVG icons** (Obsidian, future branded modules)

SVG rendered as `<img>` at `width={BUD_ICON_PX} height={BUD_ICON_PX}`. The element has no outer wrapper. **Contract: icon SVG files must have a tight viewBox — content fills the canvas on its longest axis.** If a delivered SVG has excess whitespace, that is the module author's bug to fix; the renderer just shows it at `BUD_ICON_PX` and the whitespace will be self-evident. Remove the 64 px transparent wrapper div in `ObsidianBloomNode` and render the `<img>` directly at `BUD_ICON_PX`.

**OS-provided system icons** (NativeFileBudNode)

`<img>` element at `width={BUD_ICON_PX} height={BUD_ICON_PX}`, no outer wrapper. Remove the 64 px `native-node__icon-wrap` div and its CSS. The icon image itself goes directly as a child of `PetalBudNode`. OS icons from `app.getFileIcon()` are square PNGs and fill their bounds, so no further adjustment is needed.

### Implementation checklist

- [ ] Add `BUD_ICON_PX = 52` to `canvas-constants.ts`
- [ ] `SchemaBloomNode`: pass `size={BUD_ICON_PX}` to `PetalIconBadge` (down from 64); update fill ratio to 50 % in `PetalIconBadge`
- [ ] `ObsidianBloomNode`: remove 64 px wrapper div; render `<img>` at `BUD_ICON_PX × BUD_ICON_PX`
- [ ] `NativeFileBudNode`: remove `native-node__icon-wrap` div and its CSS; render icon `<img>` at `BUD_ICON_PX`; remove fallback `<File>` sizing that references the old 64 px wrap
- [ ] Delete `.native-node__icon-wrap` and `.native-node__icon` rules from `NativeFileBudNode.css`; keep only `.native-node__icon-fallback` color rule if the fallback icon is kept

---

## Handle visual system

Two visual inconsistencies introduced with the edges MVP:

**Handle color.** TextNode handles render in ReactFlow's default blue. BudNode handles render in ReactFlow's default black. Neither matches the design language. Handles should have a unified style: a small filled circle, `--color-primary-bg` fill with a `--color-secondary-fg` stroke (or the reverse — needs a decision). Apply via a global CSS rule in `Canvas.css` targeting `.react-flow__handle` so it covers both node types without touching component code. The active/connecting state (when a handle is being dragged from or hovered as a drop target) should use an accent color — `--color-accent-blue` is a reasonable default.

