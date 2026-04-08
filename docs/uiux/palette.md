# Command Palette UI/UX Contract

The Command Palette is a focused transient surface for keyboard-driven actions.

- The palette opens from the canvas with `Tab`.
- The default palette mode is the root command list.
- The root command list is filtered by the current query.
- Arrow keys move the active selection.
- `Enter` activates the active item.
- `Escape` closes the palette.
- Pressing `Tab` while the palette is open closes it.
- Clicking outside the palette closes it.

## Modes

- The palette supports transient contextual modes in addition to the root command mode.
- A palette action may close the palette, keep it open, or switch it into another mode.
- Switching modes clears the query and resets the active selection.
- Closing the palette always restores root mode first.
- Reopening the palette always starts from the root command list.

This keeps contextual pickers focused instead of mixing them into the general command list.

### Mode Example: Link Board

`Link Board` is a contextual palette action for creating a subboard link from the current board.

- `Link Board` is only available when a workspace is active.
- Activating `Link Board` switches the palette into a board-picking mode.
- In board-picking mode, the root command list is replaced by valid link targets from the current workspace.
- The currently open board must not appear in this list.
- External boards must not appear in this list.
- Each result shows the board name as the primary label.
- Each result shows the workspace-relative path as the secondary label.
- Activating a result creates a `BoardBloom` bud on the canvas and closes the palette.
- If no valid local boards are available, the palette shows an explicit empty state.

