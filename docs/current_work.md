# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Planned: Command-Native Whitebloom

The command rework aligns strongly with `docs/experimental/emacs_commands.md` and supports the direction implied by `docs/experimental/org.md`, but the plan needs to widen from "better palette actions" to "command-native app architecture."

The key principle is:

**The command is the real unit of action. UI surfaces, scripts, and future agent tooling are only ways of reaching it.**

This means the palette is not the destination architecture. It is the first major consumer of the command system.

### Alignment With Experimental Docs

The current direction is aligned if we preserve these principles:

- commands are first-class and named
- every command has one canonical naked/core identity
- palette-friendly presentation is optional and layered on top of that core
- commands are registered in a central registry
- modules contribute commands
- commands are bound to contexts such as `canvas` and `arrangements`
- the palette searches and dispatches commands from the registry
- mutation prefers commands rather than direct store/component internals
- future scripting/LLM integration runs commands rather than mutating private data structures

`org.md` raises the stakes on this design: detached-org materials will only feel coherent if module-specific workflows such as `orgTask.toggleState` or `orgTask.clockIn` are first-class commands, not ad hoc editor buttons.

### Core Recommendation

- Keep the current context-aware command work.
- Broaden it into an internal command registry/runtime before doing more palette-specific specialization.
- Treat the webpage label-flow work as an early proving ground for follow-up flows and latent commands, not as the architectural center.

### Architecture Notes

- Commands should be self-contained units with their own follow-up flow.
- Every command should have one required naked/core command identity.
- A command may optionally provide a dolled-up presentation for palette-first discovery.
- Commands should be registered against one or more UI contexts such as `canvas` or `arrangements`.
- Modules should be able to contribute commands to a context.
- The palette should render and dispatch registered commands; it should not remain the place where command definitions fundamentally live.
- Default palette mode should prioritize dolled-up presentations.
- A dedicated naked-command mode should let power users search and autocomplete canonical command IDs directly.
- Toolbar buttons, menus, shortcuts, and future scripts should also dispatch the same underlying commands.
- Mutation should converge on commands rather than direct store surgery where practical.
- The command layer should become the public mutation boundary for future scripting and agent use.
- Do not use shell `curl` heartbeats.
- Prefer a tiny main-process network probe exposed via IPC.
- `navigator.onLine` can be used as a hint, but not as the source of truth.
- Latent/busy rendering should start structured and constrained, not fully arbitrary.

### Phase 0: Command Architecture Foundation

Goal: make commands first-class, self-contained, and context-bound so the palette becomes a command surface rather than a bespoke command authoring site.

Status:
- WU0.1 through WU0.4 are completed groundwork.

#### Work Unit 0.1: Define Command Contexts

- Introduce a command context concept for places such as:
  - `canvas`
  - `arrangements`
  - future surfaces as needed
- Each context should provide the runtime data/actions a command may need.
- Availability should be resolved against context, not against the palette component itself.

#### Work Unit 0.2: Define Command Contract

- Define a stable command contract with:
  - required naked/core command:
    - `id`
    - `aliases?`
    - `when?` / availability predicate
    - `argsSchema?` or equivalent future-facing input contract
    - `run(...)`
  - optional dolled-up presentation:
    - `title`
    - `subtitle?`
    - `hotkey?`
    - `icon?`
    - context-specific visibility metadata as needed later
- The naked/core command is the real command.
- The dolled-up form is presentation, not a second command identity.
- Keep `icon` optional in the type, but expected in palette-driven contexts for coherence with `design_language.md`.
- Icons should remain React components:
  - Lucide first
  - custom SVG later when justified
- Command IDs should be namespaced and intention-shaped.
- Prefer one canonical naming scheme rather than multiple equal spellings.
- Recommended direction: dot namespaces plus kebab-case segments.
- Example naming targets:
  - `board.add-bud`
  - `selection.align-left`
  - `node.bloom`
  - `arrangements.bin.create`
  - `arrangements.material.include-in-set`
  - `org.task.clock-in`
- Aliases can support convenience spellings such as camelCase later, but only one form should be canonical.

#### Work Unit 0.3: Define Self-Contained Command Flow

- A command should own any subcommands or follow-up input modes it needs.
- Example:
  - `Add URL Page` validates URL
  - then presents label-strategy follow-up actions
  - then runs sync or latent completion behavior
