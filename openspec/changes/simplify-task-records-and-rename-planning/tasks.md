## 1. Schema and Logging Foundation

- [x] 1.1 Add `pino` and `pino-pretty` dependencies and environment-specific logger modules for server, worker, client, and scripts.
- [x] 1.2 Update Drizzle schema to remove `logs` and `execution_records` and add `task_detail_lines` with `id`, `taskId`, `level`, `message`, and `createdAt`.
- [x] 1.3 Add task detail line service helpers for appending lines, listing lines by task id, and optionally pruning old lines.
- [x] 1.4 Implement a dedicated task recorder that writes user-visible task lines to both `task_detail_lines` and pino with task context.
- [x] 1.5 Configure Node-side pino for production JSON stdout, development pretty stdout, fixed redaction, standard error serialization, and child logger bindings.
- [x] 1.6 Configure client pino for development browser logging and production disabled behavior with no client log transmit endpoint.
- [x] 1.7 Replace all application `console.*` usage in `src`, `src/worker`, and scripts with the appropriate pino logger or task recorder.
- [x] 1.8 Remove or replace database log service APIs and cleanup code that only applied to DB logs or execution records.

## 2. Task Model and Worker Dispatch

- [x] 2.1 Add `create_rename_plan_for_item` to task types, task target key generation, default labels, active task expansion, and API schemas/types.
- [x] 2.2 Add worker dispatch for `create_rename_plan_for_item`.
- [x] 2.3 Implement create-plan-for-item task execution with summary fields for item id, plan id, executable rows, noop/skipped rows, invalid rows, auto execute flag, and execution task id.
- [x] 2.4 Ensure duplicate queued/running `create_rename_plan_for_item` tasks for the same item are reused.
- [x] 2.5 Ensure confirmed rename plans created while `autoOrganize` is disabled remain executable by explicit user action.

## 3. Scanner and Planner Flow

- [x] 3.1 Remove direct confirmed plan creation and `execute_rename_plan` enqueue from scanner.
- [x] 3.2 Update `scan_library_path` to enqueue `create_rename_plan_for_item` for newly identified items.
- [x] 3.3 Update `scan_library_path` to refresh `identified` items and enqueue `create_rename_plan_for_item`.
- [x] 3.4 Update `scan_library_path` to refresh `organized` items and enqueue `create_rename_plan_for_item` only when `nonCompliantFileCount > 0`.
- [x] 3.5 Update `scan_library_item` to support identified item scanning and the same plan creation enqueue rules as library path scanning.
- [x] 3.6 Add English task detail lines for recognition success, candidates set, no match, empty item skip, and plan task enqueue events.

## 4. Rename Execution Records Simplification

- [x] 4.1 Replace execution record writes with `rename_plan_items.status` updates plus English task detail lines.
- [x] 4.2 Include move success, move failure, target conflict, overwrite, FileClient stage, and intermediate path information in task detail line messages.
- [x] 4.3 Update interrupted rename summary to count persisted `rename_plan_items.status` instead of execution records.
- [x] 4.4 Update item detail services to stop reading execution records and rely on item stats, last summaries, and related tasks.
- [x] 4.5 Keep automatic affected scan enqueue behavior after rename task completion and report enqueue results in task summary.

## 5. API and UI Updates

- [x] 5.1 Update task detail API to return task status, progress, summary, and task detail lines, with no logs or execution records payload.
- [x] 5.2 Update task detail page to show one status card and one running record string list, and remove duplicated task information from the page header.
- [x] 5.3 Update item detail active task discovery/display to include active `create_rename_plan_for_item` tasks.
- [x] 5.4 Remove or replace global logs route/page that depended on the database logs table.
- [x] 5.5 Extend TMDB search result types and API mapping with `posterUrl` and `overview`.
- [x] 5.6 Update manual match and rename plan row search UI to show poster, title, year, and overview summary.
- [x] 5.7 Update rename plan edit and confirm layouts so filenames are primary, wrap naturally, and directory paths are displayed on separate secondary lines.

## 6. Tests and Verification

- [x] 6.1 Update server tests for scan task behavior, including identified and organized item enqueueing `create_rename_plan_for_item`.
- [x] 6.2 Add tests for `autoOrganize` controlling execution enqueue after plan creation rather than scan behavior.
- [x] 6.3 Update task observability tests to assert task detail lines and pino-safe task summaries instead of DB logs and execution records.
- [x] 6.4 Update rename execution tests to assert `rename_plan_items.status`, task detail lines, and task summaries.
- [x] 6.5 Update route boundary and UI type tests for new task detail payloads and TMDB result fields.
- [x] 6.6 Run `pnpm run lint`, `pnpm run check`, `pnpm test`, `pnpm build`, and `pnpm run build:worker`.
