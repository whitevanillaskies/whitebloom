# Design Work

Reference `design_language.md` for the authoritative token and surface pattern rules.

---


## Handle visual system

Two visual inconsistencies introduced with the edges MVP:

**SchemaBloom handle positioning.** On SchemaBloom nodes the top handle is nearly flush with the node edge (barely offset) while the other three are positioned far outside the node boundary. This suggests the SchemaBloom `NodeComponent` renders at a size that doesn't match what the ReactFlow wrapper measures — likely because it uses an internal layout that doesn't report its height to RF correctly, or because it has extra padding/margin that skews the bounding box. Needs investigation: inspect the SchemaBloom node's rendered DOM, check its root element dimensions against the RF wrapper, and confirm whether `useUpdateNodeInternals` needs to be called after the node mounts or resizes.

**Handle color.** TextNode handles render in ReactFlow's default blue. BudNode handles render in ReactFlow's default black. Neither matches the design language. Handles should have a unified style: a small filled circle, `--color-primary-bg` fill with a `--color-secondary-fg` stroke (or the reverse — needs a decision). Apply via a global CSS rule in `Canvas.css` targeting `.react-flow__handle` so it covers both node types without touching component code. The active/connecting state (when a handle is being dragged from or hovered as a drop target) should use an accent color — `--color-accent-blue` is a reasonable default.

