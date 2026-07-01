## 1. Data Model

- [x] 1.1 Update Drizzle schema for task observability fields, including task target key, result summary, and log task association.
- [x] 1.2 Add indexes needed for active task lookup, task detail logs, global log ordering, and cleanup queries.
- [x] 1.3 Update domain DTO types for task progress, task summary, task detail, task logs, and active task summaries.
- [x] 1.4 Run beta DB sync with `pnpm run db:push` after schema changes.

## 2. Task And Log Services

- [x] 2.1 Centralize task target key generation for `scan_library_path`, `scan_library_item`, and `execute_rename_plan`.
- [x] 2.2 Replace direct enqueue calls with a unique enqueue flow that returns existing queued/running tasks for the same type and target key.
- [x] 2.3 Extend task service APIs to update progress, finish with result summary, list active tasks by target, and load task detail.
- [x] 2.4 Extend log service APIs to write task-associated business events with bounded context and query logs by task id.
- [x] 2.5 Implement log and execution-record cleanup helpers using retention days and maximum row limits without deleting queued/running task data.

## 3. Scanner And Executor Events

- [x] 3.1 Pass task id into scan library path and scan library item execution paths from the worker.
- [x] 3.2 Add scan task progress updates for listing, per-item processing, skipped items, recognition counts, and completion.
- [x] 3.3 Add scan task logs for scan start, item recognized, item recognition failed, optional skipped events, and scan finished.
- [x] 3.4 Add scan task result summaries with processed, recognized, failed, skipped, and warning counts.
- [x] 3.5 Add rename task progress updates for plan loading, per-row moves, succeeded/failed counts, warnings, and completion.
- [x] 3.6 Add rename task logs for plan start, file move succeeded, file move failed, sidecar warning, metadata warning, and plan finished.
- [x] 3.7 Keep file movement facts in execution records while using task logs as the user-readable event stream.

## 4. API Surface

- [x] 4.1 Update scan and rename submit endpoints to return existing active tasks when duplicate targets are requested.
- [x] 4.2 Add or extend tasks API to return task list rows with target, progress, summary, created/started/finished times, and error summary.
- [x] 4.3 Add task detail API returning one task, progress, summary, task logs, and related execution records when applicable.
- [x] 4.4 Add active task summary API for homepage, library detail, and item detail UI lookups.
- [x] 4.5 Update logs API to expose task id and enough target metadata for global log to task-detail navigation.

## 5. UI

- [x] 5.1 Update homepage library cards to show queued/running library scan status and available progress.
- [x] 5.2 Update library detail scan controls to disable duplicate scans and link to the active task detail.
- [x] 5.3 Update item detail scan and organize controls to disable duplicate active tasks and link to relevant task details.
- [x] 5.4 Update system tasks page to show task type, target object, status, progress, summary, timestamps, and error summary.
- [x] 5.5 Add task detail page with progress, completion summary, backend log message/summary/context display, and execution records for rename tasks.
- [x] 5.6 Update global logs page to show task-linked entries with navigation to task detail while preserving non-task system logs.
- [x] 5.7 Show a clear fallback when a historical task summary exists but detailed logs or execution records were cleaned up.

## 6. Tests And Verification

- [x] 6.1 Add service tests for unique enqueue behavior across library scan, item scan, and rename plan execution.
- [x] 6.2 Add scanner tests for progress updates, recognition success/failure logs, skipped counts, and scan summaries.
- [x] 6.3 Add executor tests for move success/failure logs, warning logs, execution records, and rename summaries.
- [x] 6.4 Add cleanup tests proving old logs/records are cleaned while queued/running task data is retained.
- [x] 6.5 Add API tests for task detail, active task summaries, duplicate task responses, and global log task links.
- [x] 6.6 Run `pnpm run check`, `pnpm test`, `pnpm build`, and `pnpm run build:worker`.
