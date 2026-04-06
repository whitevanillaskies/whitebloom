# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.


## Obsidian Vault Module

A module that recognizes an Obsidian vault dropped onto the canvas, displays it as an icon-personality node, and opens it in Obsidian on double-click.

### Why

Obsidian vaults are opaque directories — the OS has no native file association for them, so `app.getFileIcon()` would return a generic folder icon and `shell.openPath()` would open Finder/Explorer, not Obsidian. A dedicated module gives the node the correct icon, the correct launch behavior, and a meaningful warning when Obsidian isn't installed.

### Pieces

**1. Folder drop dispatch (new platform capability)**

Currently the DnD handler assumes dropped items are files with extensions. Add a parallel path for dropped directories:

- When a directory is dropped, collect all registered modules that declare `handlesDirectories: true`.
- Run each module's `recognizes(path)` in order; first match wins.
- If no module claims it, fall through to the existing unknown-type dialog (adapted to say "unknown folder type" rather than "unknown file type").
- If a module claims it, create a bud node with `resource: "file:///absolute/path"` and stamp the module's `id` as `type`. The `wloc:` scheme is not valid here since the vault lives outside the workspace.

This dispatch path is intentionally generic — Unity projects, Xcode workspaces, and similar opaque directories can follow the same pattern later.

**2. Obsidian module (`com.whitebloom.obsidian-vault`)**

Module definition:

- `handlesDirectories: true`
- `extensions: []` (no file extension — directory only)
- `recognizes(path)`: checks for existence of `.obsidian/` subdirectory at `path`. Return `true` if found.
- `defaultRenderer: 'external'`
- `importable: false` — vaults must never be copied; link via `file:///` always.
- Bloom action: `shell.openExternal('obsidian://open?path=' + encodeURIComponent(absolutePath))`
- Bundled Obsidian SVG icon (the purple diamond). Slots into the icon-node layout as any Lucide icon would — import changes, nothing else does.

Node visual personality: **Icon** (per design language). No card, no background. Large centered Obsidian icon (~36px), vault folder name as label below, wrapping to two lines max.

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
