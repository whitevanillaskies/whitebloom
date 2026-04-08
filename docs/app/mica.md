
# Mica window manager

`Mica` is Whitebloom's generic window manager: a lightweight UI system for floating windows, named after the layered stone. It should behave like a tiny Quartz, but intentionally constrained for Whitebloom's calmer surface language. Arrangements is the first screen that should adopt it, but `Mica` should not be defined as Arrangements-only infrastructure.
- `Mica` owns floating window instances.
- A window instance must have its own id.
- `Mica` should be host-based: each screen that needs floating windows provides a `Mica` host region with its own bounds and policy.
- A host may choose whether it allows one window, multiple windows, or one window per kind.
- In v1, the Arrangements host should allow only one primary floating window at a time. Even if more windows are supported later, the ability to enforce "only one window of this kind" should remain.
- Opening a different bin while an Arrangements window is already open should retarget that same window to the new bin instead of spawning another one.
- Windows should remain screen-space relative to their host container, not world-space inside transformed content.
- Window position should persist when switching content within the same open window.
- The floating window layer should remain visually separate from the content layer beneath it.

**What `Mica` needs to manage.**

- Window identity: a UI-level `windowId`.
- Window kind: a generic discriminator such as `bin-view`, `inspector`, or other future window types.
- Window content routing: payload data owned by the feature using the window kind. For Arrangements v1, this is `kind: "bin-view"` with a referenced `binId`.
- Window geometry: at minimum `x` and `y`; likely also `width` and `height` even if resize is deferred.
- Window visibility lifecycle: open, retarget, close.
- Window focus policy: with one window this is simple, but the model should still preserve the idea that windows are focusable UI entities.
- Window chrome interactions: dragging by title bar, non-draggable controls inside the chrome, and safe pointer capture rules so canvas pan does not fight the window.
- Host coordination: the content layer and the window/overlay layer must remain separate so a floating window never accidentally inherits transforms from the underlying screen content.
- Renderer registration: features should be able to register how a given window kind is rendered inside a `Mica` host.
- Host policy: each host should be able to define limits such as single-window-only, one-window-per-kind, or unrestricted multi-window behavior.

**State model direction.**

- Build `Mica` as generic UI infrastructure rather than a special-case Arrangements store field.
- Keep domain state and UI state separate: bins remain content; windows remain presentation instances.
- Each host should own or scope the set of active windows that belong to it.
- Even with a single open window, model it as a window record rather than "the active bin."
- Feature-level payload changes should update a window's routed content, not recreate the window conceptually.
- Local per-window UI state should be considered explicitly: view mode, search query, selection, and last geometry.
- Arrangements should stop owning a bespoke `activeBinView` concept and instead talk to `Mica` through host-level open, retarget, move, and close actions.

**Behavior rules — settled.**

- **View mode: per-window, preserved on bin switch.** The user chose icon or list view for the window, not for the bin. Switching bin content doesn't reconfigure the window. Same rule as Finder: the window remembers its view mode across navigations.
- **Search: reset on bin change.** Search is a query against a specific bin's contents. Carrying a search term from one bin into another produces surprising results and bad empty states.
- **Selection: always clear on bin switch.** Selection is bin-local, and carrying it forward creates a real hazard — a user with items selected in Bin A switches to Trash, hits Delete, and permanently deletes something they selected earlier. Clear immediately on retarget, before content re-renders.
- **Window position: transient session state only; do not persist across restarts.** The benefit of position memory (not having to re-place the window after switching bins) is fully realized within a session. Cross-restart persistence adds fragile edge cases — off-screen windows, geometry from a different monitor, stale workspace context. Initialize to a sensible default on every app start. Add persistence later if usage shows a clear need.
- **Default window geometry: small, macOS-sized, not maximized.** `width: 460px`, `height: 380px`, `top: 48px`, `left: 28px` (within the desktop column, already clear of the Sets Island which is a sibling layout column). Min-width ~380px, min-height ~300px. The window should feel like a deliberate tool on the desktop, not a panel that took over the screen.
- **Retarget behavior: instant, no transition.** When double-clicking a bin while a window is already open, the content switches immediately. A crossfade or slide would feel more clever than helpful here and would complicate the implementation without user-facing benefit. Revisit only if testing reveals confusion.
- **Future non-bin window kinds: leave room in the type model, build nothing.** Use a discriminated union for `kind + payload` from day one: `{ kind: 'bin-view'; binId: string }`. Additional kinds (`inspector`, `preview`, etc.) can be added later without reshaping the core record. The type system carries this cost; the runtime does not.
- **Left-side close control: commit as the long-term Whitebloom pattern.** Any new window or modal going forward uses left-side close. Existing components get migrated opportunistically — no big-bang pass. The important thing is the decision is locked now so no new chrome is built in the old pattern.
- **Close control visual: simple, not macOS traffic lights.** A small `X` from the existing Lucide icon set. Left-positioned. No color, no hover animation. Furniture, not a feature. Leave room for a Whitebloom-specific glyph later without committing to one now.
- **Renderer registration: render prop for v1; no registry.** A global registry adds indirection with no payoff at one window kind and one host. Use a render prop instead: `<MicaHost policy={...} renderWindow={(win) => <BinView window={win} />}>`. Feature-owned rendering stays inside the feature. If a second host with multiple window kinds appears, that's the right moment to consider a registry.
- **`Mica` state: per-host via a `useMicaHost(policy)` hook; not in the arrangements domain store.** The arrangements store owns domain data (bins, sets, memberships, placements). Window geometry is pure presentation state. Mixing them recreates the `activeBinView` problem in a larger box. The hook returns `{ windows, open, retarget, move, close }`. The Arrangements component calls it and owns the resulting host state locally. `BinView` renders from the window record the host passes down. Zero contamination of domain state.
- **Render prop generic typing: discriminated union on `kind`, typed payload per kind, no `as` casts.** The render function receives a fully typed window record. The generic constraint on `MicaHost` ties the policy's known window kinds to the record union, so the render callback is typed to the exact payload shape for each kind. Worth specifying the type signature precisely before writing implementation code.

**Why this is worth doing.**

- It keeps Arrangements from accreting one-off overlay behaviors.
- It gives Whitebloom a single window grammar instead of separate local patterns per feature.
- It creates a clean seam between feature content and floating UI surfaces.
- It lets Bin View feel movable and desktop-native without locking the architecture to Arrangements forever.
- It gives Whitebloom a named UI primitive that can be extended later without rethinking the architecture from scratch.
