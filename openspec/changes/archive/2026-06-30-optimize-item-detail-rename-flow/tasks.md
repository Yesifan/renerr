## 1. Implementation Setup

- [x] 1.1 Load `/impeccable` before UI implementation, run its context setup for the item detail route, and apply the Renarr product UI register constraints
- [x] 1.2 Load `/svelte-code-writer` before creating, editing, or analyzing any `.svelte`, `.svelte.ts`, or `.svelte.js` files
- [x] 1.3 Use Svelte MCP `list-sections` and relevant `get-documentation` sections before Svelte component implementation, especially for runes, props, bindings, each blocks, dialog/accessibility, and SvelteKit data loading

## 2. Item Status Semantics

- [x] 2.1 Update item status schema, formatters, i18n messages, and UI state mappings so new code no longer produces or displays item status `failed`
- [x] 2.2 Update scanner behavior so parse failure, no match, ambiguous match, and low-confidence match all produce `pending_review`, with empty candidates allowed
- [x] 2.3 Add compatibility for existing `failed` items: treat rows with identity as `identified` and rows without identity as `pending_review`
- [x] 2.4 Update executor item summary writes so rename execution failures only affect task state, execution records, logs, and summary JSON, never item status `failed`
- [x] 2.5 Update API guards for scan, manual match, and plan creation to use `pending_review`, `identified`, and `organized` rules

## 3. Rename Plan Draft Model And API

- [x] 3.1 Extend `RenamePlanDraftRow` DTO with draft-only media fields for title, original title, year, and poster display data
- [x] 3.2 Populate draft row media fields from the current item identity when creating a draft
- [x] 3.3 Extend draft update payload handling to accept row-level TMDB identity updates and recompute only that row target path
- [x] 3.4 Preserve TV season and episode when applying a row-level TMDB override, parsing missing values from source path only when needed
- [x] 3.5 Keep confirmed `rename_plan_items` schema unchanged, storing only existing source path, target path, media kind, source media id, season, episode, overwrite, and sidecars fields
- [x] 3.6 Add or update tests for row-level identity override, target path recomputation, selected row validation, and conflict handling

## 4. Item Detail Page UI

- [x] 4.1 Redesign item detail with `/impeccable` guidance to remove the summary card and integrate poster, media identity, status, full remote path, and statistics into the main detail layout
- [x] 4.2 Remove the real-time file list from item detail and keep complete item path/statistics visible in the media information layout
- [x] 4.3 Implement item detail action rules: `pending_review` shows manual match only, `identified` shows manual match and execute plan, `organized` shows execute plan only when non-compliant files exist
- [x] 4.4 Ensure organized items never show manual match, and execution failures are not surfaced as media status on library home or item media information
- [x] 4.5 Keep page state ownership in the item detail route, with child components receiving props/callbacks for mutations

## 5. Manual Match And Plan Dialog Flow

- [x] 5.1 Replace inline manual match and rename plan panels with wide dialog flows that follow `/impeccable` product UI constraints
- [x] 5.2 Implement manual match steps: show existing candidates when present, support TMDB search, save chosen identity immediately, then create a draft
- [x] 5.3 Implement execute plan steps: create draft from existing identity, edit draft rows, then show final confirmation
- [x] 5.4 Build draft editing UI with row selection, source full path, media title, TV season/episode inputs, conflict overwrite controls, sidecar preview, and target path preview
- [x] 5.5 Add row-level inline TMDB search for changing a single row identity, without arbitrary custom title input and without changing item identity
- [x] 5.6 Build final confirmation view without a table, using target full path as the primary information plus source path, media mapping, conflict, and overwrite context
- [x] 5.7 Prevent final confirmation and submit when selected rows are invalid or conflicts are unresolved

## 6. Verification

- [x] 6.1 Run Svelte autofixer from `/svelte-code-writer` on changed `.svelte` files until no relevant issues remain
- [x] 6.2 Run `pnpm run check`
- [x] 6.3 Run `pnpm test`
- [x] 6.4 Run `pnpm build`
- [x] 6.5 Run `pnpm run build:worker`
- [x] 6.6 Smoke test item detail flows for no default file list, pending review with candidates, pending review without candidates, identified re-match, organized non-compliant plan, row-level TMDB override, final confirmation, and rename execution failure visibility
