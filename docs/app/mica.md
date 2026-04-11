# Mica

`Mica` is Whitebloom's generic floating-window and drag infrastructure.

It exists to solve two related UI problems:

- host-scoped floating windows
- screen-space drag sessions that can survive richer host layouts and, later, separate native windows

Arrangements is the first consumer, but `Mica` is not Arrangements-specific.

## Core split

- `Mica` owns interaction infrastructure
- features own domain meaning

In practice:

- `Mica` decides which floating windows exist, where they are, and which one is focused
- `Mica` owns drag session state, pointer position, registered drop targets, and active hover target resolution
- Arrangements translates drops into domain commands like `moveMaterialOnDesktop`, `assignToBin`, `addToSet`, and `sendToTrash`

That separation is important. We do not want Arrangements domain logic leaking into generic window or drag plumbing, and we do not want Mica to know what a bin or set means.

## Coordinate model

The drag system is intentionally screen-space oriented.

- active drag state lives in screen coordinates
- drop targets register screen-space bounds
- each consumer converts from screen space into its own local space as needed

Examples:

- the desktop converts pointer screen coordinates into desktop-local coordinates, then into world coordinates using camera state
- a bin content view can treat the same pointer as local hit-test input
- a future native window can report its own bounds and targets to the same coordinator model

This is the main architectural choice that keeps the current renderer-hosted implementation compatible with future multi-window work.

## Current Mica modules

### `model.ts`

Defines the generic host and window record model:

- `MicaHostPolicy`
- `MicaHostState`
- `MicaWindowRecord`
- `MicaWindowOpenInput`
- `MicaHostSnapshot`

Important rules baked into the model:

- windows are host-scoped
- windows have stable ids
- windows remain screen-space relative to their host
- host policy controls whether a host allows one window, one per kind, or many

### `hostCoordinator.ts`

This is the pure state coordinator for window ownership.

It is intentionally outside React and exposes:

- `getSnapshot()`
- `subscribe()`
- `open()`
- `retarget()`
- `move()`
- `close()`
- `focus()`
- `setWindowUiState()`
- `clear()`

Why it exists:

- the original `useMicaHost()` hook was enough for renderer-local windows
- native multi-window support will eventually need window state authority to move upward
- this coordinator creates that seam now without changing feature-facing contracts

Today, `useMicaHost()` simply wraps a coordinator with `useSyncExternalStore`. Later, a higher-level coordinator can replace the local one.

### `MicaHost.tsx`

`MicaHost` renders a host content plane and a separate overlay plane for windows and drag overlays.

That separation matters because floating windows and drag overlays must not inherit transforms from the underlying content surface.

Responsibilities:

- measure host bounds
- render visible windows
- clamp dragged window movement to the host region
- keep titlebar drag handling separate from interactive controls

### `MicaWindow.tsx`

Generic chrome for a Mica window.

Current behavior:

- left-side close control
- titlebar drag handle via `data-mica-drag-handle="true"`
- opt-out regions via `data-mica-no-drag="true"`
- generic slots for toolbar, sidebar, and content

### `drag.ts`

This is the generic Mica drag broker.

It defines:

- `MicaDragSession`
- `MicaDragPayload`
- `MicaDragSource`
- `MicaDropTargetDescriptor`
- `MicaDragHoverState`
- `MicaDragCoordinator`

The drag state tracks:

- current session
- pointer position
- registered drop targets
- active target id
- hover timing state

Important behavior:

- drag sessions are screen-space
- targets register bounds in screen space
- target compatibility is based on payload kind
- overlapping targets resolve by newest registration
- hover state tracks `enteredAt` and optional `intentDelayMs`
- preview metadata can carry multi-item stack information

The file still includes a Zustand-backed default implementation, but consumers should think in terms of the coordinator boundary, not the store itself.

## Drag coordinator model

The drag system now has an explicit coordinator seam, similar to window ownership.

`drag.ts` exposes:

- `getMicaDragCoordinator()`
- `setMicaDragCoordinator()`
- `resetMicaDragCoordinator()`

The default coordinator is backed by the local Zustand store. That keeps current behavior simple, but future native-window work can swap in another coordinator without forcing feature code to change.

Feature code should prefer:

- `useMicaDragState()`
- `useMicaDropTarget()`
- `getMicaDragCoordinator()`

Feature code should avoid directly depending on `useMicaDragStore` unless there is a very specific local-only reason.

## Drop target registration

Drop targets are registered through `useMicaDropTarget()`.

Each target supplies:

- `id`
- `hostId`
- accepted payload kinds
- measured bounds
- optional metadata
- optional `hoverIntentDelayMs`

The hook:

- measures the element in screen coordinates
- keeps bounds in sync on resize and scroll
- registers and unregisters the target with the active drag coordinator

This is what allows Arrangements desktop, bins, trash, set rows, and bin content areas to all participate in the same drag session model.

## Hover intent and richer preview hooks

The current drag layer includes infrastructure for Finder-like polish without forcing that UX yet.

Relevant pieces:

- `hoverIntentDelayMs` on targets
- `getMicaDragHoverElapsedMs()`
- `isMicaDragHoverIntentReady()`
- `useMicaDragHoverIntent()`
- `MicaDragPreview.stackCount`

This gives us:

- spring-load timing hooks for bins or set targets
- multi-item ghost stack metadata
- a place to hang richer acceptance or insertion feedback later

The important constraint is that these are infrastructure hooks, not domain actions. Mica can tell us that a hover intent is ready; Arrangements decides what to do with that.

## Arrangements contract

Arrangements currently uses Mica through a thin adapter in `components/arrangements/arrangementsDrag.ts`.

That adapter is responsible for:

- defining the Arrangements drag payload
- defining source semantics like `desktop`, `bin`, `trash`, and `set`
- defining Arrangements drop target metadata
- resolving a Mica drop into explicit Arrangements commands

This is the intended pattern for future consumers too:

- generic infrastructure in Mica
- feature-specific adapter beside the feature

## Current settled behavior

### Windowing

- host-scoped window state, not domain-store-owned window state
- Arrangements currently uses one primary bin-view window per host
- retargeting an existing bin window is preferred over creating duplicates
- window geometry is session-local for now
- floating windows remain visually separate from the desktop/content layer

### Dragging

- no HTML5 drag/drop for Arrangements material movement
- all Arrangements material drag state is owned by Mica infrastructure
- drops are command-oriented on the Arrangements side
- drag sessions remain renderer-local today, but the API is no longer tied to that assumption

## Native multi-window direction

This sprint did not implement separate native windows. It prepared for them.

What is already done:

- window ownership can be driven by a pure coordinator
- drag ownership can be driven by a swappable coordinator
- Arrangements does not need to change its domain contract to benefit from that

What future work will need:

- a real cross-window coordinator implementation
- relaying pointer updates between windows
- relaying registered target data between windows
- deciding whether any authority truly needs to move above renderers

Important constraint:

- do not casually move Arrangements domain logic into Electron main

Whitebloom's baseline is still that main stays thin and filesystem-oriented. If native multi-window coordination requires a higher authority, that should be introduced deliberately and only for the infrastructure boundary.

## Guidance for future work

- keep `Mica` generic
- keep domain commands outside `Mica`
- prefer coordinator-facing APIs over renderer-local store assumptions
- preserve screen-space drag semantics
- keep selection state separate from drag state
- keep overlays and windows on layers that do not inherit content transforms
- treat native-window support as a coordinator swap, not a feature-level rewrite

