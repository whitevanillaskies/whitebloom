# Whitebloom Agent Feature Ideas

---

### Query Primitives
A predicate DSL over the flat node array — e.g. `nodes where plain contains "authentication"`, `nodes within 2 hops of id:X`. The `plain` field is already a first-class citizen, so the query layer is thin: a small utility script or skill that consumes the `.wb.json` directly. Design it edge-aware from the start so traversal works naturally once edges land.

### Persistent Agent Memory Per Board
Store as `agents/memory.md` alongside the `.wb.json` — plain text, not JSON, because it survives merge conflicts and is readable without tooling. Contents: "what I understood about this board last session" and "open questions I couldn't answer." Without this, every session re-derives context that should already be known.

### Board-Level Agent Commands
A top-level shell for the entire `.wb.json`:
- "Find conceptual orphans" — trivially implementable now (nodes with no edges)
- "Generate a summary brief from current content" — doable now
- "Propose new edges based on semantic similarity" — requires LLM reasoning over all `plain` fields; output lands in a *proposed-edges buffer* that humans review before committing, not directly into the board

### Set Unions

Sets and windows open up the possibility for set operations
"give me all the files in Q2 but not in Q1"
"give me all the files in campaign that are .xlsx"
etc.
File extensions are simply smart sets computed JIT
We can have media smart sets
"give me all pictures (smart set of .jpg, .png, etc.) in Q2 and Q1"

### Workspace home gone, replaced by arrangements

we remove the workspace home

the arrangements screen is the workspace home

and we add a docker. in this docker we add workspaces and the trash bin

and we rename bins in general to folders

---

## Good, Needs Design Care

### Graph-Aware Skills / Edge Traversal
"Follow all connections from this node and summarize the subsystem", "detect cycles / redundant paths." Only valuable once edges exist — which is on the current sprint. Design query primitives to be edge-aware from the start.

### Semantic Diff & Merge Tooling
The git-friendliness of `.wb.json` is already a superpower. The missing piece is *semantic* diff — raw git diff is noisy because position coordinates change constantly. A skill that strips positions and diffs only `plain`, `label`, and `edges` would be genuinely useful for agents explaining the impact of proposed changes.

### Lens Composition & Inheritance
Ability to chain lenses or define a meta-lens that combines multiple perspectives. Useful in principle, but chaining is premature until a single lens is working well. Chained lenses risk producing incoherent instructions. Start with one lens, compose later.

---

## Lower Priority / Design Tension

### Self-Improvement Loop
Agents invited to suggest improvements to the Whitebloom spec or board modules. Creates a trust problem if automatic — agents should write to `agents/suggestions.md` and humans curate. No automatic spec mutation.

### Spatial Context for Agents
Node positions exist in the JSON but are opaque to an agent without the UI. A simple `region` or `group` tag on nodes — or even a derived bounding-box concept — would communicate *visual intent*: "this cluster is the sprint section," "these nodes are architecturally related." Agents could then reason about spatial grouping without needing the renderer.

### Node Provenance
Who wrote this node, when, and how (human via UI vs. agent write). As agents write more content, distinguishing human-authored vs. agent-generated nodes matters. Minimal implementation: optional `author` and `createdAt` fields on `BoardNode`. Could influence how future agents weight or treat content.

### A Read/Write Contract
What is an agent allowed to do on this board? Right now it's implicit — agents have to guess or ask. A small `agents/permissions.md` or a structured field in the board `brief` (e.g. "agents may add nodes, agents may not delete nodes") would let agents act confidently without interrupting the human for confirmation on every write.
