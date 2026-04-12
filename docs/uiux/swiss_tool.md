# Swiss Tool Philosophy

Whitebloom may include small utility features that solve real workflow problems without attempting
to replace full specialist software. Internally, we can think of these as `Swiss Tools`.

The idea is simple:

- A Swiss Tool is small, portable, and immediately useful.
- It gets the user out of a pinch.
- It is not a claim that Whitebloom is now the best app in that category.
- It should feel packed into the product, not bolted onto the side of it.

The reference is a Victorinox tool:

- a small blade
- a small bottle opener
- a small file

Each tool is limited, but useful enough that having it available is better than not having it.

## What Counts As A Swiss Tool

A Swiss Tool is appropriate when:

- it directly supports a real Whitebloom workflow
- it can be implemented with strong defaults and very little ceremony
- it does not require an entire new product surface to make sense
- it is valuable even if it is not feature-complete compared to specialist apps

Examples:

- the PDF viewer
- lightweight session recording
- quick export helpers
- practical import or conversion utilities

The PDF viewer is a good example. Whitebloom is not trying to replace full PDF suites with secure
signatures, compliance workflows, deep form tooling, or enterprise review pipelines. The viewer is
there because users need to open, read, place, and annotate PDFs inside Whitebloom with minimal
friction.

## What A Swiss Tool Must Not Become

A Swiss Tool must not become:

- a grab-bag feature with weak boundaries
- a permanent chunk of app chrome
- a half-built clone of a specialist app
- a maintenance trap justified only by novelty

The rule is:

Swiss Tools should rescue workflows, not colonize the product.

If a feature requires its own heavy menu system, dedicated control panels, persistent buttons, or
large configuration surfaces, it is probably no longer a Swiss Tool.

## Hidden Tools

Swiss Tools follow a `hidden tools` philosophy.

They should not advertise themselves loudly in the interface. Like the tools inside a Swiss Army
knife, they stay packed tightly inside the slab until needed.

In Whitebloom, that slab is the command palette.

That means Swiss Tools should be accessed in one of two ways:

- contextually
- through the command palette

They should not live as permanent standalone buttons unless there is a very strong reason.

Good:

- dragging a PDF into Whitebloom opens the PDF workflow
- selecting a material exposes relevant actions
- invoking `Record Session` from the command palette
- invoking `Export Annotated PDF` from the command palette

Bad:

- a permanent `Load PDF` button in global chrome
- a permanent `Record` toolbar for a feature used only occasionally
- utility features demanding always-visible UI

Swiss Tools should feel discoverable to power users, but visually quiet.

## Product Contract

Every Swiss Tool should have a narrow and honest contract:

- it does one job
- it does it quickly
- it has strong defaults
- it avoids configuration sprawl
- it degrades gracefully instead of pretending to be a full workstation

For example, a Whitebloom recorder should not try to compete with OBS. If it exists, it should be
something like:

- record a session
- maybe choose mic on/off
- save to a file

That is enough. The moment it starts growing scenes, encoder tuning, overlays, routing, and
broadcast ambitions, it stops being a Swiss Tool.

## UI Rules

Swiss Tools must follow the design language:

- they should be compact
- they should not add noisy bespoke interfaces
- they should prefer contextual appearance over permanent visibility
- they should feel premium and restrained, not like plugin clutter

When a Swiss Tool needs UI, it should usually appear as:

- a contextual surface
- a temporary modal
- a palette action
- a focused popover

Not as a persistent feature silo.

## Decision Filter

Before adding a Swiss Tool, ask:

- Does this directly support a Whitebloom workflow?
- Can this remain small and opinionated?
- Can it stay mostly hidden until needed?
- Is it acceptable for a specialist app to still do this better?
- Will users still get clear value from the lightweight version?

If the answer is yes, the feature may belong in Whitebloom.

If the feature needs to become broad, highly configurable, or constantly visible, it likely belongs
outside the app.
