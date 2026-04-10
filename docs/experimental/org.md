# Detached Org in Whitebloom

Experimental note. This is a philosophical and architectural direction, not a
planned feature set.


## Summary

Whitebloom seems like a strong fit for an **org-native material family**, but
not for a giant monolithic "org buffer inside Whitebloom."

The more interesting direction is **detached org**:

- Whitebloom does not implement org as one big scrolling document world
- instead, multiple bloomable materials are org-native in their own right
- each material is a first-class bud
- each bud stores valid Emacs Org Mode compatible text
- Whitebloom provides specialized views, commands, and previews around those
  files

This preserves org compatibility while keeping Whitebloom's own identity:
spatial composition at the board level, modular semantics at the material
level.


## The philosophical difference

Classic Emacs org is primarily document-spatial:

- one file, or a small set of files
- meaning emerges through outline order
- you move by scrolling, folding, refiling, narrowing

Whitebloom is board-spatial:

- many first-class materials
- meaning emerges through position, adjacency, grouping, and graph structure
- you move by navigating a board, blooming into focused editors, and arranging
  relationships spatially

So the question is not "should Whitebloom embed orgmode?"

The question is:

**Can Whitebloom adopt org as a text civilization while keeping its own
spatial ontology?**

Detached org is an attempt at "yes."


## Detached org

In this model, Whitebloom does not have one massive `.org` handler.

Instead it has multiple org-native bud types, for example:

- `org-note`
- `org-task`
- `org-task-list`
- `org-table`
- `org-clock-log`
- `org-schedule`

Each one:

- is its own bud on the board
- blooms into a focused editor suited to that material
- is backed by real Org Mode compatible text
- supports commands specific to its semantics
- can be opened in Emacs directly with no conversion step

This is not "org as inspiration." It is org as actual storage and
interoperability substrate.


## Compatibility should be an invariant

The strongest version of this idea is also the best one:

**Whitebloom org materials should always be valid Emacs Org Mode compatible
text.**

A user should be able to take a Whitebloom org file, drop it into Emacs, and
have it behave as ordinary org text with no cleanup step and no custom parser.

This should be treated as a real constraint, not a vague goal.

Consequences:

- the text file is primary
- Whitebloom-specific metadata must use org-compatible constructs
- export is trivial because the source is already org
- Emacs is a genuine alternate editor
- Whitebloom must resist inventing almost-org syntax


## Whitebloom should not own an alternate hidden model

If compatibility is sacred, Whitebloom should avoid keeping the "real" data in
some private format while merely exporting org as a projection.

The healthier principle is:

**Whitebloom does not own an alternative representation of org data. It owns
specialized views, commands, and spatial composition around real org files.**

That keeps the system honest.


## Metadata belongs in org metadata

Org already has places to carry metadata. Whitebloom should use those instead
of inventing invalid syntax.

Potential carriers:

- property drawers
- keywords
- tags
- scheduling and deadline fields
- logbook drawers
- ordinary heading structure where appropriate

For example:

```org
* TODO Research jasmine references     :perfume:summer:
SCHEDULED: <2026-04-10 Fri>
DEADLINE: <2026-04-14 Tue>
:PROPERTIES:
:WHITEBLOOM_ID: wb-node-018
:WHITEBLOOM_VIEW: task-card
:Effort: 2h
:END:
```

Emacs will parse this as ordinary org. Whitebloom can interpret the
`WHITEBLOOM_*` properties without damaging compatibility.


## Many modules, one text civilization

A detached-org family should probably be modular rather than unified under one
giant editor.

That means:

- one file per asset
- one module per semantic material or close family
- specialized bloom editors instead of one universal org surface

Examples:

### Org task

Focused task view with TODO state, scheduling, deadline, properties, tags,
clocking commands, and history.

### Org table

Focused table editor for org tables, still stored as plain org table syntax.

### Org note

A lightweight note / subtree / prose bud backed by ordinary org text.

### Org clock log

A time tracking material that stores clock data in valid org structures rather
than in a proprietary tracker format.

The point is not to reproduce every org feature in one editor. The point is to
let many focused materials speak the same underlying language.


## Whitebloom-native, not org-hostile

Detached org is a divergence from classic orgmode, and that should be admitted
plainly.

Org usually assumes continuity of text.
Whitebloom prefers continuity of space.

That is not a bug. It is Whitebloom's identity.

The goal is not to make org disappear into Whitebloom, nor to make Whitebloom
pretend to be Emacs. The goal is to let org semantics inhabit a modular,
spatial environment without giving up the file format that makes org powerful.


## Commands are where the workflow lives

Much of orgmode's real power is not just the text syntax. It is the action
vocabulary:

- toggle TODO state
- schedule
- set deadline
- clock in
- clock out
- refile
- archive
- promote
- demote
- sort
- filter by tag or state

Detached org composes extremely well with a command-native Whitebloom because
those workflows can become first-class commands over buds rather than editing
rituals in one giant document.

Examples:

- `orgTask.toggleState`
- `orgTask.schedule`
- `orgTask.clockIn`
- `orgTask.clockOut`
- `orgTable.insertColumn`
- `orgNote.archive`

This is where the Emacs lineage becomes especially fruitful: org semantics plus
commands-first control.


## Storage shape

If compatibility is a hard requirement, the default storage should usually be
real `.org` files.

That suggests:

- org buds live in `blossoms/`
- each bud owns a valid org text file
- Whitebloom interprets that file through a specialized module

The app may still keep ephemeral UI state elsewhere, but the authored semantic
material should stay in the org file itself whenever possible.


## Complete files vs fragments

One open question is whether each detached-org bud should store:

- a complete `.org` document
- or an org fragment such as a subtree or table

The safer default is probably to prefer complete valid documents where
practical. They are easier to move, easier to open in Emacs directly, and
cleaner as standalone assets.

Fragments may still be fine if they remain trivially pasteable into ordinary
org documents without cleanup.


## Export and composition

Detached org does not mean giving up document-shaped output.

A useful model would be:

- author natively as detached org buds on a board
- export a board, a set, or a selection as a stitched org document

This gives Whitebloom two strengths at once:

- native modular/spatial composition
- downstream compatibility with document-oriented org workflows

In other words, Whitebloom can be modular at authoring time and still emit a
coherent linear document when needed.


## Risks and tensions

This direction is strong, but it is not free.

### It is a real philosophical divergence from classic org

Some org users love the "everything in one buffer" feeling. Detached org
replaces continuity of text with continuity of space.

### Compatibility must remain disciplined

If Whitebloom starts inventing convenient near-org syntax or storing the real
state elsewhere, the whole premise weakens.

### Org is deep

Org Mode has decades of accumulated behavior. Whitebloom should avoid promising
full semantic parity too early. The compatibility target should focus first on
valid file syntax and ordinary editing interoperability.


## Design pressure

Detached org is promising if each material can answer "yes" to these:

- is this bud meaningful on its own?
- is its text representation honest and natural?
- can Emacs open and edit it without special handling?
- can Whitebloom add real value through focused views and commands?

If the answer is "no," that material may not belong in the org family.


## Core principle

Whitebloom should not implement orgmode as a giant document editor.

It should implement **org-native materials** as composable buds, backed by
real Org Mode compatible text, and let the board provide the spatial layer that
classic org never had.
