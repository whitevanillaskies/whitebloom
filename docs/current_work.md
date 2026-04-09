# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

need to do:

- edge labels: double click edge to edit label, positioned at center by default, would be nice to be able to drag the label along the edge of the path (not during text edit mode) - decide if labels should pickup edge color or if they get their own color
- edge markers: arrowheads and possibly other ones, but for now just arrows
- text node, being able to select text and change color via the toolbar, just like we can set bold and italics
- shapes, being able to double click to enter shape label edit. Remove placeholder rectangle, ellipse, etc. labels, leave them unlabeled by default.


Recommended order is: finish the partially wired marker path first, use shape labels to establish the inline-label editing pattern, then do edge labels/dragging, and leave text color for last because it’s the riskiest integration with Lexical. The work in [docs/current_work.md](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/docs/current_work.md) maps mainly to [Canvas.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/Canvas.tsx), [WbEdge.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/WbEdge.tsx), [TextNode.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/TextNode.tsx), [ShapeNode.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/ShapeNode.tsx), [types.ts](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/shared/types.ts), and [board.ts](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/stores/board.ts).

**Decisions**
- Keep edge label color independent from edge stroke color. That direction already exists in [types.ts](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/shared/types.ts) via `labelColor`, and [docs/uiux/palettes.md](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/docs/uiux/palettes.md) treats edge-label color as a first-class styling target.
- Add new persisted data as optional fields instead of introducing a hard board-format change. There’s no real migration layer yet, so backward-compatible optional fields are the safest path.
- Treat text color as inline rich-text formatting, not a whole-node style, because the requirement is to select text and recolor it like bold/italic.

**Phase 1: Foundations And Quick Wins** (DONE)
- `WU-1.1` Finish edge marker rendering by forwarding `markerStart` and `markerEnd` through [WbEdge.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/WbEdge.tsx). The toolbar and edge mapping are already present in [EdgeToolbar.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/EdgeToolbar.tsx) and [Canvas.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/Canvas.tsx).
- `WU-1.2` Add optional edge-label layout data in [types.ts](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/shared/types.ts), ideally a path-relative position value so labels can default to center and later move along the curve.
- `WU-1.3` Add store helpers in [board.ts](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/stores/board.ts) for generic node-label updates and edge-label layout updates so shape/edge editing doesn’t piggyback on text-node-only APIs.

**Phase 2: Shape Labels** (DONE)
- `WU-2.1` Remove placeholder preset names from [ShapeNode.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/ShapeNode.tsx) so unlabeled shapes render with no text by default.
- `WU-2.2` Add double-click-to-edit for shape labels, using the preset label box from [shapePresets.ts](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/shapePresets.ts) as the edit region.
- `WU-2.3` Define commit behavior: blur/Enter saves, Escape cancels, empty text clears the label and returns the shape to the unlabeled state.
- `WU-2.4` Verify resize behavior so label placement still feels centered and correct while shapes are resized.

**Phase 3: Edge Labels**
- `WU-3.1` Add double-click-to-edit for an edge or its label in [WbEdge.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/WbEdge.tsx), with an inline input rendered through `EdgeLabelRenderer`.
- `WU-3.2` Persist edge label text and placement separately so new labels default to the bezier midpoint but can later move without affecting the edge itself.
- `WU-3.3` Implement drag-along-path behavior outside edit mode. The simplest robust version is “snap label to nearest point on sampled bezier positions,” backed by the path-relative field from Phase 1.
- `WU-3.4` Add edge-label color control to [EdgeToolbar.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/EdgeToolbar.tsx), reusing the existing popover pattern from [ColorControl.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/ColorControl.tsx).

**Phase 4: Text Node Inline Color**
- `WU-4.1` Extend the Lexical setup in [TextNode.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/TextNode.tsx) to support inline color styles on selected text.
- `WU-4.2` Expand [FormatToolbar.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/canvas/FormatToolbar.tsx) with a color control that reads the current selection state and applies color to the selection or typing style.
- `WU-4.3` Ensure readonly rendering still respects inline color styles when the node is not in edit mode.
- `WU-4.4` Verify undo/redo, mixed-format selections, collapsed-caret behavior, and interaction with existing bold/italic formatting.