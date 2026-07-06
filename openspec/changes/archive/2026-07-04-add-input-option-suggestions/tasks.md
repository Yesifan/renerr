## 1. TMDB Season/Episode Options

- [x] 1.1 Add TMDB service functions for TV season list and season episode list, returning UI-safe DTOs without exposing API keys.
- [x] 1.2 Add direct TMDB-context JSON API routes for TV season options and episode options, with stable error codes for missing key, rate limit, and connection failure.
- [x] 1.3 Keep rename plan draft DTOs unchanged; fetch TMDB options through the direct TMDB-context API only.
- [x] 1.4 Add server/service tests covering season 0, empty TMDB results, failed TMDB requests, and API key redaction.

## 2. Rename Plan Row UI

- [x] 2.1 Extend client query keys and item detail page data flow for row-level TMDB season and episode option queries.
- [x] 2.2 Replace TV row season and episode plain number inputs in `RenamePlanPanel.svelte` with option-backed controls that still allow current/manual values.
- [x] 2.3 Ensure selecting season or episode calls the existing draft row update flow and refreshes target preview, validity, conflict, selected, and noop state.
- [x] 2.4 Add loading, empty, and error states scoped to the affected row, without hiding the whole rename plan dialog.

## 3. WebDAV Path Suggestions

- [x] 3.1 Reuse or extend `browseWebdav` and `/api/webdav/browse` so path suggestions load direct child directories for the selected source and current parent path.
- [x] 3.2 Add client-side path suggestion state/query keys for source/library path forms, including source-switch reset behavior.
- [x] 3.3 Update `LibraryPathDialog.svelte` path input UI to provide dropdown options and autocomplete while preserving manual text entry.
- [x] 3.4 Ensure selected suggestions write the full remote path into the input without automatically triggering path test; final save/test still uses the submitted path string.
- [x] 3.5 Add loading, empty, and error states for path suggestions without removing the existing path test action.

## 4. Verification

- [x] 4.1 Add or update tests for WebDAV browse suggestions covering root input, nested input, filtering, unreadable paths, and no recursive loading.
- [x] 4.2 Add or update Svelte component/page tests for rename plan season/episode option behavior and path autocomplete behavior where the project test setup supports it.
- [x] 4.3 Run `pnpm run lint`, `pnpm run check`, `pnpm test`, `pnpm build`, and `pnpm run build:worker`.
