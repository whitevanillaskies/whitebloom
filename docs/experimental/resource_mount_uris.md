# Resource Mount URIs

Experimental proposal for a more general resource locator model in Whitebloom.

This is not an implementation plan. It is a candidate direction for making external links,
workspace-local resources, and studio-style path tokens live under one coherent system.


## Summary

Whitebloom should keep storing logical resource identifiers, not raw machine paths.

The proposed canonical form is a `wb://` URI family with named authorities:

- `wb://workspace/...` for workspace-local resources
- `wb://app/...` for app-local resources
- `wb://hosted/...` for inline or embedded board-local resources
- `wb://mount/<TOKEN>/...` for user-defined or studio-defined logical roots

In this model, `mount` is a built-in namespace. The path segment immediately following
`wb://mount/` is the mount token name. No extra sigil such as `$` is required.

Example:

```text
wb://mount/SHOW/assets/char/hero/model.usd
```

This means:

- authority: `mount`
- token: `SHOW`
- path inside token root: `assets/char/hero/model.usd`


## Motivation

Whitebloom already distinguishes between logical workspace resources and concrete filesystem
paths. `wloc:` points into the workspace, while `file:///` points to a concrete absolute file.

That split is useful, but it is too narrow for production-style pipelines:

- users often cannot move all source material into the workspace
- absolute linked paths are fragile when machines, drive letters, or network mounts differ
- studios often want stable logical roots such as "show", "textures", or "shared"
- a resource model should support workspace-local, app-local, embedded, and externally mounted
  assets without inventing a different ad hoc scheme for each one

The proposal keeps the good part of `wloc:` while generalizing the resolver model.


## Design Goals

- Keep authored resource strings logical and portable where possible
- Support user-defined and studio-defined path roots
- Preserve direct concrete paths when the user explicitly wants them
- Avoid variable interpolation syntax in the canonical stored form
- Make parsing unambiguous
- Keep room for future asset resolver contexts without changing board data again


## Core Model

Every resource reference has three layers:

1. Authored resource identifier
2. Resolver context
3. Resolved concrete location

### 1. Authored resource identifier

This is the string stored on the node.

Examples:

```text
wb://workspace/blossoms/research.md
wb://app/res/cache/thumb.png
wb://hosted/img-1
wb://mount/SHOW/assets/char/hero/model.usd
file:///D:/capture/reference.mov
```

### 2. Resolver context

This is the environment used to interpret logical URIs.

It may include:

- workspace root
- app data root
- hosted in-memory board data
- a map of named mount tokens to absolute roots
- optional future search paths or pipeline configuration

How this context is supplied is intentionally unspecified here. It could come from:

- workspace config
- app config
- environment variables
- studio package config
- user preferences
- a host integration

The key point is that the resolver context is not baked into the resource string.

### 3. Resolved concrete location

This is the final file path, stream source, or package member actually opened by the host.

Examples:

- `D:\projects\show-a\assets\char\hero\model.usd`
- `\\nas-01\shows\show-a\textures\wood\oak.exr`
- `/mnt/show-a/assets/char/hero/model.usd`


## Authorities

### `wb://workspace/...`

Built-in logical root for the active workspace.

```text
wb://workspace/blossoms/research.md
wb://workspace/res/photo.jpg
```

This is the long-form replacement for today's `wloc:` concept.

### `wb://app/...`

Built-in logical root for app-managed data.

```text
wb://app/res/cache/thumb.png
wb://app/boards/transient/quickboard-1.wb.json
```

This is the long-form replacement for today's `wbapp:` concept.

### `wb://hosted/...`

Built-in logical root for board-local embedded resources.

```text
wb://hosted/img-1
```

This is the long-form replacement for today's `wbhost:` concept.

### `wb://mount/<TOKEN>/...`

Logical root for a user-defined or studio-defined external mount.

```text
wb://mount/SHOW/assets/char/hero/model.usd
wb://mount/TEXTURES/wood/oak_albedo.exr
wb://mount/SHARED/references/camera/chart.png
```

`<TOKEN>` is not a folder name inside a special directory. It is a symbolic name looked up in
the resolver context.

Example mapping:

```json
{
  "SHOW": "\\\\nas-01\\shows\\show-a",
  "TEXTURES": "D:\\pipeline_cache\\textures",
  "SHARED": "/mnt/shared"
}
```

This allows the authored URI to remain stable even if the concrete root changes per machine,
site, or studio setup.


