# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Current focus: Mica-level drag system for Arrangements

We are explicitly **not** turning Arrangements into a React Flow surface. Arrangements should remain a desktop-style spatial shell, not a node graph. The immediate goal is to move drag-and-drop ownership upward so that the same interaction model works for:

- desktop icon to desktop repositioning
- desktop icon to bin window
- bin window to desktop
- bin window to bin window
- future separate native windows

The guiding split is:

- **Mica owns drag infrastructure**
- **Arrangements owns drag meaning**

That means Mica should become the host-level interaction substrate for cross-window dragging, while Arrangements translates drops into domain commands such as `assignToBin`, `removeFromBin`, `moveMaterialOnDesktop`, and `sendToTrash`.

## Architectural direction

### 1. Introduce a generic `MicaDrag` subsystem

Add a Mica-level drag session manager that is independent from Arrangements data structures. It should be able to power any future windowed interaction in Whitebloom, not just Arrangements.

Core responsibilities:

- Track an active drag session in **screen space**
- Carry typed drag payload data
- Register and unregister drop targets
- Hit-test targets across Mica windows and the desktop host
- Emit hover / enter / leave / drop state
- Support a renderer-local implementation now, while keeping the API compatible with future main-process coordination for separate `BrowserWindow`s

The Mica drag system should not decide what a drop means. It only decides:

- what is being dragged
- where the pointer is
- which target is currently active
- when a drop starts, hovers, exits, and completes

### 2. Keep Arrangements as a consumer of Mica drag

Arrangements should define its own drop target adapters on top of Mica:

- **Desktop target**
  - Accepts arrangement materials
  - Converts screen coordinates into desktop world coordinates
  - Removes the material from any bin assignment
  - Persists desktop placement

- **Bin target**
  - Accepts arrangement materials
  - Assigns the material to the target bin

- **Trash target**
  - Accepts arrangement materials
  - Sends the material to trash

This keeps desktop semantics, bin semantics, and later set semantics out of Mica itself.

### 3. Stop relying on HTML5 drag/drop as the core interaction model

The current HTML5 drag approach is acceptable as a temporary scaffold inside one renderer tree, but it should no longer be treated as the long-term foundation.

Reasons:

- HTML5 drag is awkward for custom multi-item previews
- it becomes brittle across layered hosts and custom windows
- it does not map cleanly to future native multi-window drag orchestration
- it makes spring-loaded behaviors and richer hover state harder to control

Short-term migration is acceptable, but the target state is pointer-driven custom drag managed by Mica.

## Proposed shape of the Mica drag API

The exact names can change, but the system should support concepts like:

- `startDrag(payload, source)`
- `updateDrag(pointer)`
- `cancelDrag()`
- `completeDrag()`
- `registerDropTarget(descriptor)`
- `unregisterDropTarget(targetId)`

Drag payloads should be typed and generic, for example:

- `arrangements-material`
- `board-node`
- `workspace-file`

For Arrangements, the first real payload should support:

- one or more material keys
- source context
  - desktop
  - bin
  - trash
  - future set
- drag preview metadata

Drop targets should expose:

- accepted payload kinds
- target identity
- target-local hit testing or bounds
- optional hover callbacks
- drop dispatch hooks that notify the consumer, not domain mutations inside Mica

The active drag session should remain serializable enough that later we can mirror it across processes if we promote Mica windows into separate native windows.

Important boundary:

- Mica may determine which target is active and when a drop occurs
- Mica should **not** directly mutate Arrangements state
- Arrangements should translate drop outcomes into explicit domain commands such as `assignToBin`, `moveMaterialOnDesktop`, `removeFromBin`, and `sendToTrash`
- Those commands should continue to flow through the normal store command path rather than bypassing it through drag callbacks

## Coordinate model

This is the critical design constraint for future separate windows.

- **Mica drag state lives in screen coordinates**
- **Each consumer converts from screen coordinates into its own local space**

Examples:

- `ArrangementsDesktop` converts screen coordinates into desktop-local coordinates, then into world coordinates using camera state
- a `BinView` target converts screen coordinates into content-local hit areas if needed
- future native windows can report their bounds to the same drag broker and still participate

This is the main reason the drag system belongs in Mica-level infrastructure rather than inside Arrangements components.

## Windowing implications

The current `MicaWindow` is still a renderer-hosted floating surface, but separate native windows are planned. Build this in two stages:

### Stage A: single-renderer Mica host

Implement the drag broker entirely in the renderer:

- one drag store
- one registry of live targets
- one drag overlay / preview layer
- Mica windows and desktop surfaces register targets against it

This is the implementation path now.

### Stage B: native multi-window Mica

