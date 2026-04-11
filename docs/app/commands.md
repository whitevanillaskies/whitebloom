# Emacs-like Commands and a Command-Native Whitebloom

Experimental note. This is a direction worth exploring, not a commitment.


## Summary

Whitebloom appears to be a strong fit for an **Emacs-like command model**.

The important part is not copying Emacs literally. The goal is not to inherit
every key chord, every historical editing convention, or Emacs Lisp as such.
The interesting part is the deeper idea:

- most meaningful actions are named commands
- commands are first-class and discoverable
- a command palette is a real dispatcher, not just fuzzy UI search
- modules can contribute commands
- scripts call commands
- LLMs call commands
- buttons, menus, shortcuts, palette entries, and scripts all bottom out to
  the same command layer

This fits Whitebloom unusually well because the app is already converging on:

- file-backed materials
- modular behavior
- an explicit command pattern for mutations
- a human-plus-agent workflow model


## Why this fits Whitebloom

Whitebloom is trying to become an operating environment for knowledge work,
not just a canvas with some gestures attached. In a system like that, direct
manipulation alone is not enough. Once the app grows, users need a stable
action vocabulary.

That vocabulary should not live separately in each UI surface. It should be
one thing:

- the context menu invokes commands
- toolbar buttons invoke commands
- keyboard shortcuts invoke commands
- the Commands Palette invokes commands
- scripts invoke commands
- LLM tools invoke commands

This is one of the strongest things Emacs got right. The command is the real
unit of action. The UI is only one way of reaching it.


## Whitebloom should be command-native

Whitebloom should strive toward this principle:

**Everything the user can meaningfully do should ideally correspond to a named
command.**

That does not mean every tiny pointer movement needs a public command.
It means any stable, intention-shaped action should have one:

- create bud
- connect nodes
- delete selection
- align selection left
- bloom node
- open with native editor
- create bin
- include material in set
- archive board
- toggle task state
- clock in

If the app supports an action, there should be pressure to make that action
reachable through the same command system regardless of surface.


## Not literal Emacs

The right direction is **Emacs-like**, not "Whitebloom becomes Emacs."

Useful things to inherit:

- commands as the primary action abstraction
- discoverability through named commands
- programmable workflows
- a console or REPL for experimentation
- modules extending the command language of the app

Things Whitebloom does not need to inherit by default:

- Emacs Lisp specifically
- strict keyboard-chord culture
- one giant text-buffer worldview
- public access to arbitrary runtime internals

Whitebloom's own identity should remain intact. It is spatial, modular, and
asset-oriented in ways Emacs is not.


## Palette, console, and scripting

These are related, but they are not the same thing.

### Command Palette

The palette should become a real command dispatcher.

Instead of only exposing UI navigation or a hand-picked list of actions, it
should search across the command registry itself:

- native commands
- board commands
- module commands
- arrangement commands

The palette is the user's fast path to "run command X now."

### Console / REPL

If Whitebloom becomes scriptable, it likely needs a product-level console.
Not the browser devtools console. A real Whitebloom console.

Its purpose would be:

- inspect the current workspace, board, and selection
- search and run commands
- compose multiple actions
- test ideas quickly
- help both users and LLMs learn the action surface

This would be the "programmable scratch space" side of the command system.

### Scripting

Scripts should call approved commands and query a stable domain model.
They should not reach directly into stores, React components, Electron
internals, or private file layouts.

That keeps the public API smaller and more durable.


## Object model vs command model

Whitebloom should probably expose both a readable object model and a mutation
model, but they should not have equal weight.

### Readable domain objects

A scriptable object model is useful:

- `workspace`
- `board`
- `node`
- `edge`
- `selection`
- `module`

These can support inspection and traversal:

- `node.id`
- `node.label`
- `node.type`
- `node.edges()`
- `board.nodes`
- `selection.nodes()`

### Commands for mutation

Mutation should prefer commands:

- `wb.commands.run("board.addBud", ...)`
- `wb.commands.run("selection.alignLeft")`
- `wb.commands.run("node.rename", ...)`

This is safer than exposing raw mutable internals such as React Flow nodes or
Zustand state. The command registry becomes the public mutation layer. The
object model becomes the public read layer.


## Why command-first mutation is important

If scripts mutate internals directly, Whitebloom will accidentally freeze
private implementation details into public API.

That creates long-term problems:

- internal refactors become breaking API changes
- undo/redo becomes harder to reason about
- audit and action logging become weaker
- permissions and capability checks become inconsistent
- LLM tooling becomes less constrained and less reviewable

Commands solve much of that by concentrating mutation into one system.


## Modules should contribute commands

Whitebloom modules should be able to register commands alongside their editor,
thumbnail, shell, and other capabilities.

Examples:

- a markdown module could add `markdown.extractOutline`
- a DB schema module could add `dbSchema.addTable`
- a detached org task module could add `orgTask.clockIn`
- an image module could add `image.generateAltText`

This is important because it makes modules feel like extensions to the
language of the app, not just visual handlers for certain file types.


## Human and agent symmetry

The command system is especially attractive because it gives humans and LLMs a
shared action vocabulary.

The user can invoke:

- a palette command
- a shortcut
- a context menu action

An LLM can invoke:

- the same command ID with the same argument schema

This is cleaner than asking an LLM to synthesize low-level mutations or write
board JSON directly. It also composes naturally with Whitebloom's proposal
model: an agent proposal can simply contain serialized intended commands.


## TypeScript as the likely scripting language

If Whitebloom gets a scripting layer, TypeScript is the natural default.

Reasons:

- the app runtime is already TypeScript-oriented
- the domain model and command schemas can be shared directly
- modules already live in the same ecosystem
- documentation and examples can stay in one language
- the command surface can be strongly typed and discoverable

Python is attractive in the abstract because "scripting" often suggests it,
but it would introduce a split runtime and a bridge problem. That may be worth
revisiting later, but it does not look like the right first move.


## Capability boundaries

Whitebloom should expose **Whitebloom power**, not arbitrary machine power, by
default.

Good default capabilities:

- inspect current board
- inspect selection
- list commands
- run commands
- read approved workspace materials through host APIs

Riskier capabilities that should not be implicit:

- arbitrary filesystem access
- arbitrary process execution
- unrestricted network access
- direct Electron or Node APIs

This matters for both user-authored scripts and LLM-authored scripts.


## Sequencing

The healthy order is probably:

1. define the internal command registry
2. route palette actions through it
3. route UI mutations through it consistently
4. let modules register commands
5. expose command search and invocation programmatically
6. add a small console / REPL
7. only later decide how much saved scripting and automation to allow

This avoids prematurely freezing accidental internals into a scripting API.


## Example shape

Illustrative only:

```ts
type WhitebloomCommand<TArgs = unknown, TResult = unknown> = {
  id: string
  title: string
  when?: CommandPredicate
  argsSchema?: JsonSchema
  run(args: TArgs, ctx: CommandContext): Promise<TResult> | TResult
}
```

```ts
wb.commands.search("align")
wb.commands.run("selection.alignLeft")
wb.commands.run("board.addBud", {
  type: "markdown",
  position: { x: 320, y: 200 },
  label: "Research notes",
})
```


## Core principle

Whitebloom should not think of scripting as "letting people poke the app."

It should think of scripting as exposing a stable action language for the
workspace.

That is the part of Emacs worth learning from.
