# Experimental Work

Highly speculative ideas that may or may not be good. Worth writing down before they're forgotten. Nothing here should be treated as planned — these are open questions, not deferred tasks.


## Commands and scripting in Arrangements

If Arrangements grows beyond direct manipulation and palette actions, the next sensible step is not "add a console" but "define a command system." Bins and sets are a good example: if `New Bin`, `New Set`, `Rename Set`, `Include in Set`, and `Remove Bin` become first-class commands with stable inputs and results, then context menus, palette items, buttons, automations, and future scripts can all call the same machinery.

That suggests a healthy order of operations:

- define internal commands first
- expose them in the palette second
- consider non-programmer automation hooks third
- only then evaluate a real scripting API

A scripting API could become valuable later, especially for bulk organization, generated set structures, migration helpers, or workspace-specific tools. But it should arrive only after the command layer is stable and intentionally scoped. Otherwise the app would freeze accidental implementation details into public API, and every refactor of Arrangements data would become a compatibility problem.

If this ever moves forward, the safest shape is probably command-oriented rather than raw process scripting. In other words: scripts should ask the app to run approved commands, not reach directly into stores, files, or renderer internals. That keeps the API smaller, makes undo/audit possible, and avoids turning Whitebloom into a general-purpose scripting host before it needs to be one.


## Agent-authored modules

The embedded LLM writes a new module from inside the app. No restart. You describe what you want ("a Gantt chart node"), the agent produces the module, and it loads immediately.

### Why Whitebloom is a good fit for this

The module contract is tightly specified: `id`, `extensions`, `recognizes`, `createDefault`, an editor component, a shell. An LLM knows exactly what slot it's filling. This is not "write me an app" — it's "fill this well-defined contract." The three-layer architecture keeps the blast radius small: a broken module renders as an error node, the board is untouched, the data is safe.

Hot-loading is technically achievable in Electron via dynamic `import()`. You write the module to a path, import it, register it in the module registry, React re-renders. No restart.

### The honest concerns

**Security is the real blocker.** An LLM writing arbitrary code that runs in the main renderer process has access to the filesystem, the network, and Electron's `shell` API. The risk profile for a local personal tool is similar to installing an npm package you found online — not theoretical, but not catastrophic either. The right mitigation is a sandboxed boundary: run module editors in iframes with a restricted CSP, or run module logic in Web Workers with no `require()` access. HEP becomes the only IO surface the module can touch. This is architecturally expensive to do right.

**Code rot.** An agent-generated module that works today may silently break as the module contract evolves. Fifteen half-baked modules accumulate in a workspace, and nobody remembers which ones are agent-generated or whether they still work. Manageable if modules are stamped with their origin and the app surfaces a health signal when a module fails to load.

### The right shape for this

Not "LLM writes code that immediately runs." The inbox is already designed as a multi-type queue (`"agent-proposal" | "alert" | ...`). The right version is a **`"module-install"` proposal type**: the agent writes the module files to a `modules/<id>/` directory in the workspace, the inbox surfaces a preview, and the user approves before anything loads. This preserves the Whitebloom principle — agents propose, humans decide.

```json
{
  "type": "module-install",
  "moduleId": "com.user.gantt-chart",
  "description": "Gantt chart node for project timelines",
  "files": ["modules/com.user.gantt-chart/core/index.js", "..."],
  "generatedBy": "claude"
}
```

The approve step is also where a sandboxing decision naturally lives — you can preview the module in a restricted iframe before committing to a full load.

### Sequencing

This feature should not land until the module system is stable. Agent-generated modules will break constantly if the module contract is still evolving. The right order: stabilize the contract, build the module registry, define the sandbox boundary, then open this lane. Doing it earlier means the generated code is permanently chasing a moving target.


## Ink architecture vocabulary

The ink system is trending toward a two-level painting model rather than a naive "draw directly into the saved layer" approach.

### Current direction

- **Ink** is the subsystem and medium: brushes, strokes, pressure, erasing, masking, compositing rules.
- **Glass Buffer** is the transient live drawing workspace.
- **Acetate** is the persistent overlay object attached to a compatible surface.
- **Transfer** is the act of moving what was drawn in the Glass Buffer into an Acetate.
- **Baking** is export or flattening into an external file artifact, not normal authoring.

The user should not be exposed to this vocabulary directly. User-facing language can stay simple and just talk about layers. These terms are internal architectural names meant to keep the model clear while building the system.

### Why two levels make sense

The Glass Buffer should not be the source of truth. It is a working surface.

That means:
- load an Acetate
- project it into the Glass Buffer
- draw in the Glass Buffer
- Transfer the changes back into the Acetate
- only Bake when exporting to another format

This keeps the shared drawing experience universal while preserving surface-correct saved data.

### Why this is attractive

This approach allows Whitebloom to share almost all drawing behavior across surfaces:
- stylus input
- stroke smoothing
- pressure handling
- erasing
- masking
- transient compositing
- preview behavior

The surface-specific code then becomes an adapter problem:
- how the current surface projects into the Glass Buffer
- how masking is defined
- how a Transfer maps back into the persistent Acetate representation
- how Baking/export works for that surface

### Relationship to coordinate spaces

This model does not replace the coordinate-space work. It complements it.

The saved Acetate still needs to preserve the correct canonical data for the target surface:
- board surface: world coordinates
- image surface: UVs
- PDF surface: PagedUVs
- video surface: RangedUVs

The Glass Buffer is therefore a shared authoring stage, not a universal storage format.

### Naming note

`Acetate` currently feels like the strongest internal name for the persistent overlay object because it evokes a transparent layer laid over a surface.

`Glass Buffer` feels like the strongest internal name for the transient drawing stage because it preserves the current "glass layer" intuition already present in the canvas discussion.

These names should remain provisional until the system is implemented enough to confirm that they still fit the real workflow.
