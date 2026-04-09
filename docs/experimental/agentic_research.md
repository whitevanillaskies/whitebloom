# Agentic Integration Research

Notes on embedding an LLM agent directly into the Whitebloom Electron app, and how pi-mono's SDK maps onto the existing HEP architecture.


## Decision

**Pi-mono SDK (`@mariozechner/pi-coding-agent`) is the embedded agent implementation for Whitebloom.**

Read SDK docs here:

https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md

Third-party consumers — CLI tools, web apps, Tauri apps — speak HEP directly or build their own Layer 3 binding. The SDK is an internal implementation detail of the Electron app, not part of the open spec. The open spec remains: CoreData (Layer 1), HEP including the shell/lens/skill contract (Layer 2), and community-defined domain bindings (Layer 3).


## Why pi-mono

Pi-mono powers OpenClaw. Its SDK (`createAgentSession`) provides:

- A replaceable tool surface — you pass exactly the tools you want, nothing more
- `readOnlyTools(cwd)` — pre-built, path-scoped file reads, no write access
- `defineTool()` — typed custom tool factory for adding Whitebloom-specific operations
- `agentsFilesOverride` — virtual AGENTS.md injection, which is structurally identical to Whitebloom's `module_agents.md` shell system
- `skillsOverride` — inject Whitebloom module skills into the agent context
- `session.subscribe()` — streaming event bus for the chat UI
- `SessionManager` — in-memory or file-based session persistence, per-session tree branching


## Architectural fit

The HEP interface is the agent's tool surface. Pi-mono doesn't see Electron, ReactFlow, or IPC — it sees a project directory and a constrained set of operations.

```
Renderer (React UI)
  │  IPC: chat:prompt / chat:event
  ▼
Main Process
  ├── AgentSession (pi-mono SDK)
  │     ├── readOnlyTools(projectRoot)     — read board, blossoms, res, shells
  │     └── submitProposal tool            — writes to <board-stem>.inbox.json only
  └── FileWatcher                          — notifies renderer when inbox changes
```

The renderer sends a `chat:prompt` IPC message. Main calls `session.prompt()` and streams events back via `webContents.send('chat:event', event)`. The agent never touches the renderer process.


## Tool surface

```ts
import { createAgentSession, readOnlyTools, defineTool, DefaultResourceLoader } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

const submitProposal = defineTool({
  name: "submit_proposal",
  description: "Queue a proposed change in the board's inbox file for the user to review. Never write to board or asset files directly.",
  parameters: Type.Object({
    description: Type.String(),   // what the agent did
    rationale:   Type.String(),   // why — the thing the user evaluates
    commands:    Type.Array(Type.Unknown()),
    atomic:      Type.Boolean({ default: false }),
  }),
  execute: async (_id, params) => {
    await appendToInbox(boardPath, { agent: "pi", ...params })
    return { content: [{ type: "text", text: "Proposal queued." }], details: {} }
  },
})

const loader = new DefaultResourceLoader({
  cwd: projectRoot,
  agentsFilesOverride: (current) => ({
    agentsFiles: [
      ...current.agentsFiles,
      { path: "/whitebloom/BOARD.md",   content: buildBoardContext(board) },
      ...getLoadedModules().map(m => ({
        path:    `/whitebloom/modules/${m.id}/AGENTS.md`,
        content: fs.readFileSync(m.agentsFilePath, "utf8"),
      })),
    ],
    diagnostics: current.diagnostics,
  }),
  skillsOverride: (current) => ({
    skills:      [...current.skills, ...getWhitebloomSkills()],
    diagnostics: current.diagnostics,
  }),
  systemPromptOverride: () => WHITEBLOOM_SYSTEM_PROMPT,
})

const { session } = await createAgentSession({
  cwd:            projectRoot,
  tools:          readOnlyTools(projectRoot),  // replace entirely, do not add write tools on top
  customTools:    [submitProposal],
  sessionManager: SessionManager.inMemory(),   // or SessionManager.create(projectRoot) for persistence
  resourceLoader: loader,
})
```

`buildBoardContext` produces the board `brief` plus a compact summary of node types and count — enough for the agent to orient without reading the full manifest upfront.


## Shell system mapping

Pi-mono's `agentsFiles` (AGENTS.md injection) is structurally identical to Whitebloom's shell system. The mapping is direct:

| Whitebloom spec (Layer 2 HEP) | Pi-mono SDK |
|---|---|
| `module_agents.md` | injected via `agentsFilesOverride` |
| `agents/lenses/*.lens.json` | readable via `readOnlyTools` — agent finds them by following the shell path |
| `agents/skills/*` | injected via `skillsOverride` |
| Board `brief` | injected as virtual `/whitebloom/BOARD.md` |

