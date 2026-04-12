# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Commands Refactoring

### Problem

The current command architecture is close to supporting contextual commands, but the organizing concept is wrong.

`runtime context` should not be the primary axis anymore. It is effectively a weaker, less meaningful stand-in for major mode, and some of its values are vestigial. `arrangements` in particular should not drive the future design.

What we actually need is a command system that answers three separate questions:

1. Does this command belong in the current mode's vocabulary?
2. Is this command enabled for the current semantic subject?
3. Can the command still safely run when invoked right now?

Today those ideas are muddled together. The result is that commands can only be contextual if the current context object happens to expose the right facts, and major mode participation is not truly first-class.

### Target Model

Commands should be organized around these concepts:

- `modeScope`: the major mode or set of major modes where a command belongs.
- `subjectSnapshot`: a semantic snapshot published by the active surface/editor.
- `enabledWhen`: an optional predicate over the snapshot. If omitted, the command is always enabled within its `modeScope`.
- `run`: the command implementation, which must revalidate before acting.

This is intentionally more precise than the current runtime-context model.

`modeScope` controls discoverability. It answers whether a command should be surfaced at all in the current mode.

`subjectSnapshot` controls contextuality. It answers whether there is a meaningful subject right now. Commands should inspect semantic facts, not raw editor internals.

`enabledWhen` controls present-time availability. Some commands are only valid in certain snapshots. Others are always available. For example, a `tool.select-text` command can always be available in canvas-related modes because invoking it simply switches the active tool to text.

`run` revalidates because the snapshot may have changed between browse time and execution time.

### Subject Snapshot

The snapshot should be semantic and read-only. It should not be a giant bag of optional fields.

Each host should publish a normalized snapshot appropriate to its mode:

- Canvas:
  - current selection shape: none, single node, multiple nodes, edge selection, etc.
  - focused or primary node summary
  - selected module identity
  - active bloom if relevant
  - active tool
- PDF:
  - active PDF document
  - file/resource identity
  - page count
  - current page or current page selection if relevant
- Org:
  - element at point
  - enclosing entry at point
  - TODO state if present
  - clockability or other task-related semantic facts
- Other modules:
  - the equivalent semantic subject for that mode, not raw widget state

Commands should never have to reconstruct meaning from low-level editor state if the active mode can publish it once.

### Discoverability Rule

Only surface commands that are relevant to the current mode and currently available from context.

We are explicitly not following the Emacs model of surfacing a broad swamp of commands and then erroring late for many of them. Whitebloom should be more contextual than Emacs here. If a command is not meaningfully available from the current snapshot, it should not clutter the palette.

That means:

- `modeScope` gates whether the command belongs in the current mode at all.
- `enabledWhen` gates whether it appears as available for the current subject snapshot.
- `run` still revalidates for safety.

### Example: `pdf.extract-pages`

This should be one semantic command, not two unrelated public commands.

The user intent is the same in both places: extract pages from the active PDF into workspace materials. The only difference is host-specific follow-up behavior.

Shared behavior:

- identify the target PDF
- prompt for page selection
- extract selected pages as images into workspace files
- create or update a materials set such as `Extracted > PDF > <PDF Name>`

Host-specific behavior:

- In canvas mode with a selected PDF node, lay out the extracted pages on the canvas.
- In PDF mode, do not lay them out because there is no canvas host effect.

The command should therefore have:

- a shared semantic identity
- shared extraction logic
- host-specific post-actions that depend on the current subject (in this case, only canvas iff a pdf node is selected, or also PDF mode)

### Architectural Direction

We should move away from the old idea that commands are keyed primarily by runtime context like `canvas` or `arrangements`.

Instead:

- Make major mode the first-class discovery axis via `modeScope`.
- Make contextuality depend on a published `subjectSnapshot`.
- Treat host capabilities and post-actions as separate from command identity.
- Let commands belong to more than one mode when that reflects one coherent user intent.

This solves the important cases cleanly:

- A command can exist in both PDF mode and canvas mode without being duplicated.
- A command can be always available in a mode when its job is to change host state.
- A command can be narrowly contextual when it needs a specific semantic subject.

### Implementation Goals

1. Remove or retire the current `runtime context` abstraction as the primary command-model axis.
2. Replace it with a mode-scoped command model built around `modeScope`, `subjectSnapshot`, optional `enabledWhen`, and `run`.
3. Remove vestigial support that assumes `arrangements` is still a meaningful future command context.
4. Introduce a normalized snapshot contract that each major mode provides.
5. Ensure the palette only surfaces commands that pass both mode-scope and contextual availability.
6. Keep execution-time revalidation so commands remain safe under changing state.
7. Migrate ad hoc contextual commands into the canonical command path once the new model exists.

### Design Notes

- `enabledWhen` should be optional. Omitted means effectively "always enabled in this mode scope".
- The snapshot contract should be semantic, stable, and intentionally small.
- Host capabilities should remain available to command execution, but should not replace the snapshot.
- Avoid a giant untyped context object full of unrelated optionals.
- Prefer one command identity per user intent. Only split into separate public commands when the user intent itself diverges.

### Org-Mode Analogy

Org remains a useful contrast, but not a template.

In Emacs/Org, many commands are broadly exposed at the mode level and validate late against the current item or heading. Our goal is stricter and better contextual surfacing: commands should appear when they are actually meaningful for the current semantic subject, not merely because the user is somewhere inside a broad mode family.

For Org-like modes in Whitebloom, the important snapshot idea is:

- the current element at point
- the enclosing entry at point
- the TODO state
- any other semantic task facts needed for command enablement

That is the level at which commands such as TODO-state changes or clock actions should make availability decisions.
