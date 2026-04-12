# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only. Keep `design_language.md` in mind when implementing new user-facing features.

---

## Commands Refactoring

### GPT Review

I need you to perform a code review of this codebase. I don't need you to code anything, just to look at the code. Right now we have a palette with two primary modes (visual and meta) and commands, inspired by both macOS Spotlight and emacs. The app screens have major-mode which determines the kinds of commands available. The comands are also namespaced for ease of browsing. I need you to review whether the current architecture supports the following: contextual (not modal) commands. For example, screen.start-recording should only be allowed when we're not recording, and likewise screen.stop-recording should only be allowed when we are recording. Now, this is the behavior that we have, but I need you to review if this behavior is added on as a hack, or if the architecture properly supports contextual availability in a clean way.

For example, I want to add the following: pdf.extract-pages a command that, when you either have one PDF selected on the canvas, or are in pdf major mode, it prompts you with a menu of pages to select and extract as images. I need you to determine this: can we (relatively easily) make a command that understands the context "if we're on canvas a PDF is selected or we're in pdf-mode"? Furthermore, can commands properly live in more than one major mode?

Please do a nice review of the architecture so that we can orient our effort



**Findings**
- High: Module major mode is not wired into the command system. Canvas switches major mode based on active bloom at Canvas.tsx, but the palette returns an empty item list outside canvas mode at Canvas.tsx and only creates a command session for canvas mode at Canvas.tsx. The empty-state text in major-modes.ts matches that reality. Result: a command does not currently appear just because the user is in PDF major mode.
- High: Contextual availability is first-class only for data that exists in the runtime command context, and the current canvas context does not expose enough PDF-related state. The registry itself is clean here: availability is modeled by a when predicate at runtime.ts, enforced again at execution time at runtime.ts, and filtered during search at api.ts and api.ts. But Canvas only passes selection ids and coarse capabilities into the command context at Canvas.tsx, Canvas.tsx, and Canvas.tsx. Canvas already computes the richer facts you would want, namely selectedBudNode and selectedBudModule at Canvas.tsx and Canvas.tsx, but it does not expose them to commands. Result: “one selected PDF on canvas” is not currently a clean declarative predicate.
- Medium: The recording commands are outside the command architecture. They are manually assembled into shellMetaPaletteItems at Canvas.tsx, Canvas.tsx, and Canvas.tsx, not registered as normal commands with when predicates. This is not unsafe, because execution is still guarded in Canvas.tsx and Canvas.tsx, but architecturally it is an add-on path rather than the canonical one.
- Medium: Major mode is not a first-class dimension in the command model. The registry only knows canvas and arrangements contexts at types.ts. Module participation is only modeled as provider provenance at types.ts and types.ts. Modules can declare commands through types.ts and are registered through registry.ts, but I did not find any module that actually populates that field today. Result: “this command lives in more than one major mode” is not something the current architecture models explicitly.

**Assessment**
The underlying registry is good. The palette already consumes registered commands in both visual and meta browsing at PetalPalette.tsx and PetalPalette.tsx, and command-owned flows are a good fit for something like pdf.extract-pages because the model already supports list and input steps at types.ts and types.ts, rendered by the palette at PetalPalette.tsx.

So the short answer is:

You do have a clean architectural basis for contextual commands, but it is only partially adopted. The recording example is not a pure hack in the unsafe sense, yet it is outside the clean path. For your PDF example, the current architecture is close but not quite there. “Selected PDF on canvas” is relatively easy to support by extending the canvas command context with selected bud metadata. “Or we are in PDF major mode” is not currently supported cleanly, because module major mode is disconnected from the command session.

Commands also do not properly live in more than one major mode today. What they really live in is a command context, and right now major mode is separate from that. After a small architectural pass, one canvas-context command could effectively appear in multiple major modes through when predicates, but that would be an emergent behavior of a richer canvas context, not a first-class feature of the present design.

One extra caveat: if pdf.extract-pages needs true multi-select page picking with thumbnail-like affordances, the current flow system is more list/input oriented than checklist oriented. That is a UI limitation, not a contextual-availability limitation.

