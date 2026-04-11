# Color Palettes UI/UX

This document defines the palette system for canvas styling: shape stroke/fill, edge stroke, edge labels, shape labels, and future text color controls.

This is not the command palette. See `docs/uiux/palette.md` for that.

## Goal

Whitebloom should support color in a way that feels disciplined, fast, and reusable.

- Palettes should help users stay visually coherent across a workspace.
- Color should remain intentional, not decorative.
- The default experience should be quiet and restrained.
- Custom colors should still be available when needed.

The desired feel is somewhat similar to tools like Miro, but stricter and more premium: fewer gimmicks, stronger defaults, less visual noise.

## Scope Model

Use a two-level system:

- Palettes are stored at the app level.
- Each workspace stores one active palette.

This gives us:

- a reusable library of palettes across projects
- a simple canvas UI with one current palette at a time
- a clean default for styling controls

Quickboards or boards outside a workspace should fall back to the app default palette.

## Default Palette

Ship one built-in system palette at the beginning:

- `Whitebloom Default`

System palettes should be read-only.

- They can be selected.
- They can be duplicated.
- They cannot be edited in place.

User palettes should be editable and reusable across workspaces.

## Workspace Behavior

Each workspace should store:

- `activePaletteId`

The active palette determines:

- which swatches appear first in color popovers
- which palette name is shown in styling controls
- the default palette context for new styling decisions

Changing the workspace active palette should not silently recolor existing boards or nodes by itself.

## Canvas Color Picker UX

When the user clicks a color control in a toolbar, open a popover.

Recommended popover structure:

1. Header
- Show the current palette name.
- Include a compact control to switch palettes.

2. Palette swatches
- Show a compact row or grid of colors from the active palette.
- Swatches should be fast to scan and click.

3. Custom color action
- Include a button with a color spectrum icon or preview.
- This opens a color picker for arbitrary colors.

4. Palette management action
- Include `Edit Palettes…`
- This opens palette management UI.

Optional later enhancement:

- a small recent-colors row

## Palette Switching UI

Do not make palette selection overly heavy in the main canvas popover.

Preferred first pass:

- show the current palette name in the popover header
- allow switching palettes from a compact dropdown or submenu there

Avoid a large always-visible palette selector in every styling popover. The styling popover should stay focused on applying color, not managing global settings.

## Palette Manager

The palette manager should allow:

- viewing all palettes
- selecting a palette for the current workspace
- duplicating system palettes
- creating new palettes
- renaming user palettes
- editing user palette swatches
- deleting user palettes when safe

System palettes:

- cannot be renamed
- cannot be edited
- cannot be deleted

If a palette is in use by one or more workspaces, deletion behavior should be explicit and safe.

## Data Model Direction

Palette storage should be app-level.

Recommended palette structure:

- palette id
- palette name
- read-only/system flag
- ordered list of swatches

Each swatch should have:

- swatch id
- label
- color value

## Color Value Direction

Canvas color values should support three conceptual sources:

1. Semantic token
- Example: foreground, muted, accent-blue

2. Palette swatch reference
- A reference to a saved swatch in a palette

3. Custom literal color
- Arbitrary color chosen from the picker

This is important because palette-chosen colors are not the same thing as semantic UI tokens.

Recommended direction:

- semantic tokens stay available for structural defaults
- palette swatches are first-class references
- custom colors remain available as escape hatches

## Palette Reference Behavior

Store palette-based colors by reference, not by position in the currently active palette UI.

In other words, prefer something conceptually like:

- `paletteId`
- `swatchId`

Do not store “the third swatch in whatever palette is active right now.”

This keeps behavior stable and predictable.

Benefits:

- existing shapes and edges do not unexpectedly change when the workspace switches to a different active palette
- editing a palette can intentionally propagate to items using that palette
- palette references remain durable across sessions

## Defaults

Default shape styling should stay neutral:

- stroke: charcoal foreground
- fill: transparent
- text: charcoal foreground

Color should only become vivid when the user chooses it or when a future semantic reason calls for it.

The palette system is for author styling, not for making the canvas colorful by default.

## First Consumers

The palette system should first power:

- shape stroke color
- shape fill color
- edge stroke color
- edge label text color
- shape label text color

Future consumers:

- text nodes
- cluster styling
- board-level visual themes if ever needed

## UX Principles

- Picking a color should be a one- or two-click operation.
- Editing palettes should be separate from applying a color.
- The active workspace palette should simplify the UI, not restrict the user.
- System palettes provide a stable baseline.
- Users should always be able to duplicate and customize.
- Custom colors are allowed, but palette usage should feel natural and attractive enough that users want to use it.
