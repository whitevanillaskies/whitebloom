# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Process Diagram Shapes On Canvas

Goal: add a first pass of process/flow diagram shapes as canvas nodes that behave as leaf nodes, do not bloom, and render crisply at arbitrary sizes while preserving per-shape resize rules. The first shipped set should include rectangle, slanted rectangle, diamond, circle/ellipse, and terminator. Shapes should render with both fill and stroke. This work should also establish the styling model that edges can adopt later for stroke color and stroke thickness.

### Phase 1: Data Model And Styling Foundation

Work unit 1.1: Add a new leaf subtype for shape nodes.
- Extend the board node model with a persisted shape payload rather than forcing shapes through the bud/module/resource pipeline.
- Store shape-specific data inline on the board node so shapes remain self-contained and do not depend on blossom files.
- Keep the persisted payload simple and explicit: `preset`, `style`, `label`, `size`, and future-safe fields for ports or geometry overrides.

Work unit 1.2: Define a reusable stroke/color style contract.
- Introduce a shared style type for stroked vector elements that can later be reused by edges.
- Shape styles should support:
  - `stroke.width`
  - `stroke.color`
  - `fill.color`
- Color values should support both named theme tokens and hardcoded custom values in the future.
- Recommended shape for color values:
  - token color: `{ kind: 'token', value: 'blue' }`
  - custom color: `{ kind: 'custom', value: '#RRGGBB' }`
- Shapes should use both stroke and fill.
- Edges should later reuse the same stroke color and stroke width concepts, but edges should not gain fill.

Work unit 1.3: Define preset metadata separate from node instances.
- Create a shape preset registry with metadata for:
  - display name
  - icon
  - default size
  - minimum size
  - resize policy
  - label inset calculation
- Store whether a shape may be nonuniformly scaled as preset metadata.
- Recommended field:
  - `allowNonUniformScale: boolean`
- Initial policy guidance:
  - rectangle: `true`
  - slanted rectangle: `true`
  - diamond: `true`
  - circle/ellipse: `true`
  - terminator: `true`
- Even where `true`, each preset still owns its own geometry math so the shape keeps a coherent silhouette at different aspect ratios.

### Phase 2: Rendering Architecture

Work unit 2.1: Add a dedicated `ShapeNode` React Flow node component.
- Register a separate node type on the canvas rather than routing shapes through `BudNode`.
- Keep shape nodes in the leaf-node family semantically, but render them through their own React Flow node component for clarity and future expansion.
- `ShapeNode` should own:
  - SVG rendering
  - selection visuals
  - resize handles
  - shape label container
  - handle/port rendering

Work unit 2.2: Build a parametric SVG preset registry.
- Implement shapes as React components that compute SVG geometry from current width and height.
- Do not rely on a library of arbitrarily stretched SVG assets for the primary implementation.
- Each preset should define:
  - `renderShape({ width, height, style, selected })`
  - `getLabelBox({ width, height })`
  - `getConnectionAnchors({ width, height })`
  - `minSize`
  - `allowNonUniformScale`
- Keep the registry hybrid-ready so later entries may be either computed shapes or designer-authored assets with custom rules.

Work unit 2.3: Establish stroke rendering rules now.
- Shapes should render with SVG strokes, not CSS borders, so visual behavior matches future edge styling.
- Normalize stroke width behavior across zoom and export decisions later, but initially keep stroke width in flow-space units so it scales naturally with the node.
- Use rounded joins and caps where appropriate to avoid brittle corners on curves and terminators.
- Add a shared helper to resolve token colors into CSS variables and pass custom colors through untouched.

### Phase 3: Basic Shape Presets

Work unit 3.1: Rectangle.
- Freely resizable.
- Uniform label inset on all sides.
- Serves as the baseline for stroke/fill and label behavior.

Work unit 3.2: Slanted rectangle.
- Freely resizable.
- Use parametric corner offsets rather than a fixed transform so the slant remains visually intentional at different sizes.
- Clamp the slant offset to a percentage of width and to a minimum/maximum pixel range.

Work unit 3.3: Diamond.
- Freely resizable for now.
- Compute the four points from current width and height.
- Use a tighter label box than the full bounds so text stays clear of the corners.

Work unit 3.4: Circle/Ellipse.
- Treat this as one preset family with `allowNonUniformScale: true`.
- A perfect circle is just the equal-width/height case.
- Use ellipse geometry directly rather than a circle asset to avoid later migration work.

Work unit 3.5: Terminator.
- Render as a capsule/rounded terminator with geometry derived from width and height.
- Permit nonuniform scaling, but preserve a sensible end-cap radius by clamping radius math.
- Define a label inset that respects the curved ends.

Work unit 3.6: Optional extra basic preset.
- Add one more simple process-diagram shape if implementation cost stays low.
- Best candidate: document.
- Only include it in the first pass if its bottom-wave geometry still looks deliberate across the intended resize range.

### Phase 4: Resize Behavior And Interaction

Work unit 4.1: Support per-preset resize constraints.
- Reuse the existing corner-resize interaction model already used by media nodes.
- Enforce per-preset min sizes.
- Respect `allowNonUniformScale` during resize:
  - if `true`, width and height may change independently
  - if `false`, preserve aspect ratio from the active corner
- Keep the policy at the preset level, not the node instance level, unless we later add user-togglable aspect locking.

Work unit 4.2: Prepare for shape-aware connection anchors.
- Start with the existing four cardinal anchors for all basic shapes so the feature ships quickly.
- Store enough registry metadata to later support shape-specific anchor sets and named ports.
- The renderer should be able to evolve from generic handles to preset-aware handles without changing the persisted node format.

Work unit 4.3: Label layout.
- Render labels inside the node, not as external edge-like badges.
- Use preset-specific label boxes so text stays within the visually safe area.
- Keep label layout simple in the first pass: single text block with center alignment.

### Phase 5: Palette, Defaults, And Authoring

Work unit 5.1: Add shape creation affordances.
- Add shape presets to the canvas palette/menu as first-class creation actions.
- Each action should create a shape leaf node with the preset default size and default style.

Work unit 5.2: Define initial default styles.
- Default shape appearance should be explicit and consistent:
  - fill color from a neutral board token
  - stroke color from a foreground/accent token
  - stroke width from a shared default constant
- Avoid coupling these defaults to ad hoc CSS classes in each preset.

Work unit 5.3: Leave room for future inspector controls.
- Even if no inspector UI ships in the first pass, the data model should already support future editing of:
  - stroke width
  - stroke color
  - fill color
  - preset swap

### Phase 6: Edge Styling Follow-Through

Work unit 6.1: Refactor edge styling to use the same stroke model concepts.
- Keep shape and edge styling in separate persisted types if needed, but share the same color-resolution and stroke-width conventions.
- Expand edge data to support:
  - stroke width
  - token/custom stroke color
  - existing line style variants such as solid/dashed/dotted

Work unit 6.2: Avoid a dead-end edge color format.
- The current edge color model is too shallow for long-term styling.
- Migrate edges away from plain string color values toward the same token/custom representation used by shapes.
- Preserve backward compatibility when loading old boards.