## Why `mount` Instead of Variable Syntax

The canonical stored form should be structured, not interpolated.

Preferred:

```text
wb://mount/SHOW/assets/char/hero/model.usd
```

Avoid as canonical storage:

```text
$SHOW/assets/char/hero/model.usd
${SHOW}/assets/char/hero/model.usd
```

Reasons:

- no interpolation grammar
- no escaping rules
- no ambiguity about what is a token and what is a path segment
- simpler validation
- clearer future expansion to other authorities

UI sugar may still accept `$SHOW/...` and normalize it to `wb://mount/SHOW/...`, but the
canonical stored form should stay structured.


## Resolution Rules

### `wb://workspace/...`

Resolve relative to the active workspace root.

### `wb://app/...`

Resolve relative to the app-managed data root.

### `wb://hosted/...`

Resolve inside the board-local embedded resource map.

### `wb://mount/<TOKEN>/...`

Resolve by:

1. looking up `<TOKEN>` in the active resolver context
2. taking the configured absolute root for that token
3. joining the remaining relative path under that root
4. normalizing the result
5. rejecting escapes outside the configured root

If the token is missing, the resource is unresolved but not malformed.


## Relationship to Existing Schemes

This proposal does not require immediately deleting older schemes.

Compatibility mapping:

- `wloc:blossoms/research.md` -> `wb://workspace/blossoms/research.md`
- `wbapp:res/cache/thumb.png` -> `wb://app/res/cache/thumb.png`
- `wbhost:img-1` -> `wb://hosted/img-1`

`file:///` should remain valid and keep its current meaning:

- it is concrete
- it is machine-specific
- it does not go through named mount lookup

This is important because Whitebloom still needs a way to express "open this exact file on
this machine".


## Why Keep `file:///`

`file:///` is still useful for:

- quickboards
- one-off local references
- explicit direct linking
- debugging
- cases where no logical mount should be involved

It should not be redefined to mean "logical Whitebloom path". It already has a clear and
standard meaning: a concrete filesystem location.


## What This Solves

- Workspace-local assets and externally mounted assets can share one URI family
- Users can define logical roots without using sigils or interpolation
- Studios can remap network locations without rewriting board data
- Different machines can resolve the same logical URI differently
- `wloc` becomes one built-in case of a more general resource resolver


## What This Does Not Solve

This proposal does not by itself provide stable identity across renames or moves inside a
mount root.

If this URI is stored:

```text
wb://mount/SHOW/assets/char/hero/model.usd
```

and the file is renamed to `model_v2.usd`, resolution will fail until the URI is updated.

Solving that requires a stronger identity layer such as:

- asset database IDs
- catalog-backed resolver entries
- sidecar metadata with stable IDs

That is a separate problem and should not be conflated with path token support.


## Non-Goals

- Defining the exact config file format for mount declarations
- Defining whether mounts live at app scope, workspace scope, or both
- Defining package or archive semantics
- Defining remote fetch or cloud object storage semantics
- Defining asset database integration


## Examples

### Workspace-local board asset

```text
wb://workspace/res/diagram.png
```

### Embedded quickboard image

```text
wb://hosted/img-2
```

### Studio show asset

```text
wb://mount/SHOW/assets/vehicles/truck/model.usd
```

### Shared texture library

```text
wb://mount/TEXTURES/metal/steel_brushed_normal.exr
```

### Explicit concrete file

```text
file:///D:/capture/reference.mov
```


## Open Questions

- Should `wb://mount/<TOKEN>/...` allow tokens to be declared at both workspace scope and app
  scope, with one overriding the other?
- Should unresolved mount tokens render as ordinary error nodes, or as a distinct "missing
  resolver context" state?
- Should quickboards allow `wb://mount/...`, or should they be limited to `file:///`,
  `https://`, and `wb://hosted/...` until promoted?
- Should the app offer user-facing shorthand input such as `$SHOW/...`, or keep the visible UI
  fully aligned with the canonical URI form?


## Decision Shape

If Whitebloom adopts a generalized resource URI family, `wb://mount/<TOKEN>/...` is a strong
candidate for the external-path piece because it is:

- readable
- explicit
- sigil-free
- easy to parse
- compatible with user-defined logical roots
- compatible with studio pipeline remapping

The most important rule is simple:

Store logical resource identifiers in board data. Resolve them using context. Keep `file:///`
for truly concrete paths.
