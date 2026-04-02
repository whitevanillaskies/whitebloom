# Current Work

Canvas-level floating selection toolbar, replacing per-node NodeToolbar instances.

## Phase 1 - Extract SelectionToolbar component

Create `src/renderer/src/canvas/SelectionToolbar.tsx` as a standalone component.
Move the placeholder toolbar content (currently duplicated in two places in `TextNode.tsx`) into it.
The component receives `selectedNodes: RFNode[]` as its only prop for now.
No positioning logic yet — just the component shell and content.

## Phase 2 - Remove NodeToolbar from TextNode

Strip both `NodeToolbar` blocks from `TextNode.tsx`:
- The one inside the editing branch (line 554)
- The one in the non-editing selected branch (line 613)

Clean up any imports that are no longer needed (`NodeToolbar`, `Position` if unused).

## Phase 3 - Bounding box positioning logic

Add a hook or utility `useSelectionBoundingBox(selectedNodes)` that:
- Takes the selected nodes' `position` and `data.size` fields
- Returns the flow-space bounding box (minX, minY, maxX, maxY)
- Returns `null` when nothing is selected

Keep this pure/testable — no DOM or RF calls inside it.

## Phase 4 - Wire SelectionToolbar into Canvas

In `Canvas.tsx`:
- Derive `selectedNodes` from the local `nodes` state
- Render `<SelectionToolbar>` as a fixed-position overlay (not inside ReactFlow's node tree)
- Use `useReactFlow().flowToScreenPosition` to convert the bounding box top-center to screen coordinates
- Position the toolbar div via inline `style` (top/left with `transform: translateX(-50%)` for centering)
- Hide when `selectedNodes` is empty or while dragging

## Phase 5 - Polish and edge cases

- Toolbar should not flicker when selection changes (verify no layout jumps)
- Dragging nodes: toolbar should either hide or track smoothly — decide and implement
- Verify toolbar does not intercept pointer events on the canvas (use `pointerEvents: 'none'` on wrapper, `'auto'` on the toolbar itself)
- Verify single-select still looks correct (toolbar above single node)