- This keeps higher-level surfaces from hardcoding per-command branching logic.

#### Work Unit 0.4: Define Command Registration

- Add a registry/provider model so built-in surfaces and modules can register commands.
- Modules should be able to say, in effect:
  - "I provide commands for the canvas"
  - "I provide commands for arrangements"
- The registry should aggregate commands by context and surface them to consumers.
- Keep existing module registration patterns in mind so command contribution feels native to the module system.
- This work should explicitly leave room for future module command families like:
  - `orgTask.*`
  - `orgTable.*`
  - `dbSchema.*`
  - `image.*`

#### Work Unit 0.5: Define Command Search and Invocation Surface

- Define internal APIs for:
  - list commands by context
  - search commands by query
  - search naked/core command IDs and aliases
  - search dolled-up presentations for palette mode
  - invoke command by ID with args/context
- Treat command hierarchy as virtual, not registered as separate tree nodes.
- Namespace browsing should be derived JIT from available command IDs.
- Example:
  - `org.task.clock-in` is the real command
  - `org`
  - `task`
  - `clock-in`
  - are browse/search segments inferred from the ID, not separate command objects
- Support narrowing by namespace segments in meta mode:
  - `org` then `Enter`
  - `task` then `Enter`
  - `clock-in`
- Keep the canonical command space flat even when the UI presents a hierarchy.
- Search/invocation APIs should accept a snapshotted invocation context, not live mutable app focus.
- The palette will be the first consumer, but not the only one.
- This is the minimum foundation needed for future menus, shortcuts, scripts, and LLM tooling.

### Phase 1: Internal Command Runtime

Goal: make the registry executable and safe enough to serve as the shared mutation layer.

#### Work Unit 1.1: Command Execution Runtime

- Implement command dispatch through the registry.
- Resolve availability against a rich runtime invocation context.
- Separate:
  - coarse context boundary such as `canvas` or `arrangements`
  - fine-grained availability over current target/focus/selection/module state
- Availability resolution should be strong enough that commands such as `org.task.clock-in` simply do not appear unless the current invocation context makes them meaningful.
- Validate or normalize args before execution where appropriate.
- Return structured results rather than ad hoc surface-specific behavior.

#### Work Unit 1.2: Mutation Boundary Discipline

- Identify existing intention-shaped actions that should bottom out to commands first.
- Start with command-worthy actions already named in the experimental direction:
  - create bud
  - bloom node
  - open with native editor
  - delete selection
  - align selection left
  - create bin
  - include material in set
- Avoid promising that every interaction must become a command immediately.
- Focus on stable, intention-shaped mutations first.

#### Work Unit 1.3: Logging / Undo Readiness

- Keep execution centralized enough that future undo/redo, audit, and proposal serialization remain viable.
- Do not yet overbuild a full history framework, but avoid designs that would bypass one.

### Phase 2: Palette as First Command Consumer

Goal: turn the command palette into a real command dispatcher over the registry.

#### Work Unit 2.1: Palette Consumes Command Registry

- Refactor palette assumptions so it consumes a generic command list for a snapshotted invocation context.
- The palette should remain responsible for:
  - filtering
  - focus/selection
  - rendering dolled-up command metadata in default mode
  - rendering naked/core command search results in naked mode
  - command execution handoff
- The palette should not be the canonical place where command definitions are authored.
- Default mode should surface dolled-up commands as first-class palette entries.
- Add a naked-command meta mode for power users.
- Preferred entry:
  - `Alt-X` opens the palette directly into meta mode
- Visual/default mode and meta mode should both dispatch the same underlying command IDs.
- Meta mode should support:
  - naked command search
  - virtual namespace narrowing
  - future command-key chord entry
- The palette should not attempt to re-resolve context while open.
- Opening the palette snapshots invocation context for the duration of that palette session.

#### Work Unit 2.2: Follow-Up Flow Ownership

- Support commands that present follow-up steps owned by the command itself.
- This is needed for:
  - URL -> label strategy
  - future arrangements workflows
  - future org workflows with argument collection
- This should work identically whether the command was reached from a dolled-up presentation or from naked mode.

#### Work Unit 2.3: Latent Command Foundation

- Extend command activation so commands may be synchronous or latent.
- Support latent work from both list commands and input-submit follow-up steps.
- Give latent commands access to a small control surface from the palette:
  - set busy label
  - set progress value or indeterminate spinner state
  - optionally replace mode on completion
