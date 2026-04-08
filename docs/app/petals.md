
# Petals

`Petals` are Whitebloom's reusable UI primitives. If `Mica` is the window manager, `Petals` are the furniture that lives inside the app: buttons, panels, palettes, menus, badges, fields, spacing primitives, and window-toolbar controls.

The purpose of `Petals` is to keep role and styling aligned.
- A component should be named by what it is for, not just by how it looks.
- `Petals` should be reusable across features.
- `Petals` should not absorb window-management responsibilities. That belongs to `Mica`.

## Core Petals

- `PetalButton`: dialog and panel actions such as confirm, cancel, save, and destructive actions.
- `PetalField`: labeled input and textarea field for forms and panel content.
- `PetalPanel`: modal/dialog surface for compact prompts and confirmations.
- `PetalPalette`: command/search palette surface.
- `PetalMenu`: popup action list / contextual menu surface.
- `PetalIsland`: raised inline container surface such as docked side regions.
- `PetalIconBadge`: compact icon badge for typed-file / module-style visuals.
- `PetalBudNode`: canvas bud node wrapper.
- `PetalSpacer`: generic layout spacer. Supports horizontal or vertical spacing, fixed size, and flexible fill.

## Floating Toolbar Petals

- `PetalToolbarButton` in `components/petal/`: floating icon-only toolbar button for canvas-adjacent palettes and compact floating toolbars.

This is intentionally separate from window-toolbar controls. A floating canvas toolbar button is not the same thing as a window-toolbar item.

## Window Petals

Window-specific controls live in `components/petal/window/`.

- `PetalControlButton`: window chrome control such as close.
- `PetalToolbar`: the toolbar composition surface for window headers.
- `PetalToolbarGroup`: a semantic cluster inside a toolbar.
- `PetalToolbarButton`: standard button that lives inside a window toolbar.
- `PetalToolbarSegmented`: grouped mutually-exclusive control for view mode toggles and similar cases.
- `PetalToolbarSearch`: search field sized and styled for a window toolbar.

## How Toolbars Work

The model is inspired by macOS/AppKit toolbars.
- A toolbar is its own composition surface, not a miscellaneous `actions` slot.
- Items should be grouped intentionally.
- Spacing should be explicit.
- Search is a toolbar control, not generic window chrome.

Current direction:
- `MicaWindow` owns shell structure: frame, titlebar, close control placement, sidebar split, and content area.
- `PetalToolbar` owns toolbar composition.
- `PetalToolbar*` controls own their own styling.

Typical usage:

```tsx
<MicaWindow
  title="Bin"
  toolbar={
    <PetalToolbar>
      <PetalToolbarGroup>
        <PetalToolbarSegmented ... />
      </PetalToolbarGroup>

      <PetalSpacer size={10} />

      <PetalToolbarGroup>
        <PetalToolbarSearch ... />
      </PetalToolbarGroup>
    </PetalToolbar>
  }
>
  {content}
</MicaWindow>
```

## Rules

- Do not put reusable control primitives under `mica/`.
- Do not let `MicaWindow.css` style arbitrary toolbar buttons or search fields.
- Prefer explicit primitives over one giant component with many visual variants.
- If two controls serve different UX roles in macOS terms, they should usually be different Petals.
