# Open Whitebloom Specification

Whitebloom can be both an app and an open specification. The CoreData schema and module contract are already renderer-agnostic by design — no React Flow internals, no viewport state, no framework metadata. This document describes how to formalize that into a layered open spec so that different implementations (Electron app, web app, Tauri app, native app, LLM agent) can all operate on the same boards and share module logic.


## Three-layer architecture

```
┌─────────────────────────────────────────────┐
│  Layer 3: Domain Bindings                   │
│  React, Svelte, native, etc.                │
│  Thin translations of HEP into framework    │
│  primitives (components, stores, views).     │
├─────────────────────────────────────────────┤
│  Layer 2: Host-Editor Protocol (HEP)        │
│  read/save contract, lock semantics,        │
│  watch/change notification, discovery.       │
│  Shared by all consumers: UI editors,       │
│  LLM agents, CLI tools.                     │
├─────────────────────────────────────────────┤
│  Layer 1: CoreData Spec                     │
│  .wb.json board format, directory layout,   │
│  node/edge semantics, field reference,      │
│  versioning. Pure data, zero behavior.       │
└─────────────────────────────────────────────┘
```


## Layer 1: CoreData Spec

The file format. What exists on disk and what it means.

- **Board format.** The `.wb.json` schema: nodes, edges, version, field semantics.
- **Inbox format.** `board.inbox.json` sits alongside `board.wb.json`. It is a queue of agent proposals, each containing a `description`, a `rationale`, an `atomic` flag, and an array of serialized commands. This file is part of the spec — any compliant implementation must be able to read and write it.
- **Directory conventions.** `blossoms/` for assets whose primary creation and editing path is whitebloom (internal-default modules). `res/` for assets that originate outside whitebloom and open in native apps (external-default modules: images, video, spreadsheets, documents). One file per asset. `res/.thumbs/` and `res/.inbox-snapshots/` hold auto-generated content; they are not part of the spec and should not be committed.
- **Node semantics.** Buds (bloomable, always have a `resource`) vs leaves (inline, do not bloom).
- **Field reference.** Board fields: `version`, `name`, `brief`, `nodes`, `edges`. Node fields: `id`, `kind`, `type`, `position`, `size`, `created`, `createdBy`, `updatedAt`, `updatedBy`, `label`, `content`, `resource`. Edge fields: `id`, `from`, `to`, `label`.
- **Versioning.** Schema version in the board file. Current board schema version is `3`. Changing the schema is a breaking change.

The user model remains app-level, not board-level, in v3. The board stores only string provenance fields on nodes; richer user data such as avatars or email belongs in app settings or a future identity layer, not in the board manifest.

This layer is inert data. Any tool that can read JSON and traverse a directory can consume it. No behavior, no runtime, no framework.


## Layer 2: Host-Editor Protocol (HEP)

How any consumer — UI editor, LLM agent, CLI tool — interacts with bud data. This is the contract that makes an LLM agent and a React editor equivalent citizens. Both speak HEP. One renders pixels, the other emits text.

### Semantics (not transport)

The spec defines what these operations *mean* — ordering guarantees, conflict behavior, lock semantics — not how bytes move. An Electron viewer implements HEP over IPC. A web app implements it over HTTP. An LLM agent implements it over direct filesystem access.

```ts
interface HostEditorProtocol<T> {
  read(resource: string): Promise<T>
  save(resource: string, data: T): Promise<void>
  watch(resource: string, cb: (data: T) => void): Unsubscribe
  enqueueProposal(boardPath: string, proposal: Proposal): Promise<void>
}
```

### What HEP covers

- **Read/save contract.** How a consumer reads bud data and writes it back. Serialization format per file extension.
- **Watch/change notification.** How a consumer learns that an external actor modified a resource. This is the coupling point between native apps and the board: when a user edits a `.xlsx` in Excel and saves, the file watcher fires, the board thumbnail refreshes, and agent shells pick up the change. Watch is not optional for external-default modules.
- **Proposal inbox protocol.** How an agent submits write proposals rather than writing directly. Agents call `enqueueProposal`, which appends to `board.inbox.json`. The app polls the inbox and surfaces proposals to the user as ghost elements on the canvas. See the inbox system section in `whitebloom.md` for the full proposal schema, visual treatment, keyboard review flow, and diff/clone semantics.
- **Type discovery.** How a consumer determines what type a bud is and whether a handler is available.
- **Diffable interface.** The framework-independent data contract (`Diffable<T>`) that CoreAssets and modules implement to enable structured diffs in the proposal review UI. `diff(before, after): DiffResult` is pure data; the view (`DiffView`) lives in the framework binding at Layer 3.
- **Shell protocol.** How an agent discovers and consumes a module's agentic interface — reading `module_agents.md`, listing available lenses, invoking skills.

