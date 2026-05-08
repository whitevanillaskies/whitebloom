# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

## Focus Writer Book Mode: Lexical Manuscript Surface

Move book mode away from the transparent textarea/mirror prototype and toward a continuous manuscript editor backed by a real editable document model. The editor should still feel like one quiet writing surface, not a block editor. Book syntax remains Whitebloom-native source text, with preview mode as the only mode that hides metadata, notes, and margins. In writing modes, metadata should remain visible but muted.

### Phase 1: Parser Contract

Status: complete.

Formalize the book markup parser as the source contract before deep editor work.

- Preserve the `.blt` source file as the source of truth.
- Parse source into a stable AST for metadata, headings, paragraphs, margin blocks, note blocks, separators, and unknown/raw source.
- Preserve unknown directives or unsupported syntax as raw nodes rather than dropping or normalizing them.
- Keep source ranges and enough whitespace/separator information to serialize safely.
- Define canonical serialization from AST back to `.blt`.

### Phase 2: Read-Only Lexical Rendering

Status: complete.

Create a Lexical-backed book editor surface for `::type book` documents, initially read-only.

- Keep the existing plaintext Focus Writer path for non-book `.blt` files.
- Render title and author as muted/quiet metadata in writing modes.
- Render headings, paragraphs, notes, and margins through Lexical nodes.
- Keep notes and margins visible in writing modes.
- Make the manuscript surface feel continuous, with no block handles, cards, slash-menu feel, or Notion-like chrome.

### Phase 3: Editable Paragraphs And Headings

Enable editing for the main manuscript flow first.

- Make paragraphs and headings editable in the Lexical book surface.
- Serialize paragraph and heading edits back to `.blt`.
- Preserve metadata, notes, margins, unknown nodes, and surrounding whitespace during edits.
- Keep caret movement and selection feeling like a continuous document.
- Leave metadata, notes, and margins read-only if needed until the core edit/save loop feels good.

### Phase 4: Editable Notes And Margins

Make annotations editable without turning the interface into a block editor.

- Add editable custom nodes for `::note` and `::margin`.
- Render notes muted at their source position in writing modes.
- Render margins spatially in the margin while keeping editing graceful.
- Avoid visible block controls unless they become truly necessary.
- Preserve directive syntax on serialization.

### Phase 5: Raw Mode And Preview Mode

Make the escape hatches and final rendered view first-class.

- Add a raw mode that shows and edits the exact `.blt` source text.
- Keep raw mode available for correcting syntax, unsupported structures, or serialization edge cases.
- Adapt preview mode to render the finished manuscript view.
- In preview mode, hide metadata directives, notes, and margins; show title, author if desired, headings, and body text.
- Keep dynamic/typewriter writing modes focused on live manuscript editing with visible muted metadata, notes, and margins.
