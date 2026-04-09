# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Custom Project Finder

### Goal

Reduce friction around the mental model that "a folder is a project." The user should be able to navigate to a location and open Whitebloom projects as first-class resources, without needing to understand that a board/workspace is stored as a directory on disk.

This is not a general-purpose file manager. It is a focused project finder.

### Product Decision

Build a custom finder window for opening Whitebloom content.

The finder should:

- Show folders for navigation.
- Detect any directory containing a `.wbconfig`.
- Present detected Whitebloom resources as openable items instead of exposing the implementation detail that they are directories.
- Allow double-click to open the resource.

The finder should not:

- Expose file operations such as move, rename, delete, duplicate, copy, paste, drag-to-reorganize, or create folder.
- Show regular files in the main content area.
- Become a full Explorer/Finder replacement.

### Window / Layout Direction

Use [MicaWindow.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/mica/MicaWindow.tsx) as the host shell, following the same overall structural approach used by [BinView.tsx](D:/slvtte/prj/WHITEBLOOM/code/whitebloom/src/renderer/src/components/arrangements/BinView.tsx).

Layout:

- Left sidebar for location navigation.
- Main content area for current directory contents.
- Minimal, Finder-like chrome.
- Low-noise presentation consistent with the design language.

### Sidebar

The sidebar should initially include:

- System drives.
- A small set of expected locations calculated on demand per OS.

Examples of expected locations:

- Desktop
- Documents
- Home directory
- Downloads

Future expansion may include:

- Network drives
- Favorites / pinned locations
- Recent project locations

Do not overbuild the first version. Compute expected folders lazily and keep the structure simple.

### Main Content Rules

The main content area should support Finder-like presentation modes:

- Icon view
- Column or list-style navigation view

Only show:

- Directories
- Workspaces
- Quickboards

Do not show normal files.

Any directory containing `.wbconfig` should be surfaced as a Whitebloom resource rather than a plain folder.

### Resource Semantics

Whitebloom resources should be visually distinct from ordinary directories.

Initial distinction:

- Workspace: its own resource type / visual treatment.
- Quickboard: board treatment with a lightning bolt.

Ordinary directories remain navigable containers.

Whitebloom resources behave like openable project items:

- Double-click opens them.
- They should read as "documents/projects" rather than "folders."

### UX Principles

The finder should embody the same product values called out in `design_language.md`:

- Minimal noise.
- Precision desktop interaction.
- Premium macOS-inspired presentation.
- Power-user clarity without leaking implementation details to normal users.
- No gimmicks and no unnecessary motion.

This is meant to remove conceptual friction, not add a layer of abstraction for its own sake.

### Implementation Outline

1. Add a dedicated finder window/view component built on `MicaWindow`.
2. Define a lightweight directory listing model that distinguishes:
   - plain directory
   - workspace
   - quickboard
3. Add backend scanning logic for the current directory that checks child folders for `.wbconfig`.
4. Add OS-aware sidebar location resolution for drives plus expected user locations.
5. Implement main content presentation with minimal Finder-style icon/list or column modes.
6. Wire double-click behavior:
   - plain directory => navigate into directory
   - workspace / quickboard => open resource
7. Keep the first version intentionally read-only aside from navigation and open actions.

### Guardrails

- Do not introduce filesystem mutation actions in this window.
- Do not show raw files.
- Do not require the user to understand project folders.
- Do not let the UI drift into a generic developer-facing browser.
- Prefer a narrow, polished first pass over a broad but noisy implementation.
