## 1. Component Foundations

- [x] 1.1 Inspect the installed Bits UI Combobox API and current Svelte 5 patterns before implementing the new components
- [x] 1.2 Add a typed `AsyncCombobox.svelte` project component that supports async loading, empty/error/loading states, selection, custom option rendering, keyboard interaction, and mobile-friendly dropdown sizing
- [x] 1.3 Add focused tests or component-level coverage for `AsyncCombobox` loading, failed load, empty options, option selection, and keyboard-visible behavior where the project test setup supports it
- [x] 1.4 Update `AGENTS.md` to require project-level custom UI components when complex UI is not covered by shadcn-svelte

## 2. Episode Mapping Input

- [x] 2.1 Add parse/format helpers for TV episode mapping input, including `1/1` -> `{ season: 1, episode: 1 }`, `S01E01` preview formatting, and invalid states for `1`, `1/`, `/1`, empty, and nonnumeric input
- [x] 2.2 Add tests for the episode mapping helpers and local invalid-state rules
- [x] 2.3 Add `EpisodeMappingInput.svelte` as a dedicated TV row component using Bits UI primitives, with separate season and episode candidate modes
- [x] 2.4 Render rich season candidates with season number, title/name, episode count, and overview when available
- [x] 2.5 Render rich episode candidates with season number, episode number, title/name, air date, and overview when available
- [x] 2.6 Ensure incomplete input remains local, does not call the draft update flow, and blocks final confirmation until completed, reverted, or cleared to a valid draft state

## 3. Integration

- [x] 3.1 Replace `LibraryPathDialog.svelte` path suggestions with `AsyncCombobox` while preserving parent-directory fetching, basename filtering, source-switch reset, manual input, and no auto path test on selection
- [x] 3.2 Replace rename plan TV row season/episode controls with `EpisodeMappingInput`
- [x] 3.3 Wire TV row candidate loading to the current row TMDB identity and reload candidates when the row identity changes
- [x] 3.4 Keep draft persistence as split numeric `season` and `episode` fields and reuse the existing draft row update flow for valid complete mappings
- [x] 3.5 Add row-local invalid/dirty tracking in the rename plan panel so final confirmation is disabled while any episode input has an incomplete local value

## 4. Verification

- [x] 4.1 Run the Svelte autofixer on touched Svelte components and address reported issues
- [x] 4.2 Run `pnpm run lint`
- [x] 4.3 Run `pnpm run check`
- [x] 4.4 Run `pnpm test`
- [x] 4.5 Run `pnpm build`
- [x] 4.6 Run `pnpm run build:worker`

## 5. Follow-up Fixes

- [x] 5.1 Split `EpisodeMappingInput` focused edit text from blurred display label so `5/27` remains the parseable value and `S05E27 · <episode title>` is display-only
- [x] 5.2 Use selected/cached episode metadata to render the blurred display label, with `SxxExx` fallback when episode metadata is unavailable
- [x] 5.3 Remove duplicate row-level `errorCode` rendering from the season/episode column so `plan.invalid` appears only in the path column
- [x] 5.4 Add or update tests for edit/display value conversion and row invalid message placement
- [x] 5.5 Run Svelte autofixer, `pnpm run lint`, `pnpm run check`, and focused tests after the follow-up fixes
