# Experimental Work

Highly speculative ideas that may or may not be good. Worth writing down before they're forgotten. Nothing here should be treated as planned — these are open questions, not deferred tasks.


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