- Keep the initial latent presentation structured:
  - spinner
  - busy title/label
  - optional progress
- Do not start with fully custom latent React content unless a real use case proves the structured model insufficient.
- Meta mode should eventually also support command-key chord aliases such as Emacs-like `C-c C-x C-i`, but only inside meta mode.
- Command-key chord aliases should remain alternate input paths to the same core command, not separate commands.

#### Work Unit 2.4: Busy / Frozen Palette UI

- Normal palette state:
  - no blur outside the palette
  - underlying app remains visible for reference
  - underlying interaction is blocked
  - outside click dismisses the palette instantly
- Latent palette state:
  - hard blur or equivalent unmistakable lock-state treatment outside the palette
  - block all input underneath
  - do not allow accidental context churn while work is running
  - pair the lock state with explicit loader/status text
- The palette should freeze the snapped invocation context for the entire session.
- Ensure stale async completions cannot mutate a palette that has already been reset or reopened.
- Decide what `Escape` does while latent work is active.

#### Work Unit 2.5: Hide Unavailable Commands

- The palette should show what the user can do right now.
- Commands that are unavailable in the current snapshotted invocation context should be hidden, not rendered disabled.
- This applies to both:
  - dolled-up visual mode
  - naked/meta mode namespace browsing
- Availability should continue to come from command resolution, not palette-local special casing.
- Exhaustive command discovery belongs in documentation and future command reference surfaces, not in the live palette.

### Phase 3: Broaden Command Consumption Across UI

Goal: prove commands are not palette-only.

#### Work Unit 3.1: Route Existing Palette-Created Actions Through Commands

- Replace direct palette-local action wiring with command dispatch for current canvas and arrangements actions.

#### Work Unit 3.2: Route Other Surfaces Through Commands

- Start routing selected context-menu actions, toolbar actions, and keyboard shortcuts through the same command IDs.
- Choose a small set of high-value actions first.

#### Work Unit 3.3: Establish Surface Symmetry

- Confirm the same underlying command can be reached from:
  - palette
  - meta-mode naked command entry
  - menu/context menu
  - toolbar/button
  - shortcut
- This is the architectural proof point from `emacs_commands.md`.

### Phase 4: Programmatic Command Surface

Goal: prepare for future console, scripting, and LLM use without exposing private internals prematurely.

#### Work Unit 4.1: Internal Search / Run API

- Define internal APIs equivalent in spirit to:
  - search commands
  - search command namespaces virtually from flat command IDs
  - run command by ID
- Keep this internal at first.
- Do not expose raw stores or React Flow internals as the mutation API.

#### Work Unit 4.2: Read Model vs Mutation Model

- Keep planning pressure toward:
  - readable object model for inspection
  - command-first mutation model for actions
- Mutation should prefer commands.
- Read APIs can come later, but this separation should guide the architecture now.

#### Work Unit 4.3: Capability Boundaries

- Future scripting/agent access should expose Whitebloom power, not arbitrary machine power.
- Network, filesystem, and process access should remain explicit host capabilities, not implicit side effects of command execution.

### Phase 5: Connectivity Capability Store

Goal: expose a lightweight, app-wide signal for whether network-backed commands are worth attempting.

#### Work Unit 5.1: Main-Process Network Probe

- Add a tiny IPC endpoint such as `network:probe`.
- Implement probe logic in the main process, not the renderer.
- Use a lightweight HTTP request with:
  - short timeout
  - redirect support
  - minimal body download
- Prefer Node/Electron networking over shelling out.

#### Work Unit 5.2: Renderer Zustand Connectivity Store

- Add a dedicated zustand store for connectivity state.
- Suggested state shape:
  - `status: 'unknown' | 'checking' | 'online' | 'offline'`
  - `lastCheckedAt`
  - `lastSuccessAt`
  - `startHeartbeat()`
  - `stopHeartbeat()`
  - `probeNow()`
- Keep this separate from app settings since this is runtime capability, not persisted preference.

#### Work Unit 5.3: Heartbeat Strategy

- Use `navigator.onLine` and browser `online` / `offline` events as hints only.
- Back that with active probing.
- Recommendation: do not run a permanent aggressive 5-second heartbeat globally unless needed.
- Better default:
  - immediate probe when the app starts or window regains focus
  - immediate probe when a connectivity-dependent command surface opens
  - slower background heartbeat after that

