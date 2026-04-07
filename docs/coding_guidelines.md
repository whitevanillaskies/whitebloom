# Coding Guidelines

## Internationalization

- Always use i18n (`useTranslation` / `t(...)`) for any user-visible string. Never use raw string literals unless the value is culture-invariant (e.g. the brand name `WHITEBLOOM`, IPC channel names, file extensions).

## Architecture

- The app is split into three Electron layers: **main** (Node.js/file I/O), **preload** (IPC bridge exposed on `window.api`), and **renderer** (React). Never access Node APIs directly from the renderer.
- All cross-process communication flows through `ipcRenderer.invoke` (preload) → `ipcMain.handle` (main). Every handler returns a structured result object with `ok: boolean`; handlers never throw across the IPC boundary.
- Preload exposes fully-typed method signatures in `src/preload/index.d.ts`. Update both the `.ts` and `.d.ts` whenever an IPC channel is added or removed.
- The main process is organized by domain: `ipc/` for handlers, `services/` for file/storage logic, `protocol/` for custom schemes, `state/` for shared mutable context. Keep `src/main/index.ts` as a thin composition root.

## State Management

- Use **Zustand** for all renderer state. Create stores with `create<StateType>((set, get) => ({ ... }))` and export as `useXxxStore`.
- Use selector form (`useXxxStore((s) => s.field)`) to avoid re-renders unrelated to the selected slice.
- Prefer `set((state) => newState)` functional form for all mutations; avoid direct object spreading outside of `set`.
- When a store field can be explicitly `null` (e.g. `wrapWidth`), use property-existence checks rather than `??` to distinguish "not provided" from "explicitly null".

## TypeScript

- Prefer strict, narrow types. Use union literals for finite variants: `type Tool = 'pointer' | 'hand' | 'text'`.
- Compose types with `Pick`, `Omit`, `Partial` rather than duplicating fields.
- Write normalization/validation at system boundaries (IPC, storage, user input). Use type-guard functions (`value is T`) where appropriate.
- Use `import type { ... }` for type-only imports.
- Path alias `@renderer/*` maps to `src/renderer/src/*`; prefer it over long relative paths.

## React Components

- Write components as plain functions with explicit return type `React.JSX.Element` (not `React.FC`).
- Define props as a local `type XxxProps = { ... }` above the component, not inline.
- Hook call order: `useState` → `useRef` → `useCallback` → `useMemo` → `useEffect`.
- Use `useCallback` for handlers passed to children; use `useMemo` for expensive derivations.
- Avoid storing derived data in state when it can be computed from existing state/props.

## CSS & Styling

- Each component has a paired `.css` file with the same base name (e.g. `Canvas.tsx` + `Canvas.css`).
- Use BEM-like naming: `component__element--modifier` (e.g. `.text-node__resize-zone--left`).
- Use CSS custom properties (design tokens) — `var(--color-accent-blue)` etc. — never hard-coded color/size values.
- Avoid inline `style` props for anything that can be expressed as a CSS class or variable.

## File & Symbol Naming

- **React components**: PascalCase `.tsx` (e.g. `BudNode.tsx`).
- **Utilities, services, hooks-files**: kebab-case `.ts` (e.g. `workspace-files.ts`, `app-settings-store.ts`).
- **Zustand hooks**: `useXxxxStore` (e.g. `useBoardStore`).
- **IPC registration files**: `register-{domain}-ipc.ts`.
- **CSS files**: match their component file name exactly.

## Error Handling

- IPC handlers wrap their body in `try/catch` and return `{ ok: false }` on failure; never let exceptions propagate across the IPC boundary.
- Log actionable errors with `console.error('context:', err)` before returning the failure result.
- Normalization functions (e.g. `normalizeAppSettings`) must always return a safe default for any input, including `null`/`undefined`/corrupt data.

## Imports

Group imports in this order (blank line between groups):
1. React / framework (`react`, `react-dom`)
2. Third-party libraries
3. Internal aliases (`@renderer/...`) and relative project imports
4. CSS side-effect imports
