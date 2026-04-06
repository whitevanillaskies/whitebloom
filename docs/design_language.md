# Design Language

Primary color is white, but technically almost-full-white. Avoid large swaths of colors, use color as accent. Do not use muddied colors. Rely on vibrant colors that cut through the white. Use tasteful drop shadows and typography, do not use neither full black nor full white. Almost white, and deep charcoal instead.

Prefer premium macOS style. For example, if we have a toolbar, do not frame each button inside a box. Let the icon appear engraved on the toolbar. Use Lucide icons for now, we may switch to custom SVGs later. Icons should be added as React components, so that code doesn't have to change other than the import if we want to replace them.

Reference top tier software. Adobe Photoshop, Illustrator, Premiere, After Effects. Apple native tools like Calendar, Settings, email, etc.

Design should be transparent to the user, especially to power users. Draw power user guidelines from software like Houdini, maya, Blender, DaVinci Resolve, Nuke. Never let design get in the way. Animations are only fine if they don't interrupt usability. Playing an animation but still giving you control of the tool is fine, having to wait for the animation to finish is not.

Never, ever, do fade out animations on anything. Modals, popups, notifications, etc. If something has a close or dismiss button or action, close and dismiss actions should be instantaneous. Never, ever fade them out.

If I had to describe the target audience in one short sentence is this: "elitist premium power user with no patience for gimmicks."

Optimize this app for high precision pointer interactions. This is a desktop computer app. We do not care for responsive layouts nor touch gestures. Accessibility is not a concern for this app. Prefer compact, high density clusters with whitespace as boundaries.

## Variables

Save variables to renderer/assets/base.css - if the number of variables grows too large, we can split it into more files.

## Colors

Main Background: almost full white
Main Foreground: dark charcoal
Light Foreground: charcoal, light charcoal

Accents: vibrant colors (pink, magenta, fuchsia, red, blue, green). The only colors I would avoid are those that lack perceived contrast against white, such as some yellows.

Use color to convey information. To group and identify items, to convey intent. Do not use color for its own sake.

## Line Thickness

Prefer thin lines. Avoid the Fisher Price aesthetic of big soft shapes. Somewhat round corners can be fine, but not too much. Allow dashed and dotted lines for connections.

## Typography

Choose one serif, one sans, and one monospaced font for code.

- Sans: DM Sans (I also like Manrope)
- Serif: Source Serif 4
- Code: Source Code Pro

## Spatial Tokens

Border radius comes in three tiers — never go outside them:

- **Frame** (`--radius-border-frame`, 6px): panels, modals, cards, inline surfaces
- **Inner** (`--radius-border-inner`, 4px): inputs, tags, small inline buttons
- **Floating** (10–12px): toolbars and popovers that physically float above the canvas

Shadow also comes in three tiers. Never exceed 32px blur.

- **Subtle** — `0 2px 8px rgba(15,23,42,0.08)`: cards, inline elements
- **Medium** — `0 6px 20px rgba(15,23,42,0.12)`: raised panels, dropdowns
- **Elevated** — `0 12px 32px rgba(15,23,42,0.16)`: modals, overlays

Always pair a shadow with an `inset 0 1px 0 rgba(255,255,255,0.7)` top-edge highlight for the glassy feel.

## Color Tokens

Always use the CSS variables defined in `base.css`. Never hard-code hex values for foreground or
background colors — hard-coded colors break dark mode readiness and make systematic updates impossible.

- `--color-primary-bg`, `--color-primary-fg`
- `--color-secondary-fg`, `--color-muted-fg`
- `--color-accent-blue`, `--color-accent-pink`, `--color-accent-red`, `--color-accent-purple`, `--color-accent-green`

Structural rgba values (borders, shadow alpha, glass backgrounds) may be written inline since
they are inherently relational and not semantic tokens.

## Surface Patterns

**Inline card / panel** — use for boards, list items, and content tiles:
- Background: `rgba(255, 255, 255, 0.9)`
- Border: `1px solid rgba(0, 0, 0, 0.08)`
- Shadow: subtle tier + inset top-edge highlight
- Radius: frame (6px)
- No backdrop-filter — inline surfaces are not floating