Keep the same conceptual model, but move drag-session authority upward as needed:

- a dedicated windowing coordinator owns active drag session state
- each window reports bounds and registered targets
- pointer updates and drag events are relayed between windows

Do **not** assume by default that this authority belongs in the Electron main process. Whitebloom's architectural baseline is still that the main process remains filesystem-oriented and thin. If native multi-window drag later requires coordination above individual renderers, that coordination layer should be introduced deliberately without casually moving Arrangements domain logic or rich UI state into main.

If Stage A is built around screen-space sessions and target registration, Stage B becomes an adaptation rather than a rewrite.

## Finder-like behavior we should keep the door open for

These are not the immediate implementation target, but the architecture should not block them:

- rubber-band marquee selection on desktop and in icon views
- additive and subtractive multi-select
- multi-item drag payloads
- custom drag ghost stacks
- spring-loaded bin opening on hover
- insertion / acceptance highlight states
- move vs copy vs alias semantics via modifiers
- clean up / snap to grid commands without making the desktop a grid system
- keyboard-driven open, rename, trash, and navigation

The important rule is that selection state and drag state should remain separate concerns. Rubber-band selection will likely belong to Arrangements desktop and specific views, while drag session ownership should remain in Mica.

## UX and design-language constraints

The Mica drag layer is infrastructure, but it will still be visible to the user through hover states, previews, and overlays. Keep `design_language.md` in mind:

- prioritize high-precision pointer feedback over decorative motion
- avoid theatrical drag effects, elastic flourish, or heavy animated transitions
- use restrained, premium macOS-like feedback similar to Finder or pro desktop tools
- keep overlays visually light and intentional rather than turning drag into a large glassy spectacle
- use accent color only to communicate acceptance, focus, insertion, or danger states
- never require the user to wait for an animation to regain control
- any dismissal or drag-cancel visual state should clear immediately, never with a fade-out

## Implementation plan

### Phase 1: establish Mica drag primitives

- Add a new Mica drag module and store under `src/renderer/src/mica/`
- Define drag session types, drop target registration types, and coordinate conventions
- Add a drag overlay plane to `MicaHost` for previews and active target feedback
- Provide hooks/utilities for:
  - starting a drag
  - registering a drop target
  - reading current drag hover state

Deliverable:
- a generic host-level drag broker operating in one renderer tree

### Phase 2: migrate Arrangements consumers to Mica drag

- Replace `draggable` / `dataTransfer` usage in desktop items and `BinView`
- Register Arrangements desktop as a screen-to-world drop target
- Register bin rows, bin content, and trash as typed drop targets
- Route all successful drops through existing Arrangements store actions

Deliverable:
- desktop-to-bin, bin-to-desktop, and bin-to-bin drag works through Mica drag rather than HTML5 drag/drop

### Phase 3: normalize domain commands and source semantics

- Make sure Arrangements drag handlers express intent cleanly:
  - move to desktop
  - assign to bin
  - send to trash
- Define how source context affects behavior
- Ensure future set support can plug in without changing Mica drag internals

Deliverable:
- Arrangements drag behavior is explicit, command-oriented, and ready for more target types

### Phase 4: prepare for richer desktop interactions

- Add shared selection primitives that can support multi-select later
- Reserve shape for drag previews carrying multiple materials
- Keep hover timing hooks ready for spring-loaded window or bin behaviors
- Avoid hard-coding assumptions that only one item is ever dragged

Deliverable:
- architecture remains compatible with rubber-band selection and Finder-style polish

### Phase 5: native multi-window follow-up

- Revisit Mica host ownership once separate native windows are introduced
- Promote drag session authority upward if needed
- Keep the Arrangements-facing target contract stable

Deliverable:
- native-window migration path without changing Arrangements domain logic

## Immediate coding priorities when implementation starts

1. Add the generic Mica drag types and store.
2. Add drop target registration and active-target hit testing in screen space.
3. Add a Mica-level drag overlay plane.
4. Convert Arrangements desktop, trash, bin icons, and `BinView` into registered drop targets.
5. Remove dependence on `dataTransfer` for Arrangements material moves.

## Non-goals for this pass

- No React Flow conversion for Arrangements
- No Finder-style animation polish yet
- No rubber-band selection implementation yet
- No native separate-window implementation yet
- No redesign of Arrangements visual language beyond what is needed to support the logic

## Success criteria

This work is successful if:

- Arrangements drag logic is no longer owned by individual components through HTML5 drag/drop
- Mica becomes the interaction layer for cross-window dragging
- Arrangements retains ownership of drop semantics
- the resulting system can later support separate native windows without an architectural reset