1. Extend the canvas command context so commands can see selected bud module/resource and active bloom/module state.
2. Remove the current canvas-only gate for commandSession so module major modes still browse the registry.
3. Then add pdf.extract-pages as a normal registered command with a when predicate and a flow, instead of following the shellMetaPaletteItems pattern.

Alright, let's think. Suppose we have a pdf.extract-pages command. In the canvas, it does the following: from the canvas, with a PDF node selected, show the user a paginated view of the pages, allow the user to select which pages to extract, then when user hits extract it extracts them and presents them on the canvas; from a PDFEditor, the same except that it does not present them to the user because there's no canvas. The extraction process in both ways writes a local copy of the extracted files to the workspace files, and creates a set like Extracted > PDF > PDFNAME so that the user can quickly find the extracted pages in the Materials view. The only difference thus is that on the canvas it lays out the extracted pages.
Do we want:

- One multimodal command that is accessible to both the pdf-mode and the canvas mode when a PDF node is selected
- Two commands, one which is noncontextual and is simply always available from pdf mode, one contextual command available from the canvas mode when a pdf is selected ?

And think how this aligns with your assessment.

Also discuss the idea that, eventually, a contextual command may require a major mode and context. For example, org-mode and having the cursor over a block with a TODO heading (for example to change the TODO state, or clock in). This "context payload" seems both tricky and extremely critical to the app.


**Recommendation**
I would treat this as one semantic command, pdf.extract-pages, not two distinct user-facing commands. The intent is the same in both places: extract pages from the active PDF into workspace materials. The canvas case just has one extra host effect: lay the results out on the board. So the clean model is one command identity, one shared extraction use case, and two thin surface bindings that resolve the target PDF from context and then optionally place results on the canvas. In other words: one command concept, not one giant branchy implementation.

That aligns with the earlier assessment. The command registry already has the right availability hook in runtime.ts, but the active command session is only wired for canvas right now at Canvas.tsx, and the command context model still only knows canvas and arrangements at types.ts. So today I would not force this into one cross-surface command object inside the current shapes. I would keep one semantic command id and back it with shared extraction logic plus surface-specific adapters until module/editor context becomes first-class.

**Why Not Two Commands**
Calling the PDF editor version noncontextual is slightly misleading. It is contextual too; its context is simply stronger because the active PDF document is implicit. On canvas, the context is “exactly one selected PDF bud,” which Canvas is already close to exposing through the selected bud data at Canvas.tsx and Canvas.tsx.

Two separate public commands only make sense if the user intent diverges. For example, if later you want both “extract pages into Materials only” and “extract and immediately lay out on canvas” as explicit choices, then those are two commands. In the scenario you described, the semantic operation is the same and the host just has different follow-up behavior.

**Context Payload**
Yes, this is the critical part of the app. Major mode alone is not enough. Major mode tells you which vocabulary is plausible. Context payload tells you whether there is a valid subject right now.

The model I would aim for is:
- Surface or host: canvas, arrangements, module editor, shell.
- Major mode: canvas, PDF, org, and so on.
- Subject payload: selected PDF bud, active PDF document, current org heading, current TODO state, current block type.
- Host actions: place extracted pages on canvas, reveal set in Materials, change TODO state, clock in.

Availability should be the conjunction of those things, not just mode. An org command like clock in should be available only when the surface is an org editor, the major mode is org, and the subject payload says the caret is on a heading with a TODO state. That is not a special case; it is the general rule.

The risky version of this architecture is a giant loose context object full of optional fields. The cleaner version is that each surface or editor publishes a semantic snapshot of its active subject. Commands read that snapshot; they do not reach into raw editor internals and reconstruct meaning for themselves. That matters once you have org, PDF, code, schemas, and other rich modules.

1. Treat pdf.extract-pages as one command identity with one shared extraction service.
2. Add a first-class module or editor command context so PDF mode can participate in the same command system as canvas.
3. Extend canvas context from selection ids to semantic selection payload, so “one selected PDF bud” becomes a declarative predicate rather than a special case.
4. Let host-specific post-actions differ by context, but keep the extracted-files and materials-set behavior in the shared core so it cannot drift.