**Modal / dialog** — appears above the page:
- Background: `linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,246,250,0.94))`
- Border: `1px solid rgba(255, 255, 255, 0.36)`
- Shadow: elevated tier + inset top-edge highlight
- Radius: frame (6px)
- Overlay: `rgba(255,255,255,0.4)` + `backdrop-filter: blur(12px) saturate(130%)`

**Floating toolbar / popover** — physically above the canvas:
- Background: `linear-gradient(180deg, rgba(255,255,255,0.75), rgba(248,250,252,0.66))`
- Border: `1px solid rgba(255, 255, 255, 0.24)`
- Shadow: medium tier + inset top-edge highlight
- Radius: floating (10–12px)
- Always use backdrop-filter

## Node Visual Grammar

Whitebloom is an OS for knowledge. The canvas is a spatial desktop — nodes are files, not UI widgets. The node's visual treatment should follow the same logic macOS Finder uses for thumbnails: **can the content meaningfully fill the node space?**

### Three node personalities

**Self-representing** — the content IS the node. No chrome needed beyond selection state.
- Images: show the image itself at full node size.
- Video: show a thumbnail frame.
- Anything that renders as a visual artifact: show the artifact.

**Preview** — the content communicates something useful at reduced scale. Use a minimal card.
- FocusWriter: text preview is genuinely informative. A soft card with content fills the space.
- Future: spreadsheet grids, diagram thumbnails, code snippets.
- Card treatment: no hard border, soft shadow (subtle tier), paper-like feel. Not a "mini app," more a physical document lying on the desk.

**Icon** — the content is opaque or doesn't reduce meaningfully. Use macOS desktop icon style.
- Database schemas, compiled assets, anything where "3 tables" or a filename is the entire story.
- Treatment: no card, no background. A large centered icon (32–40px), the filename label centered below, wrapping to two lines max. Floats on the canvas the way a Finder icon floats on the desktop.
- Selected state: blue ring around the icon, blue tint on the label background — exactly macOS selection.
- Badges are acceptable for count metadata (e.g. table count in corner of the icon). Keep them small and non-intrusive.

### Icon-style node icon source

See the Icon Source section below. The icon for each module is the module author's responsibility. Internal modules use the iOS-style icon treatment (accent-colored rounded square + centered Lucide icon). External-default modules (files opened by native apps) use `app.getFileIcon()` to return the real system icon — the same icon Finder would show — for free.

### The principle

Ask: does displaying the content at node scale give the user more information than a well-chosen icon would? If yes, show content. If no, show an icon. Never apply one treatment uniformly to all nodes. The SchemaBloom node wearing a "card with a header" costume is wrong because it implies there is a preview, then delivers nothing useful.

---

## Icon Source

Whitebloom has no army of designers. Icon sourcing is therefore a solved-by-convention problem, not a bespoke design problem.

### Internal module icons (buds authored inside Whitebloom)

Use the **iOS/macOS app icon pattern**: an accent-colored rounded square (radius: `--radius-border-frame`, 6px at small scale, scaling up proportionally) containing a centered white Lucide icon. Each module is assigned one accent color from the design token set. This is:
- Immediately recognizable as a "typed file" — the pattern is universal.
- Buildable with zero additional assets — Lucide + CSS.
- Consistent across all internal modules.
- Easily swappable: replace the Lucide icon with a custom SVG later without changing the layout.

Icon size inside the badge scales with the node size. At the default icon-node size, the badge is ~40×40px and the Lucide icon is 20px.

### External module icons (files opened by native apps)

Use Electron's `app.getFileIcon(path)` IPC call. This returns the exact icon the OS uses for that file type — the same icon Finder, Explorer, or Nautilus would show. For `.psd` files the user gets the Photoshop icon. For `.xlsx` they get the Excel icon. This is the correct answer: we cannot out-design Apple or Microsoft on their own file type icons, and we don't need to.

Expose this as a preload API call (`window.api.getFileIcon(path) → dataURL`) and cache the result in node render state.

### Custom SVGs (future)

Reserved for cases where neither the iOS badge pattern nor the system icon is appropriate. When custom SVGs are added, they slot into the same layout contract as Lucide icons — the import changes, nothing else does.

---

## Do Not

- Use `border-radius` above 12px anywhere
- Use shadow blur above 32px
- Use `clamp()` or `@media` breakpoints — this is a desktop app with a fixed layout
- Hard-code color hex values for text or background — use CSS variables
- Apply `backdrop-filter` to inline (non-floating) surfaces