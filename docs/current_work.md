# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Palette Refactor And Meta Commands

Goal: refactor the command palette so it remains available everywhere, including inside bloomed
module surfaces, and establish a separate power-user `Meta Palette` on `Alt+X`. Use lightweight
screen recording commands as the first scaffolding target. For now, recording commands only log to
the console so the command routing and palette layering can be validated without implementing real
capture.

### Product Direction

- `Tab` remains the global command palette entrypoint.
- `Alt+X` becomes the global meta palette entrypoint.
- Modules may contribute commands to either palette, but may not override `Tab` or `Alt+X`.
- Swiss Tool features such as recording should live in the meta-command layer rather than visible
  permanent UI.
- Meta commands should support terse aliases for fast execution, such as `rr`.

### Phase 1: Establish Palette Ownership

Work units:

- Audit the current palette trigger path and identify where it is bound only at the canvas level.
- Move palette ownership upward so it belongs to the Whitebloom shell rather than a single canvas
  surface.
- Define and document reserved key ownership:
  - `Tab` reserved for the global command palette
  - `Alt+X` reserved for the global meta palette
- Ensure modules can register commands but cannot intercept or replace those reserved entry keys.

Done when:

- `Tab` can open the main palette regardless of whether focus is on the canvas or inside a bloomed
  module surface.
- `Alt+X` can open a separate meta palette from the same contexts.

### Phase 2: Split Main Palette And Meta Palette

Work units:

- Introduce a palette mode distinction in the command system:
  - main commands
  - meta commands
- Keep the existing palette behavior as the basis for the main palette.
- Create a leaner meta palette presentation:
  - direct
  - terse
  - optimized for execution over explanation
- Add support for short aliases on command definitions.
- Make meta commands searchable by both label and alias.

Done when:

- Main palette and meta palette are separate command spaces.
- The meta palette can execute commands by short alias, e.g. `rr`.

### Phase 3: Make Palette Access Global

Work units:

- Ensure palette triggers work while a bloom modal/editor is open.
- Ensure the active module/editor can contribute context-sensitive commands without owning the shell.
- Add the necessary focus management so palette invocation does not depend on canvas DOM focus.
- Validate that the palette can be opened and closed safely from:
  - board canvas
  - PDF editor
  - future bloomed surfaces

Done when:

- Palette invocation is shell-level, not surface-level.
- Blooms can add commands, but the shell still controls palette entry and execution.

### Phase 4: Scaffold Recording Meta Commands

Work units:

- Add two meta commands:
  - `screen.start-recording`
  - `screen.stop-recording`
- Give them stable short aliases for testing, for example:
  - `rr` for start recording
  - `rs` or `sr` for stop recording
- Keep the commands hidden from the main palette.
- Expose them only in the meta palette.
- For the first pass, make both commands log clear console messages so execution can be verified.

Done when:

- `Alt+X`, then alias, then `Enter` executes the stub commands.
- Console logging clearly confirms start and stop command routing.

### Phase 5: Add Recording State Plumbing

Work units:

- Introduce a minimal app-level recording state:
  - idle
  - recording
- Make the start command no-op or warn if already recording.
- Make the stop command no-op or warn if nothing is recording.
- Add a single emergency stop shortcut candidate, likely `F8`, routed at the shell level.
- Keep the behavior console-only for now.

Done when:

- Command behavior reflects recording state rather than always logging blindly.
- `F8` can stop the stub recording state from anywhere in the app.

### Phase 6: Future Real Recorder Integration

Work units:

- Decide whether the first real implementation should use Electron/Chromium capture or a native
  per-OS backend.
- Keep the feature within Swiss Tool scope:
  - one job
  - low configuration
  - no attempt to replace OBS
- Add the smallest possible real contract:
  - start recording
  - optional microphone selection later
  - save output to file

Done when:

- Recording remains a small, power-user, meta-command utility rather than expanding into a
  specialist subsystem.

### Constraints

- Do not add permanent visible recording buttons to the main UI.
- Do not let modules override or capture `Tab` or `Alt+X`.
- Treat the command palette as the portable slab that contains Swiss Tools.
- Prefer direct aliases and stable command IDs over cute or verbose naming.