### Phase 6: Web Page Label Strategy as First Latent Command Flow

Goal: use the new command system to implement a real multi-step, partially latent command.

#### Work Unit 6.1: Add URL Page as a Real Command

- Move `Add URL Page` into the command registry.
- After URL submission, do not create the bud immediately.
- Normalize and validate the URL first.
- Hand control to the command's own follow-up flow.

#### Work Unit 6.2: Add Label Strategy Follow-Up

- Present:
  - `Use URL Name`
  - `Try Request Page Title`
  - `Set Label`
- `Use URL Name` should create the bud immediately with the current derived-label behavior.
- `Set Label` should switch into a second input mode that prompts for a custom label, then create the bud.

#### Work Unit 6.3: Add Page Metadata Fetching

- Add a main-process endpoint for lightweight webpage title fetching.
- Keep scope intentionally narrow:
  - fetch only enough HTML to extract `<title>`
  - enforce timeout
  - cap response size
  - avoid turning this into a general scraper
- `Try Request Page Title` should be implemented as a latent command step.
- On failure, fall back to the URL-derived label quietly.

### Phase 7: Org / Module Readiness

Goal: make sure the command architecture can actually support the module command families envisioned in the experimental docs.

#### Work Unit 7.1: Validate Module Command Contribution Shape

- Confirm that modules can register command families cleanly, not just single commands.
- The design should feel natural for future modules such as:
  - `orgTask.*`
  - `orgTable.*`
  - `orgNote.*`
  - `dbSchema.*`

#### Work Unit 7.2: Validate Detached-Org Workflow Fit

- Use the following as architectural litmus tests:
  - `orgTask.toggleState`
  - `orgTask.schedule`
  - `orgTask.clockIn`
  - `orgTask.clockOut`
  - `orgTable.insertColumn`
- If the command system makes these awkward, the architecture is not yet good enough.

### Phase 8: Hardening, UX, and Documentation

Goal: make the system safe to reuse for future commands and future command consumers.

#### Work Unit 8.1: Regression Coverage

- Test synchronous commands still behave as before.
- Test latent commands block interaction correctly.
- Test palette reopen/reset behavior after latent completion.
- Test registry search and invocation by context.

#### Work Unit 8.2: UI/UX Refinement

- Tune command metadata presentation.
- Tune loader placement and wording.
- Decide whether busy state should preserve the typed input visibly or replace it with a status surface.
- Decide whether latent commands should be cancelable in a later phase.

#### Work Unit 8.3: Update Docs

- Update `docs/uiux/commands_palette.md` to acknowledge the palette as command dispatcher rather than hardcoded action list.
- Document the command registry model and context-bound command contribution rules.
- Add implementation notes for future programmatic command search/run.

### Suggested Execution Order

1. Phase 0.5
2. Phase 1.1-1.3
3. Phase 2.1-2.5
4. Phase 3.1-3.3
5. Phase 5.1-5.3
6. Phase 6.1-6.3
7. Phase 4.1-4.3 and Phase 7.1-7.2
8. Phase 8 polish/hardening

This order keeps the architecture aligned with `emacs_commands.md`: registry first, palette second, shared mutation layer before scripting. It also keeps the webpage label flow as a useful proving ground rather than letting it dictate the architecture.

### Open Questions

- Whether command registration should live directly on `WhitebloomModule` or on a parallel command-provider registry.
- Whether the code terminology should stay `core/presentation` while product language stays `naked/dolled-up`.
- Whether `icon` should be merely optional in the command contract or required for palette-first contexts.
- Whether naked/meta mode should be explicit-only at first, or also auto-detected from typed query patterns later.
- What the exact canonical naked command naming scheme should be.
- Whether command-key chord aliases should land in the first meta-mode release or only after naked search/narrowing is solid.
- How broad the initial context set should be beyond `canvas` and `arrangements`.
- How much args-schema rigor should land early versus being phased in.
- Which existing mutations should be the first mandatory command-backed actions.
- Whether a future command reference/help surface should expose unavailable commands outside the live palette.
- Whether the connectivity heartbeat should be always-on, focus-scoped, or feature-scoped.
- Whether latent commands should support cancellation in the first implementation or only blocking/non-cancelable behavior.
- Whether structured latent presenters are enough initially, or whether there is a near-term real need for custom latent content.
