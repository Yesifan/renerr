## 1. Backend Scan And Item Semantics

- [x] 1.1 Extend item listing/detail DTOs or query options so empty directories are hidden from default library grids but can still be inspected from item detail when explicitly requested.
- [x] 1.2 Update `scanLibraryPath` and `scanLibraryItem` so directories with zero videos refresh counts to 0, do not enqueue auto organize plans, and do not retain stale visible summary data.
- [x] 1.3 Add or update tests for default hidden empty directories, explicit empty-directory visibility, and scan summaries for no-video items.

## 2. Rename Plan Semantics

- [x] 2.1 Add no-op row detection when planner output has identical source and target paths.
- [x] 2.2 Ensure no-op rows default to unselected, are not treated as conflicts, and are excluded from confirmed rename plans.
- [x] 2.3 Recompute no-op status after row identity, season, or episode edits so changed target paths become normal selectable rows.
- [x] 2.4 Add tests for no-op draft rows, no-op submit behavior, and edited rows becoming executable.

## 3. Rename Execution Consistency

- [x] 3.1 Refactor executor item-summary updates so file counts are refreshed by rescanning affected remote items after execution.
- [x] 3.2 Preserve organized status on fully successful selected rows while keeping failed execution details out of item status.
- [x] 3.3 Ensure unselected rows and pre-existing compliant files remain included in post-execution statistics.
- [x] 3.4 Add tests for canceling selected rows, successful execution statistics, partial failure statistics, and identity inheritance to target folders.

## 4. WebDAV Move Reliability

- [x] 4.1 Add target parent directory visibility confirmation after `ensureDirectory`.
- [x] 4.2 Add bounded retry with short backoff for retryable WebDAV/AList 500 move failures.
- [x] 4.3 Preserve intermediate move recovery behavior and record retry/intermediate warnings in execution records.
- [x] 4.4 Add WebDAV client and executor tests for directory visibility delay, transient 500 retry success, retry exhaustion, and intermediate resume.

## 5. Task Observability And API

- [x] 5.1 Extend active task lookup so item detail can discover related active rename tasks after page refresh.
- [x] 5.2 Ensure rename progress exposes current/total, phase, message, succeeded, failed, and warning counts suitable for UI display.
- [x] 5.3 Update task detail and global logs UI data handling so long summaries, paths, errors, and context can be viewed completely.
- [x] 5.4 Add route/service tests for item-related active rename tasks and task detail payloads.

## 6. Library And Item UI

- [x] 6.1 Add prominent active scan/rename progress banners or status regions to library detail and item detail pages.
- [x] 6.2 Add item detail switch for explicitly showing empty-directory or empty-content information.
- [x] 6.3 Improve no-poster placeholders in library cards and item detail to show file/folder names with icons and bounded text.
- [x] 6.4 Keep action buttons disabled or clearly busy while related active scan/rename tasks are running.

## 7. Manual Match And Plan UI

- [x] 7.1 Add local loading, empty-result, and error states to manual TMDB search.
- [x] 7.2 Add local loading, empty-result, and error states to rename plan row TMDB search.
- [x] 7.3 Show no-op rows as skipped/unneeded in plan edit and final confirmation.
- [x] 7.4 Add media identity summary card to final confirmation, including per-row or grouped identity when rows differ.
- [x] 7.5 Ensure long source/target paths remain readable and copyable in plan edit and confirmation views.

## 8. Verification

- [x] 8.1 Run Svelte autofixer on modified `.svelte` files and resolve reported issues.
- [x] 8.2 Run `pnpm run check`.
- [x] 8.3 Run `pnpm test`.
- [x] 8.4 Run `pnpm build`.
- [x] 8.5 Run `pnpm run build:worker`.

## 9. WebDAV Reconcile-First Execution Follow-Up

- [x] 9.1 Refactor WebDAV rename execution so MOVE responses are reconciled through source/intermediate/target path visibility snapshots before rows are marked succeeded or failed.
- [x] 9.2 Replace immediate intermediate visibility failure with remote-settling handling for `source=false,destination=false`, using configured checkpoints such as 5s, 15s, 30s, 60s, 120s, and 300s.
- [x] 9.3 Implement retry gating so retryable 500 errors are retried only after reconciliation confirms `source=true,destination=false`.
- [x] 9.4 Execute cross-directory rename rows in phases: batch source-to-intermediate moves, reconcile intermediate visibility, then batch intermediate-to-final-target same-directory renames.
- [x] 9.5 Add indeterminate row handling for long-running `source=false,destination=false` and duplicate `source=true,destination=true` states, without setting library item status to `failed`.
- [x] 9.6 Record MOVE return values, attempts, reconciliation snapshots, phase decisions, and waiting reasons in execution records and task progress.
- [x] 9.7 Add unit and integration-style tests for delayed visibility success, 500 rollback retry, long limbo timeout, duplicate state, intermediate resume, and phased multi-row execution.
- [x] 9.8 Re-run `pnpm run check`, `pnpm test`, `pnpm build`, and `pnpm run build:worker`.

## 10. Rename-In-Place Then Move Strategy

- [x] 10.1 Change cross-directory rename planning in executor from source-to-target-directory-intermediate to original-source-to-renamed-source followed by renamed-source-to-final-target.
- [x] 10.2 Update reconciliation context and execution records to use original source, renamed source, and final target terminology.
- [x] 10.3 Remove old target-directory original-basename intermediate recovery behavior because beta does not require compatibility with prior execution states.
- [x] 10.4 Update task progress phase names and messages to distinguish same-directory rename from final cross-directory move.
- [x] 10.5 Update tests to verify same-directory rename phase runs before cross-directory move phase, rollback resumes from original source, renamed-source resume continues final move, long limbo is handled in either phase, and no legacy intermediate recovery remains.
- [x] 10.6 Re-run `pnpm run check`, `pnpm test`, `pnpm build`, and `pnpm run build:worker`.
