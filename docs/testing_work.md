# Testing

## What stays in test/

Keep the existing folders in `test/`.

- `test/boards/` contains board fixture files. These are sample `.wb.json` documents we can load in regression tests.
- `test/workspaces/` contains workspace fixture data. This is useful when we want to test workspace loading behavior.

Those files are not the tests themselves. They are test data.

## Where the actual tests go

For now, actual Vitest files live directly under `test/` and use the `*.test.ts` naming pattern.

Current examples:

- `test/workspace-files.test.ts`
- `test/board-store.test.ts`
- `test/board-fixtures.test.ts`

This keeps the tests close to the fixture data and avoids mixing test code into the production source tree while the suite is still small.

## When tests run

Tests do not run automatically when you start the Electron app.

They run only when you ask for them:

- `npm test` runs the full suite once.
- `npm run test:watch` keeps Vitest open and re-runs affected tests when files change.

Later, if wanted, tests can also run automatically in CI or before release builds. That is separate from the app itself.

## What the first tests cover

The first Vitest slice is intentionally narrow and high value.

- Workspace and board file behavior in `src/main/services/workspace-files.ts`
- Core board state invariants in `src/renderer/src/stores/board.ts`
- Regression loading of all existing board fixtures in `test/boards/`

This is aimed at the two most dangerous failures for Whitebloom right now: data loss and silent format breakage.

## Next likely additions

- `src/main/resource-uri.ts` path and URI safety tests
- `src/renderer/src/modules/schemabloom/schema.ts` mutation tests
- A short manual UX regression checklist for feel, lag, and interaction quality