### Why this layer exists separately

Without HEP as its own layer, the read/save contract lives inside a framework-specific binding spec. An LLM agent would either depend on a React spec it doesn't use, or reinvent the IO contract ad hoc. HEP ensures the protocol is shared and the agent is a first-class consumer by construction, not by accident.

### Module data contract

The framework-independent parts of a module belong here:

- `id` — unique identifier (e.g. `"com.whitebloom.markdown"`)
- `type` — the bud type this module handles
- `fileExtension` — e.g. `.md`, `.json`
- `defaultRenderer` — `'internal'` or `'external'`. Declares whether the bloom action opens an in-app editor or the OS default app. Overridable per type in `whitebloom.config.json`.
- `createDefault()` — returns default data for a new bud of this type. External modules may return `null` — they reference existing files rather than creating new ones.

### Shell contract

The agentic interface is defined entirely at the HEP layer — it has no framework dependency. A shell is a directory of files:

- `agents/module_agents.md` — agent-facing description of the asset type
- `agents/lenses/*.lens.json` — interpretive frames (see `whitebloom.md` for full lens spec)
- `agents/skills/*` — operational tools for surgical editing

Shells are portable across all domain bindings. A shell written for a React app works identically in a Tauri app, a CLI tool, or a standalone LLM agent. This is the key payoff of the three-layer architecture — the agentic interface never touches Layer 3.


## Layer 3: Domain Bindings

Framework-specific specs that translate HEP into the platform's component model. Each binding spec is thin — mostly mapping `read/save` to props, stores, or IPC calls. Only **editors** live at this layer. Shells (lenses, skills, agent notes) are defined at Layer 2 and are shared across all bindings.

### Structure

```
Whitebloom React Binding Spec
  ├── WhitebloomEditor<T>: React component with BudEditorProps<T>
  ├── Thumbnail component contract (future)
  └── @whitebloom/ui CSS variable contract

Whitebloom Svelte Binding Spec
  ├── WhitebloomEditor<T>: Svelte component with equivalent props
  └── UI kit conventions

Whitebloom Native Binding Spec
  ├── WhitebloomEditor<T>: embedded view (C++/Qt, etc.)
  └── IPC protocol mapping for read/save
```

Binding specs are community-driven. Whoever builds a viewer for a new platform writes the binding spec. The core spec, HEP, and all shells work unchanged across every binding.


## Module packaging

A symbiotic module ships as a single package with layers separated:

```
whitebloom-markdown/           # internal-default module
  core/         # createDefault, validation, schema — CoreData level
  agents/       # Shell — lenses, skills, module_agents.md — HEP level
  protocol/     # read/save handlers, transforms — HEP level
  react/        # Editor component — React binding
  svelte/       # Editor component — Svelte binding

whitebloom-image/              # external-default module
  core/         # defaultRenderer: 'external', fileExtension, validation
  agents/       # Shell — lenses for agent image description, alt-text skill
  protocol/     # read() returns parsed metadata; transforms .xlsx → JSON, etc.
  # no react/ or svelte/ needed — bloom action calls openExternal
```

- An LLM agent imports `core/`, `protocol/`, and `agents/`.
- A React viewer imports `core/`, `protocol/`, `agents/`, and `react/`.
- A Svelte viewer imports `core/`, `protocol/`, `agents/`, and `svelte/`.
- An external-default module omits framework bindings entirely — the bloom action is handled by the host, not the module.

Shared logic is not duplicated. UI is swappable. The shell (`agents/`) is universal.

Because editors and shells are independently resolvable, a module author can also ship them as separate packages entirely. A security researcher can publish a standalone shell package with lenses and skills, without writing a single UI component. A UI developer can publish a polished editor, without thinking about agents. A domain expert can publish a single lens file.


## Governance

The CoreData spec and HEP (including the shell contract and lens format) are the load-bearing parts — worth stewarding by a consortium or standards body. Binding specs can be submitted by community implementors and blessed if they're consistent with the core layers.

The handoff is natural: the core spec stabilizes first, the reference implementation (the Electron app) validates it, the LLM agent integration validates the shell/lens boundary, and binding specs emerge as new viewers are built.
