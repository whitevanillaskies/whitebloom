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

### Phase 5: native multi-window follow-up

- Revisit Mica host ownership once separate native windows are introduced
- Promote drag session authority upward if needed
- Keep the Arrangements-facing target contract stable

Deliverable:
- native-window migration path without changing Arrangements domain logic

## Immediate coding priorities

1. Revisit Mica host ownership and coordination once native separate windows are introduced.

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
