# Current Work

Reference `whitebloom.md`, `open_whitebloom.md`, `whitebloom_ideas.md` and `deferred_work.md` for authoritative guidelines and rules when implementing these work units. Ideas should be taken as tentative only.

---

## FocusWriter:

We missed step 6.

---

### Step 6 — Mode indicator UI (small)

Add a minimal mode label or icon in a corner of the editor so the user knows which mode they are in. Keep it subtle (low opacity, small caps). This is optional but recommended for discoverability.


---

## SchemaBloom Module Port

Fix react flow views bug.

### Plan — hibernate main canvas + persist viewport

**Problem:** When a bloom is open, the main canvas is only `visibility:hidden` — ReactFlow is still
mounted, running, and registering event listeners. SchemaBloom also uses ReactFlow, so two RF
instances coexist. When the bloom closes, RF's internal state is corrupted (focus, keyboard handlers,
drag state). Fix: unmount the main canvas while any bloom is active.

**Bonus:** Persist viewport (pan + zoom) to the `.wb.json` so users return to where they were
(matches Miro UX). Viewport changes must NOT mark the board dirty — they save silently when the board
is otherwise saved.

**Steps:**

1. **`shared/types.ts`** — add optional `viewport?: { x: number; y: number; zoom: number }` to the
   `Board` type. No version bump needed (additive, optional field).

2. **`stores/board.ts`** — add `viewport` to state (default `null`), add `updateViewport(x, y, zoom)`
   action (does NOT set `isDirty`). Wire `loadBoard` to read it from the board file. Wire
   `buildBoardSnapshot` (in Canvas) to include it.

3. **`canvas/Canvas.tsx`**:
   - Remove the `visibility:hidden` wrapper div.
   - Conditionally render the entire `<ReactFlow>` block: `activeBloom !== null ? null : <ReactFlow …/>`
   - Add `onMoveEnd` handler that calls `updateViewport`.
   - When a saved viewport exists, pass `defaultViewport={viewport}` and drop `fitView`.
     When no saved viewport (first load), keep `fitView` as before.
   - Include `viewport` in `buildBoardSnapshot` so it round-trips through save/load.