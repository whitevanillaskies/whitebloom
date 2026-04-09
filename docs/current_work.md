# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Canvas Styling And Tooling Unification

Goal: turn the shape work into a coherent canvas styling system. The next implementation push should unify color language across shapes, edges, labels, and future text styling; replace placeholder edge controls with real styling support; add a shape toolbar; and consolidate toolbar/button UI so all canvas toolbars share the same primitives and do not drift visually.

### Phase 1: Shared Canvas Styling Language

Work unit 1.1: Define one canvas-wide color model.
- Standardize on the token/custom color representation across all new canvas styling work.
- Keep token colors semantic and quiet by default.
- Avoid introducing separate color formats for shapes, edges, label text, or toolbar state.
- The shape model should remain compatible with the current token/custom structure.

Work unit 1.2: Add a shared text color style contract.
- Introduce a reusable text-color representation for canvas-rendered labels and annotations.
- First consumers should be:
  - shape labels
  - edge labels
- Keep the contract future-ready for text nodes, but do not force a full text-node migration in the same work unit.
- Default text color should be the primary charcoal foreground token.

Work unit 1.3: Consolidate canvas style helpers.
- Move shared style resolution into common helpers rather than scattering color/stroke/text fallback logic across nodes and edges.
- The helpers should cover:
  - token/custom color resolution
  - default stroke props
  - default text color resolution
  - future marker color resolution
- Avoid “shape-only” or “edge-only” helpers where the underlying logic is identical.

### Phase 2: Shared Toolbar Primitives

Work unit 2.1: Create a shared floating toolbar shell.
- Extract the common floating glass toolbar chrome now duplicated between edge and text formatting toolbars.
- The shell should own:
  - background
  - border
  - shadow
  - padding
  - gap
  - pointer behavior
- Keep it suitable for all canvas-context toolbars, not only text.

Work unit 2.2: Create one shared toolbar button component and CSS.
- Replace duplicated toolbar button styling with a single reusable button primitive.
- The primitive should support:
  - icon-only buttons
  - active state
  - hover/pressed state
  - disabled state
  - optional grouped usage
- This should be the canonical canvas-toolbar button style, distinct from any app-window or Petal-specific styling that has different visual intent.

Work unit 2.3: Migrate existing toolbars onto the shared primitives.
- Update the existing edge toolbar and text format toolbar to use the shared shell and button component.
- Remove duplicated CSS once both are migrated.
- Verify the migrated toolbars still match the design language and remain capture-safe.

### Phase 3: Edge Styling Model And Rendering

Work unit 3.1: Replace the legacy edge style payload.
- Expand persisted edge styling from the current shallow model into a structured edge style object.
- The new edge style should support:
  - stroke width
  - stroke color (token/custom)
  - dash style
  - marker/arrowhead settings
  - edge label text color
- Keep backward compatibility when loading boards that still use the older edge color and line-style fields.

Work unit 3.2: Add marker and arrowhead support.
- Add marker definitions to edge rendering so edges can show:
  - no marker
  - arrow
  - future marker families if needed
- Ensure marker color follows the same resolved stroke color as the edge line.
- Support at least end markers first; keep the model open to start markers later.

Work unit 3.3: Unify edge label styling with the new text color model.
- Edge label text should resolve through the shared text style contract.
- Default edge label color should match the charcoal text language used elsewhere on the canvas.
- Keep label rendering minimal and precise; no decorative pill treatment unless intentionally designed later.

Work unit 3.4: Expand `WbEdge` rendering to consume the full style object.
- Stop treating edge styling as scattered top-level fields.
- `WbEdge` should render from one normalized edge style shape after compatibility resolution.
- Keep dash, stroke width, stroke color, marker, and label color flowing from the same normalized source.

### Phase 4: Edge Toolbar Becomes Real

Work unit 4.1: Replace the placeholder edge toolbar button with real controls.
- The current single placeholder button should be replaced by meaningful edge styling actions.
- First-pass controls should cover:
  - dash style
  - stroke width
  - marker/arrowhead toggle
  - stroke color
- Keep the toolbar compact and power-user friendly.

Work unit 4.2: Make edge toolbar actions operate on the normalized edge style model.
- Toolbar actions should update the structured edge style payload, not legacy ad hoc fields.
- If multiple edges are selected later, the model should be able to support batch application without redesign.

Work unit 4.3: Improve edge toolbar placement logic if necessary.
- Verify the toolbar still positions well once it contains more than one icon.
- If needed, switch from the current approximate anchor logic to edge-path-aware positioning.
- Keep toolbar visibility stable while panning and zooming.

### Phase 5: Shape Toolbar

Work unit 5.1: Add a dedicated shape toolbar for selected shape nodes.
- Show the toolbar only when a shape node selection context is active.
- The toolbar should be distinct from text formatting and edge styling, but use the same shell and button primitives.

Work unit 5.2: First-pass shape styling controls.
- Provide controls for:
  - stroke width
  - stroke color
  - fill color
- Keep defaults quiet and unaccented until the user chooses color.
- Do not overload the first version with every possible shape parameter.

Work unit 5.3: Leave room for future shape-specific actions.
- The toolbar architecture should be able to grow into:
  - preset swap
  - aspect lock toggle if ever needed
  - port/anchor editing
  - label alignment or text color controls
- Do not hardcode the toolbar around only the current three controls.

### Phase 6: Canvas-Wide Text Styling Follow-Through

Work unit 6.1: Apply shared text color styling to shape labels.
- Stop treating shape label color as a hardcoded CSS fallback.
- Resolve it through the shared text color model.

Work unit 6.2: Apply shared text color styling to edge labels.
- Edge labels should use the same text-color resolution path as shape labels.
- Avoid special-case label color code inside `WbEdge`.

Work unit 6.3: Prepare text nodes for later adoption.
- Do not fully redesign text-node styling here, but extract enough common infrastructure that text nodes can adopt the same color language later without duplicating code.
- Document what remains intentionally deferred for rich-text/editor-specific styling.

### Phase 7: Compatibility, Polish, And Validation

Work unit 7.1: Backward compatibility for existing boards.
- Ensure boards saved with legacy edge style fields continue to load correctly.
- Normalize old edge data into the new model at read time or render time.
- Avoid destructive migration requirements.

Work unit 7.2: Visual consistency pass across all canvas toolbars.
- Check spacing, sizing, hover states, active states, and focus behavior across:
  - edge toolbar
  - text format toolbar
  - shape toolbar
- Remove any remaining styling duplication that would allow drift.

Work unit 7.3: Export and thumbnail sanity checks.
- Verify that unified edge styling, markers, and shape styling survive board thumbnails and export capture.
- Ensure arrowheads, stroke widths, and label colors render consistently in captured output.

## Recommended Implementation Order

1. Build shared canvas color/text/stroke helpers.
2. Extract the shared floating toolbar shell and button primitive.
3. Migrate the existing text and edge toolbars onto the shared primitives.
4. Introduce the normalized structured edge style model with compatibility handling.
5. Add edge markers, label text color, and real edge toolbar controls.
6. Add the shape toolbar on top of the shared toolbar system.
7. Finish with canvas-wide text color adoption and export/backward-compat validation.
