## 0. Probe Findings

- [x] 0.1 Add a read-only WebDAV visibility probe that compares `exists(source)`, `exists(target)`, source directory listing, and target directory listing for normal and no-cache clients.
- [x] 0.2 Run the read-only probe against the failed 莲花楼 plan and confirm settled rows are visible through both `exists` and directory listing.
- [x] 0.3 Run a real temporary cross-directory same-basename MOVE probe and observe `MOVE ok` followed by source/target invisibility through both `exists` and directory listing for at least 30 seconds.
- [x] 0.4 Update design so the probe remains diagnostic and executor no longer tries to prove remote final consistency.

## 1. Plan Lifecycle

- [x] 1.1 Review current `rename_plans.status`, `rename_plan_items.status`, task states, and UI/API assumptions for terminal rename plans.
- [x] 1.2 Ensure a rename plan can have only one queued, running, succeeded, partially_failed, or failed execution task.
- [x] 1.3 Reject attempts to execute terminal rename plans with a stable error code and rescan guidance.
- [x] 1.4 Add tests proving a terminal rename plan cannot be executed again.

## 2. Executor Simplification

- [x] 2.1 Remove MOVE-after visibility settling loops from the business executor path.
- [x] 2.2 Remove executor-level batched rename-in-place and final-move phases.
- [x] 2.3 Refactor executor to process selected rows sequentially: preflight, one `client.moveFile(source, target)`, post actions, persist row result, then next row.
- [x] 2.4 Treat successful FileClient MOVE return as the row succeeded/submitted result.
- [x] 2.5 Treat failed FileClient MOVE return or thrown error as the row failed result.
- [x] 2.6 Continue executing remaining selected rows after a row MOVE failure.
- [x] 2.7 Preserve existing pre-MOVE validations for source missing, target conflict, overwrite, and resumable intermediate path cases.
- [x] 2.8 Ensure sidecar and metadata failures remain warnings after video success and do not revert the video row result.
- [x] 2.9 Add executor tests for row-by-row order, success, row failure continuing later rows, all rows failed, conflict, overwrite, and sidecar/metadata warnings.

## 2A. FileClient Move Contract

- [x] 2A.1 Extend FileClient move result types to include optional move steps.
- [x] 2A.2 Add a structured FileMoveError shape that includes failure stage, source path, attempted path, target path, and optional intermediate path.
- [x] 2A.3 Implement WebDAV/AList `moveFile` so cross-directory different-basename moves perform same-directory rename first, then move the renamed file to the target directory.
- [x] 2A.4 Keep same-directory rename, cross-directory same-basename move, and future storage adapters behind the same `moveFile(source, target)` contract.
- [x] 2A.5 Add WebDAV client tests for direct move, same-directory rename, cross-directory same-basename move, cross-directory different-basename two-step move, rename stage failure, and final move stage failure.

## 3. Row Records And Task Summary

- [x] 3.1 Persist each attempted row result and execution record before task completion summary is written.
- [x] 3.2 Include source path, target path, FileClient move steps, failure stage, intermediate path, MOVE return, error, and warnings in execution record context.
- [x] 3.3 Compute task completion as succeeded, partially_failed, or failed from row result counts.
- [x] 3.4 If partially_failed is unavailable in the current status model, use failed with explicit partial success counts in summary.
- [x] 3.5 Add tests for task summaries and execution records when some rows succeed and some rows fail.

## 4. Scanner Truth Boundary

- [x] 4.1 Remove executor-side direct updates to `library_items` organized status and file statistics.
- [x] 4.2 Ensure scanner updates item identity inheritance, existence, and video/compliant/non-compliant counts from current remote directories.
- [x] 4.3 Ensure failed or partially failed rename tasks never set item status to `failed`.
- [x] 4.4 Add tests proving scan after rename updates media library display according to remote facts.

## 5. Automatic Post-Rename Scans

- [x] 5.1 Collect affected source directories and target directories from selected plan rows after rename execution.
- [x] 5.2 Deduplicate affected scan targets and reuse existing queued/running scan tasks where possible.
- [x] 5.3 Enqueue scan tasks after rename task completion regardless of succeeded, partially_failed, or failed result.
- [x] 5.4 Record scan enqueue results in the rename task summary.
- [x] 5.5 Add tests for post-rename scan enqueue on all-success, partial-failure, and all-failure tasks.

## 6. Worker Restart Handling

- [x] 6.1 On worker startup, finish running `execute_rename_plan` tasks as failed without continuing the same plan.
- [x] 6.2 Summarize stored succeeded, failed, and pending row counts for interrupted rename tasks.
- [x] 6.3 Include guidance to scan affected directories before creating another plan.
- [x] 6.4 Add tests for worker startup interruption summaries.

## 7. UI And API

- [x] 7.1 Update task detail API/DTO if needed to expose row counts, failure reasons, warnings, and automatic scan enqueue results.
- [x] 7.2 Update task detail UI to distinguish MOVE request results from later scanner synchronization.
- [x] 7.3 Show automatic scan targets and enqueue status in rename task detail when present.
- [x] 7.4 Ensure terminal plan UI/API guides the user to rescan and create a new plan rather than rerun.

## 8. WebDAV Probe Tool

- [x] 8.1 Ensure probe output redacts credentials and does not print secrets.
- [x] 8.2 Make probe read-only by default and require explicit parameters for any real MOVE probe.
- [x] 8.3 Document how to run the probe against a known source/target pair and how to interpret long `source=false,target=false` limbo.

## 9. Verification

- [x] 9.1 Run `openspec validate harden-rename-worker-reliability --strict`.
- [x] 9.2 Run `pnpm run check`.
- [x] 9.3 Run `pnpm test`.
- [x] 9.4 Run `pnpm build`.
- [x] 9.5 Run `pnpm run build:worker`.
