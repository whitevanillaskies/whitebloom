# Bugs

## UI/UX

These are UI/UX bugs. Please reference `design_language.md` when working on the UI.

### Bug UI-1 (FIXED)

If we're editing a board, go back to start screen (and possibly workspace screen), then delete the board, the go back to board link from the start screen (and possible workspace screen) still show go back to the previous board, which has now been deleted (the canvas will still work because it's running on RAM data, not serialized data). If we delete the board we're working on, we should clear the document.

### Bug UI-2 (FIXED)

Deleting a board doesn't remove it from the recent list in the start screen, but apparently it does get cleaned up the next time you open the start screen

### Bug UI-3 (paused, do not fix yet)

On the start screen, if we've got a few quickboards + recent boards, and we resize the screen, they will clip the edge. This may or may not be what we want.

### Bug UI-4 (FIXED)

On the start screen, just new quickboards won't be added neither to the quickboards nor to the recent boards section until restarting the app. Same behavior for workspace boards. If we create/open a new workspace board, then come back to start screen, it won't be there until we restart.

### Bug UI-5 (FIXED)

The edge toolbar `EdgeToolbar.tsx` should only appear if there's one selected edge and nothing more. If there's two selected edges, the toolbar correctly doesn't appear, but if there's multiple nodes selected and one edge, the toolbar appears. This is incorrect. If the number of seleted items is greater than 1, no matter what they are, the toolbar shouldn't show up.

### Bug UI-6

Clusters. The Command Fit Clusters to Children works on every edge except the right side one. It cuts through the rightmost node instead of fully wrapping it.