Shells written for the open spec work without modification in the embedded agent. A shell author writes one set of files; they work for CLI agents, third-party tools, and the embedded pi-mono session identically.


## Process model

Run entirely in the **main process** — no Worker Thread or `isolate-vm` required for now.

Pi-mono is a trusted SDK, not user-supplied code. Its LLM calls are fully async and do not block the event loop. Main already owns the filesystem and IPC, so it's the natural home for the session. The renderer never runs agent code.

Reserve `isolate-vm` for a future feature where users can author custom skills in JavaScript that run inside the agent loop. That's the point where untrusted code enters and isolation becomes necessary.


## Agent taxonomy

Three kinds of agents can work with a Whitebloom workspace:

- **Type 1: Standalone / unmanaged.** Operates directly on CoreData without going through HEP. E.g., uploading a `*.wb.json` to ChatGPT and asking it to reason about the board. No inbox, no proposal flow — the agent does whatever it wants. Not managed by Whitebloom.
- **Type 2: HEP-speaking.** External agents that speak the Host-Editor Protocol — CLI tools, web agents, remote services. They read/save via HEP and submit proposals to the board's `<board-stem>.inbox.json` via `enqueueProposal`. The most common integration pattern for third-party tooling.
- **Type 3: Embedded.** An agent embedded inside a Layer 3 binding (e.g. pi-mono inside the Electron app). Fully managed by the host application, with access to IPC, file watchers, and the full shell system.

Type 2 and 3 are the interesting managed cases. Type 1 is out of scope for the UI below.


## Contacts

Rather than "agents", managed agent sessions are called **Contacts**. A Contact is a configured agent session — one particular agent you're in a relationship with. The name generalizes naturally to human collaborators in a future multiplayer context.

The Contact abstraction is transport-agnostic. A Contact backed by pi-mono is Type 3. A Contact backed by an HTTP webhook or file-based HEP is Type 2. The UI layer doesn't distinguish.

**Contact config (board-level, `<board-stem>.contacts.json`):**

```json
{
  "contacts": [
    {
      "id": "contact-1",
      "name": "Research Assistant",
      "type": "pi-mono",
      "lenses": ["com.whitebloom.markdown/summary", "com.whitebloom.image/describe"],
      "skills": ["com.whitebloom.markdown/extract-headings"],
      "assetScope": ["node-id-1", "node-id-2"],
      "sessionPersistence": "file"
    }
  ]
}
```

`assetScope: null` means full board access. `sessionPersistence: "file"` maps to `SessionManager.create(projectRoot)` in pi-mono; `"memory"` maps to `SessionManager.inMemory()`.

Contact configs live at the **board level** (`<board-stem>.contacts.json` alongside the board file), not in app settings or `.wbconfig`. The agent scope configuration — which lenses, which skills, which assets — is inherently board-specific. Board-level contacts also keep the board self-contained: sharing a board brings its contacts along. Global "contact templates" can be layered on later without a schema change.

This is HEP layer config (how to set up a session), not CoreData — it does not belong in `*.wb.json` or `.wbconfig`.


## Side panel: Inbox and Chat tabs

A collapsible side panel (VS Code / macOS Pages style, hideable) with icon tabs at the top:

- **Inbox tab** — board-scoped. All agent proposals, alerts, and notifications across all contacts, pending user review. This is the "action required" layer.
- **Chat tab** — contact-scoped. Navigate to a contact → chat window. Like macOS Messages: each contact has a thread. You add contacts by specifying agentic configuration (lenses, skills, asset scope).

These two tabs are complementary, not overlapping. When a contact submits a proposal:
- The **Chat thread** shows the agent message ("I've queued a proposal for X").
- The **Inbox tab** shows the reviewable, actionable proposal item.

Badges on each tab signal different things: inbox badge = something needs a decision, chat badge = a contact said something.

**Open question: proposal preview in chat.** When a contact submits a proposal, does a preview appear inline in the chat (collapsed, expandable) or does the message just link to the Inbox tab? Inline is richer but requires the chat view to understand proposal rendering. Linking to inbox is simpler and keeps the two concerns fully separate. Given that the inbox already owns the review UI (ghost elements, diff view, keyboard flow), routing to inbox and linking from the chat message is the safer starting point — but this needs more thought.


## Open item: readOnlyTools surface audit

Pi-mono's `readOnlyTools` preset likely includes a shell/bash execution tool for things like `ls` and `find`. That's broader than we need. Before shipping, audit the tool set and replace the preset with an explicit whitelist:

- `read_file` — read a single file within `projectRoot`
- `list_directory` — list entries within `projectRoot`
- No `bash`, no `grep` subprocess, no network tools beyond what the SDK uses internally for API calls

The `tools` option replaces the entire set, so we can compose exactly what we want rather than inheriting the full preset. This is the main security decision to make during implementation.
