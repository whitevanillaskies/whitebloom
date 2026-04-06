# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.


## Obsidian Vault Module

A module that recognizes an Obsidian vault dropped onto the canvas, displays it as an icon-personality node, and opens it in Obsidian on double-click.

### Why

Obsidian vaults are opaque directories — the OS has no native file association for them, so `app.getFileIcon()` would return a generic folder icon and `shell.openPath()` would open Finder/Explorer, not Obsidian. A dedicated module gives the node the correct icon, the correct launch behavior, and a meaningful warning when Obsidian isn't installed.

### Pieces

**3. Installation detection**

Add an IPC handler `app:check-protocol` that calls `app.getApplicationNameForProtocol(scheme)` and returns the app name or `null`.

- On module registration (or first render), the renderer calls `window.api.checkProtocol('obsidian://')`.
- If `null`: render a small warning badge on the icon node (amber dot, bottom-right corner).
- On double-click when unregistered: show a non-blocking notification — *"Obsidian is not installed. Download it at obsidian.md to open this vault."* Do not open a broken URI.
- If registered: bloom proceeds normally via `shell.openExternal`.

Cache the protocol check result in module render state — no need to IPC on every render.

### What does not change

- Board schema: `resource: "file:///..."` is already valid for external linked assets.
- Node schema: `type: "com.whitebloom.obsidian-vault"`, `kind: "bud"` — standard fields.
- HEP layer: no new read/save contract needed; this module has no in-app editor.
- All existing file-based module behavior.

### Open questions

- The warning badge competes with selection state visually. Decide whether the badge renders over or under the selection ring.
