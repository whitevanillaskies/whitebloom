# Command Palette UI/UX Contract

The Command Palette is a focused transient surface for keyboard-driven actions.

It is not the place where commands are authored.
It is the first major consumer of the shared command registry.

The architectural rule is:

**The command is the real unit of action. The palette is a dispatcher over that command space.**

This means the same underlying command identity should be reachable from the
palette, future menus, shortcuts, toolbar buttons, scripts, and agent tooling.

## Core Interaction

- The palette opens from the canvas with `Tab`.
- The palette works against a snapshotted invocation context captured when it opens.
- The palette shows only commands available in that snapshotted context.
- Arrow keys move the active selection.
- `Enter` activates the active item.
- `Escape` closes the palette unless latent command behavior later defines a stricter busy-state rule.
- Pressing `Tab` while the palette is open closes it.
- Clicking outside the palette closes it.

The palette should not be responsible for inventing or reinterpreting command
availability while open. Availability comes from command resolution against the
captured runtime context.

## Command Model

Each command has one required core identity and may optionally provide a
palette-facing presentation.

Core command:

- stable `id`
- optional aliases
- optional availability predicate
- optional args schema
- `run(...)`

Palette presentation:

- `title`
- optional `subtitle`
- optional `hotkey`
- optional `icon`
- bound to a specific command context such as `canvas` or `arrangements`

The presentation is not a second command. It is only a friendlier rendering of
the same underlying command identity.

## Contexts

Commands are registered against command contexts rather than against the palette
component itself.

Current contexts:

- `canvas`
- `arrangements`

The palette consumes whichever command set applies to the invocation context it
was opened from.

Examples:

- the canvas palette resolves canvas commands against current selection,
  insertion point, and available board actions
- the arrangements palette resolves arrangements commands against current
  material selection, available bins, sets, and arrangements actions

## Registry Model

The command registry is the authoritative source of command contribution.

Providers may come from:

- built-in app features
- modules

The palette should consume command entries from the registry rather than owning
hardcoded action definitions.

This keeps command authoring separate from palette rendering and ensures the
same command identity can be reused by other surfaces.

## Module Command Contribution

Modules may contribute command families directly as part of module registration.

Rules:

- module commands must still use the shared command registry
- module commands should be registered by context
- command IDs should remain namespaced and intention-shaped
- a module should contribute commands that match its semantic material, not
  palette-only conveniences

Examples of healthy module command families:

- `org.task.clock-in`
- `org.task.clock-out`
- `org.task.toggle-state`
- `org.table.insert-column`
- `db.schema.add-table`

This lets modules extend the language of the app instead of acting only as file
renderers or editors.

## Palette Modes

The palette supports transient modes layered on top of the shared command
system.

- Default mode presents commands through their palette-facing metadata.
- A command may enter a follow-up flow that it owns itself.
- A command may later also be reachable through a naked/meta mode that exposes
  canonical command IDs and virtual namespace narrowing directly.

Switching modes:

- clears the query
- resets active selection
- keeps the session bound to the same snapped invocation context

Closing the palette resets it back to the default root state for the next open.

## Follow-Up Flows

Some commands require follow-up input before final execution.

That branching logic belongs to the command, not to palette-local special
cases.

Examples:

- `Add URL Page` accepts a URL, then offers label strategies
- `Link Board` shows available local boards as a follow-up list
- future org commands may request schedule values, state changes, or other
  arguments through command-owned steps

The palette is responsible for rendering these steps and handing the final
typed args back to the command runtime.

## Availability and Visibility

- The palette should show what the user can do right now.
- Unavailable commands should be hidden, not rendered as disabled placeholders.
- This applies both to palette-facing presentation search and to future naked
  command browsing.

Command availability should come from the command runtime and context snapshot,
not from ad hoc palette conditionals.

## Latent Commands

The palette may dispatch synchronous or latent commands.

For latent commands:

- the command may report structured busy state
- the palette should show explicit loading/status text
- the underlying app should be visibly locked against accidental context churn
- stale async completion must not mutate a reset or reopened palette session

The initial latent model should stay structured:

- busy title
- optional label
- optional progress value

## Search and Dispatch

The palette should be able to consume two search styles from the command layer.

Presented search:

- matches palette titles and subtitles
- returns presentation metadata for rendering in default mode

Core search:

- matches canonical command IDs and aliases
- supports namespace narrowing
- powers future naked/meta command entry

Virtual namespace browsing should be derived from flat command IDs rather than
registered as separate tree objects.

Examples:

- `org.task.clock-in` is the real command
- `org`
- `org.task`

are derived browse segments, not separate command registrations.

## Programmatic Search and Run Notes

The command layer should remain usable outside the palette.

Current internal capabilities already support this direction:

- list registered commands for a context
- resolve commands by ID or alias
- search presented commands
- search core commands
- list virtual command namespaces
- execute commands by ID or alias
- validate and normalize args before execution
- emit execution events for future logging, undo, audit, or proposal flows

This should guide future scripting and agent-facing APIs:

- expose command search and invocation, not private store mutation
- prefer command IDs plus typed args as the mutation boundary
- treat command execution metadata and events as the basis for future
  observability

## Example Flow: Link Board

`Link Board` is a contextual command that creates a subboard link from the
current board.

- the command is only available when the invocation context can create buds,
  has an insertion point, and has local linkable boards
- activating it moves into a command-owned board-picking step
- the follow-up list should show valid local boards only
- the current board must not appear
- external boards must not appear
- each result shows the board name as the primary label
- each result may show workspace-relative location as secondary text
- activating a result creates the board bud through the shared command runtime

This is the model to preserve: the palette renders the flow, but the command
still owns the intent and final execution path.
