# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

## Focus Writer Book Mode MVP

Prototype a minimal Whitebloom-native book markup mode inside Focus Writer. Existing `.blt` files remain plaintext unless the first meaningful line is `::type book`.

Syntax for the MVP:

- `::type book` enables book mode.
- `::title Some Title` sets the work title.
- `::author Some Author` sets the author metadata.
- `#`, `##`, and `###` are generic nested heading levels chosen by the author.
- `::margin` starts a margin block that continues until the next blank line.
- `::note` can be inline (`::note Remember this`) or block-style; notes render muted at their source position.

Rendering rules for the MVP:

- Metadata directives are hidden in book rendering, except while the caret is on the directive line.
- Directives generally render styled or hidden when inactive, but show raw source while the caret is inside that directive line or block.
- Writing modes render title, author, headings, body text, margin blocks, and notes.
- Preview mode hides margin blocks and notes, leaving title, author, headings, and body text.
- Add the parser and renderer in a modular way so later document types such as screenplay can share directive parsing without inheriting book-specific rendering.

Implementation steps:

- [x] Add a small book-markup parser for Focus Writer that detects `::type book`, extracts metadata, headings, body paragraphs, margin blocks, note blocks, inline notes, source ranges, and active-block lookup.
- [x] Add book-mode rendering to Focus Writer writing modes, preserving current plaintext behavior when book mode is absent and showing raw source for the active directive/block.
- [ ] Adapt preview mode for book documents so it renders the finished manuscript view and omits margins/notes.
- [ ] Polish layout and verify with at least one sample `.blt` covering title, author, three heading levels, margin, inline note, block note, and normal plaintext fallback.
