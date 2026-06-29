## 1. Route Data Boundaries

- [x] 1.1 Review `src/routes/libraries/[id]/+page.server.ts`, `src/lib/server/services/items.ts`, and existing item API routes to confirm how to load library path, item summary, and item detail by route params
- [x] 1.2 Add `src/routes/libraries/[id]/[item_id]/+page.server.ts` to load the current library path and item context, returning a clear not-found error when the item does not belong to the library path
- [x] 1.3 Keep `src/routes/libraries/[id]/+page.server.ts` focused on library path and item list initial data only
- [x] 1.4 Update route type imports and generated `$types` usage after adding the nested route

## 2. Library Path List Page

- [x] 2.1 Remove `selectedItemId`, `draftId`, manual match state, item detail query, and rename plan mutations from `src/routes/libraries/[id]/+page.svelte`
- [x] 2.2 Keep list page mutations limited to library path scan, list refresh, and task link feedback
- [x] 2.3 Update `LibraryItemGrid.svelte` props so it only receives `items` and enough route context to build item detail links
- [x] 2.4 Simplify `LibraryItemCard.svelte` so the card displays poster, title/path, year, status, video count, and non-compliant count only
- [x] 2.5 Make each card navigate to `libraries/[id]/[item_id]` without embedding manual match, scan, or rename plan controls

## 3. Item Detail Page

- [x] 3.1 Create `src/routes/libraries/[id]/[item_id]/+page.svelte` with a PageHeader that includes a back link to the library path, item title/path, status, and item-level actions
- [x] 3.2 Move item detail query and Svelte Query invalidation into the new detail page using `queryKeys.itemDetail(item_id)`
- [x] 3.3 Move manual TMDB search, query input state, search results, and identity selection into the detail page
- [x] 3.4 Move single item scan, rename plan draft creation, draft update, conflict confirmation, and submit mutation into the detail page
- [x] 3.5 Rework `ItemDetailPanel.svelte` props so it receives the current item directly rather than a nullable selected item
- [x] 3.6 Place `ManualMatchPanel.svelte` and `RenamePlanPanel.svelte` as dedicated detail-page sections, not card children

## 4. UX And Component Cleanup

- [x] 4.1 Ensure item card heights are stable and do not expand based on manual match or operation state
- [x] 4.2 Ensure the detail page uses shadcn Card/Table/Button/Badge/Skeleton/Empty components and keeps page-level classes primarily structural
- [x] 4.3 Ensure empty, loading, failed, pending review, identified, organized, and non-compliant states remain visible after the split
- [x] 4.4 Remove imports and component props that only supported same-page selected item behavior
- [x] 4.5 Confirm mobile layout stacks detail sections without overlapping controls or hiding primary actions

## 5. Verification

- [x] 5.1 Run Svelte autofixer on changed `.svelte` files until no issues remain
- [x] 5.2 Run `pnpm run check`
- [x] 5.3 Run `pnpm test`
- [x] 5.4 Run `pnpm build`
- [x] 5.5 Run `pnpm run build:worker`
- [x] 5.6 Start local web and worker if needed, then smoke test: library path list, card navigation, direct item detail URL, manual match, item scan, rename plan create/update/submit, and browser back navigation. Non-destructive smoke checks were completed; real WebDAV rename-plan submit was intentionally skipped by user request.
