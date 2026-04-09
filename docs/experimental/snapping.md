# Snapping

Smart guides and snapping are a good fit for Whitebloom. This is one of those features that can feel intimidating from afar because Illustrator, Figma, and Miro all make it feel polished, but the underlying mechanics are not exotic. For this app, the important distinction is that we do not need a giant layout engine. We need a drag-time geometry layer that can:

- notice nearby alignment opportunities
- render transient guides
- bias the dragged position toward those guides
- hold the snap briefly so it feels intentional instead of jittery

That is well within reach of the current canvas architecture.


## Why custom is the right choice

- Paid helper-line features are off the table.
- Commercial graph editors are off the table.
- Adopting a different canvas stack just to get snapping would be a bad trade.
- Whitebloom already owns its drag pipeline, local node state, and transient drag cues.

This means snapping can be built as a thin, local feature rather than a platform migration. The goal is not "recreate every desktop design tool." The goal is "make dragging feel intelligent and alive."


## Interaction goals

- Align a dragged node's left, center, and right edges to nearby node left, center, and right edges.
- Align a dragged node's top, center, and bottom edges to nearby node top, center, and bottom edges.
- Show clear transient guide lines for active candidates.
- Support gap snapping later, so a dragged node can infer equal spacing between neighbors.
- Keep the feel soft and magnetic, not rigid and sticky.
- Make snapping consistent across zoom levels.
- Avoid jitter and rapid target flipping.


## Whitebloom-specific fit

Whitebloom already has the right structural pieces:

- Drag-time node updates are centralized in `Canvas.tsx` via `onNodesChange`.
- Local React Flow node state is already used for live drag positions.
- There is already precedent for drag-time transient cues in `ProximityTracker`.
- Persistent board state is only committed after drag completion.

That is exactly the shape snapping wants. The feature can sit between raw drag input and the temporary node position applied during drag.


## Proposed model

Treat snapping as a transient drag subsystem with three layers:

1. Geometry
   Computes candidate alignment and spacing targets from nearby nodes.
2. Behavior
   Chooses whether to preview, attract, lock, or release a snap.
3. Presentation
   Renders guide lines and spacing indicators in a lightweight overlay.

This keeps the logic understandable. It also makes it easier to evolve the "feel" later without rewriting the geometry.


## Cushioned snapping

Whitebloom should not default to harsh binary snapping. A better feel is possible.

Use three zones:

- `preview zone`
  The dragged node is near a valid guide. Show the line, but do not force the position yet.
- `magnetic zone`
  Start biasing the dragged node toward the guide. The pull should feel soft.
- `lock zone`
  When very close, commit to the guide and hold it until the cursor exits a wider release threshold.

This creates a cushioned feel:

- guides appear before the snap fully engages
- the node seems attracted rather than teleported
- small hand jitter does not break the snap instantly
- release feels deliberate rather than flaky

This is essentially hysteresis plus a positional bias. The snap should have different enter and exit thresholds.


## Basic geometry

For each node we care about three vertical anchors and three horizontal anchors:

- vertical: `left`, `centerX`, `right`
- horizontal: `top`, `centerY`, `bottom`

For the dragged node, compare those anchors against the same anchors on nearby nodes.

If the difference is within the screen-space threshold:

- compute the delta needed to align
- record the candidate guide
- rank candidates by distance and stability
- choose at most one dominant horizontal snap and one dominant vertical snap

The dragged node can then be offset by the chosen deltas before the temporary position is rendered.

This is enough for a strong first version.


## Gap snapping

Equal spacing is the harder part, but still tractable.

The basic idea:

- find neighbors on one axis
- compute the gap between existing node pairs
- test whether placing the dragged node would reproduce one of those gaps
- if so, show spacing indicators and offer a snap candidate

This should be phase 2, not phase 1. Alignment guides deliver most of the value quickly. Gap snapping can be added after the basic system feels solid.


## Coordinate system rules

Thresholds should be defined in screen pixels, not board units.

Why:

- snapping should feel the same at different zoom levels
- a 6 to 10 pixel tolerance is human-scale
- the canvas can convert that threshold into flow space for geometry checks

If snapping thresholds are stored in board units, zooming will make the interaction feel either impossibly strict or comically sticky.


## State shape

The transient snapping state should likely include:

- current active horizontal guide, if any
- current active vertical guide, if any
- current snap lock target, if any
- enter threshold
- release threshold
- guide segments to render
- optional gap indicators to render later

This state should live outside persisted board data. It is interaction state only.


## Overlay

Guide rendering can be very simple:

- one overlay layer above the canvas content
- absolutely positioned lines
- optionally small ticks or gap badges later
- pointer events disabled

There is no need for a heavyweight rendering system here. A lightweight HTML overlay is enough unless performance proves otherwise.


## Performance strategy

Start simple.

- compare against all visible non-dragged nodes
- ignore the dragged node itself
- ignore children when dragging a cluster as a single aggregate
- ignore deeply irrelevant nodes once a simple spatial filter exists

This will probably be fine for modest board sizes. If needed later:

- add viewport filtering
- add coarse bounding-box pruning
- add a small spatial index

Do not over-engineer the first version.


## Multi-node drag

When multiple nodes move together, snap the selection bounds, not each node independently.

That means:

- compute the aggregate bounds of the moving selection
- evaluate guide candidates against that aggregate box
- apply one shared delta to every dragged node

This avoids internal distortion and makes group drags feel coherent.


## Clusters

Clusters already have custom drag behavior and membership rules. Snapping should respect that.

- Dragging a cluster should snap the cluster's aggregate bounds.
- Child nodes should inherit the cluster delta, not seek their own independent guides.
- Snapping should not silently alter membership mid-drag.
- Membership should continue to be committed on drag completion according to the existing cluster rules.

This keeps snapping as a movement aid, not a new source of cluster semantics.


## Failure modes to avoid

- jitter when two nearby guides compete
- overly eager snapping when the cursor just passes by
- snapping that changes strength unpredictably with zoom
- guide flicker when candidate ranking flips every frame
- group drag distortion
- snaps that feel impossible to escape

Most of these are solved by:

- hysteresis
- dominant target selection
- screen-space thresholds
- one snap per axis at a time


## Suggested implementation order

1. Add a transient snapping model and overlay.
2. Add edge and center alignment for single-node drags.
3. Add hysteresis and cushioned magnetic behavior.
4. Extend snapping to multi-selection bounds.
5. Extend snapping to cluster drags.
6. Add equal-gap snapping and spacing indicators.
7. Tune thresholds and feel by hand with real board usage.


## Non-goals for v1

- full auto-layout
- rotation-aware snapping
- arbitrary angle guides
- baseline typography alignment
- obstacle avoidance
- "snap everything to everything" complexity

The first version should be disciplined: axis-aligned, legible, stable, pleasant.


## The real opportunity

The point is not only to match existing tools. Whitebloom can make snapping feel more alive and more humane.

Traditional design tools often make snapping feel abrupt: you drift near a guide, the object suddenly locks, then it chatters when you try to leave. Whitebloom can do better by making the guide visible before activation, using a soft magnetic pull, and keeping a little memory of the active target before release.

That combination would make dragging feel less mechanical and more intentional. It would also fit the broader Whitebloom goal: a canvas that behaves like a thoughtful instrument, not just a pile of rectangles.
