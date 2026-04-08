# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Arrangements: create bins and create sets via context menu + palette

Implement Arrangements creation around a combined `A + B` approach:

- Spatial creation should be first-class in Arrangements.
- Keyboard-command creation should also exist for discoverability and speed.
- Both entry points should call the same internal command handlers so behavior stays consistent.
- This requires foundational UI work before the bin/set features themselves:
  a reusable custom context menu surface and palette support outside the canvas.

### Product direction

- Do not use Electron's native context menu for Arrangements.
- Build a custom context menu inspired by macOS interaction quality, but styled as a Whitebloom floating surface.
- The custom context menu should become a reusable app surface, not a one-off Arrangements implementation.
- On the Arrangements desktop, right click should open a desktop context menu with `New Bin`.
- On the `Sets Island`, right click should open a context menu with `New Set`.
- The command palette should open inside Arrangements and other non-canvas views, not just on the board canvas.
- The Arrangements palette should expose `New Bin` and `New Set` in v1.
- Follow-up palette actions such as `Rename Bin`, `Rename Set`, `Remove Bin`, and `Remove Set` should be designed into the command layer even if some land after creation.

### Interaction rules

- `New Bin` from desktop context menu creates the bin at the pointer location in world space.
- `New Bin` from the palette creates the bin at a deterministic default location:
  prefer the current viewport center in world space.
- `New Set` from the `Sets Island` context menu creates a root set by default.
- If the user right clicks an existing set row, the menu should support creating a child set under that set.
- `New Set` from the palette should create a root set unless a set context is explicitly supported.
- Creation should immediately enter rename mode so the user can confirm intent without extra clicks.
- Empty states should remain helpful:
  if no sets exist yet, the `Sets Island` empty state may include a visible `Create set` affordance that calls the same action.

### Implementation plan

1. Build a reusable custom context menu / contextual popover component for the app.
2. Style it using the floating surface rules from the design language rather than native OS menus. Styled just like `SlashCommandPlugin`
3. Define how command palette invocation works outside the canvas so non-board views can participate.
4. Refactor or extend palette ownership so Arrangements can provide its own command list without copying board-specific behavior.
5. Add Arrangements command handlers in the renderer/store layer for:
   `createBinAtPoint`, `createBinAtViewportCenter`, `createRootSet`, and `createChildSet`.
6. Add the missing store mutations and persistence wiring for bin creation and set creation.
7. Add lightweight rename-entry state so newly created bins/sets immediately become editable.
8. Add a desktop context menu surface in Arrangements Desktop with world-space placement support.
9. Add a `Sets Island` context menu surface for root-set and child-set creation.
10. Enable the Arrangements palette and provide a root command list appropriate to that view.
11. Add `New Bin` and `New Set` palette items wired to the same command handlers used by the context menus.
12. Verify that context menu actions, palette actions, and drag/drop flows coexist without conflicting pointer handling.

### Technical notes

- The Arrangements desktop already owns camera state, so it is the right place to translate screen coordinates into world coordinates for `New Bin`.
- The context menu should feel macOS-inspired in density and interaction, but remain fully custom so behavior and styling stay coherent across platforms.
- The command palette already has a contextual mode system. Reuse that model instead of building a second palette implementation for Arrangements.
- Palette infrastructure should become app-level rather than canvas-owned, with each view supplying relevant commands.
- Arrangements should gain a view-specific palette item list, not a board-flavored palette copied into another screen.
- Context menus should be custom app surfaces rather than native browser menus so styling and future command reuse remain consistent.
- Keep the creation pipeline decoupled from presentation:
  menu items and palette items should dispatch commands, not duplicate creation logic inline.

### Suggested sequencing

- First land the reusable custom context menu surface.
- Then land palette support outside the canvas.
- Then land store support plus direct test hooks for creating bins and sets.
- Then wire desktop and `Sets Island` right-click menus.
- Then wire Arrangements palette actions to the same commands.
- Finish by tightening rename polish, empty states, and any command naming cleanup.

### Validation

- Open the custom context menu in Arrangements and confirm it feels and behaves like a coherent Whitebloom floating surface across platforms.
- Open the command palette from Arrangements and confirm non-canvas views can participate without board regressions.
- Create a bin from desktop right click and confirm it appears where invoked.
- Create a bin from the palette and confirm it appears at viewport center.
- Create a root set from the `Sets Island` background.
- Create a child set from an existing set row.
- Create a root set from the palette.
- Confirm each creation path enters rename mode and persists after reload.
- Confirm palette opening in Arrangements does not regress the existing board-canvas palette.
