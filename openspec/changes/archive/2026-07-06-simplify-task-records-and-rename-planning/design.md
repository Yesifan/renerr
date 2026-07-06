## Context

Renarr 当前的后台任务链路把多个职责混在一起：`scan_library_path` 在识别成功时直接创建 confirmed rename plan 并 enqueue 执行任务；任务详情同时读取 `tasks.resultSummaryJson`、数据库 `logs` 和 `execution_records`。这让扫描、计划创建、执行、运行记录和服务器日志互相耦合，也让 UI 出现重复信息。

本次变更发生在 beta 阶段，可以直接调整 SQLite schema，不需要兼容旧开发库。后端和任务运行记录使用英文原文；客户端原样展示，不做 i18n 翻译。

## Goals / Non-Goals

**Goals:**

- 将扫描、单 item 计划创建、计划执行拆成独立后台任务。
- 让扫描对所有 eligible item enqueue `create_rename_plan_for_item`，但扫描本身不创建 confirmed plan。
- 将 `autoOrganize` 收敛为计划创建后的自动执行开关。
- 用极简 `task_detail_lines` 表承载前端任务运行记录，每行只存 `level`、`message` 和时间。
- 前端、SvelteKit server、worker 和脚本统一通过 pino logger facade 记录日志，应用代码不直接调用 `console.*`。
- Node 侧 pino 统一输出 stdout；生产日志轮转交给 Docker logging driver，不在应用内实现文件轮转。
- 通过专门的 task recorder 让用户可见运行记录同时写入 DB 和 pino。
- 删除数据库 logs 和 execution records 的产品依赖。
- 优化任务详情页、TMDB 搜索结果和 rename plan 长文件名展示。

**Non-Goals:**

- 不引入从 stdout/container logs 反查前端任务详情的机制。
- 不保留结构化 row-level execution record API。
- 不为任务运行记录做前端翻译或 message code 映射。
- 不新增批量 `create_rename_plans_for_library` 任务。
- 不改变 WebDAV/AList FileClient 的移动语义，只改变记录方式。
- 不做浏览器生产日志上报 endpoint；client pino 不 transmit warn/error 到 server。

## Decisions

### 1. Use `create_rename_plan_for_item` instead of library-wide plan creation

扫描期间每个 item 的状态、文件统计和识别结果都已经逐个可见。为每个 eligible item enqueue 单独任务，可以复用现有 active task 去重模型，并让失败范围限定在单个 item。

Eligible item 规则：

- `identified`
- `organized` 且 `nonCompliantFileCount > 0`
- `unidentified` 在扫描中成功识别后成为 `identified`

`pending_review` 只刷新统计，不创建计划任务。

Alternative considered: `create_rename_plans_for_library`。它能集中处理一个库，但会重新扫描/查询 eligible items，任务粒度更粗，失败恢复和前端关联也更复杂。

### 2. `autoOrganize` controls execution, not plan creation

Plan creation is useful even when automatic execution is disabled because the user can inspect and execute the created plan later. Therefore `create_rename_plan_for_item` always attempts to create a confirmed plan when rows are executable. If `library.autoOrganize` is true, it also enqueues `execute_rename_plan`; otherwise it records that execution is waiting for user action.

This keeps scanning behavior predictable and avoids hidden differences where disabled auto-organize prevents users from seeing a plan.

### 3. Replace DB logs and execution records with `task_detail_lines`

Task detail only needs a user-readable string list:

- `Show A was identified as Show A`
- `Show B candidates were set to Result A, Result B`
- `file.mkv was renamed to target.mkv successfully`
- `file.mkv failed to move to target.mkv: Target file exists`

The table shape stays intentionally small:

- `id`
- `taskId`
- `level`: `info | warn | error`
- `message`
- `createdAt`

Task progress remains in `tasks.progressJson`; task completion summary remains in `tasks.resultSummaryJson`. `task_detail_lines` is not a progress tick table and should only store meaningful user-visible events.

Alternative considered: parse pino stdout/container logs for frontend task detail. This was rejected because log driver behavior, formatting changes, pagination and historical compatibility would make the frontend depend on log output as an implicit API.

### 4. Use pino everywhere through environment-specific logger facades

Introduce environment-specific logger modules instead of a universal logger singleton:

- `$lib/server/logger`: SvelteKit server routes/load/actions/hooks and server services.
- `$lib/server/logger-worker`: worker entry and worker-only task execution code, reusing the Node logger factory.
- `$lib/client/logger`: browser components, client helpers, and `hooks.client`.
- `scripts/logger`: CLI/probe scripts.

SvelteKit server-only logging code MUST stay in `$lib/server` or `.server` modules so private configuration and Node-only dependencies cannot be imported into browser bundles. Client code MUST import only the client logger.

Node logger configuration is deterministic:

- runtime bindings: `web`, `worker`, or `script`
- component bindings via `logger.child({ component })`
- task bindings via child loggers or recorder context
- level from `RENARR_LOG_LEVEL`, then `LOG_LEVEL`, then `debug` in development and `info` otherwise
- fixed redaction paths for credentials, API keys, auth headers, cookies, tokens, and nested variants
- standard error serialization using pino error serializers
- production output as JSON to stdout
- development output as pino-pretty to stdout
- no application-managed file destination or file rotation

Docker or the host process manager is responsible for stdout capture and rotation. This keeps production logging compatible with container best practices and avoids application-level log file lifecycle code.

Browser logger configuration is also deterministic:

- development: pino browser enabled at `debug`, using browser console through pino
- production: pino browser disabled
- no `browser.transmit` endpoint in this change

Application code MUST NOT call `console.*` directly. Pino browser may internally use browser console in development; that is treated as pino output, not application console usage.

Alternative considered: application-managed log files with daily rotation. This was rejected because the target runtime should use stdout and Docker logging driver rotation.

Alternative considered: browser `warn`/`error` transmit to a server endpoint. This was rejected for this change to avoid adding a client log ingestion API, payload limiting, and abuse controls.

### 5. Use a dedicated task recorder for DB-backed task lines

For task user-visible events, use a dedicated recorder such as:

```ts
const recorder = createTaskRecorder(taskId, {
	taskType,
	targetKey,
	component
});

await recorder.info(message, context);
await recorder.warn(message, context);
await recorder.error(message, context);
```

The recorder inserts into `task_detail_lines` and writes a pino log with the same message plus structured context. Non-user-visible diagnostics write directly to pino and MUST NOT write task detail lines.

Only the task recorder may write `task_detail_lines`. Generic logger code and business services MUST NOT insert task lines directly.

Pino logs and task detail messages are English. Task detail messages are displayed verbatim by the client.

### 6. Rename execution records become task lines

`rename_plan_items.status` remains the durable row state needed for execution and interruption summaries. Detailed row output that users see becomes task lines. FileClient stage/intermediate recovery information should be embedded in the English message when it matters, for example:

`Episode 01 failed to move to /target/Episode 01.mkv at move_to_target; intermediate path: /source/Episode 01.mkv`

This avoids maintaining a second structured record table while still giving recovery clues.

### 7. Task detail UI has one information hierarchy

Task detail page should show:

- one status card from `tasks`
- one running record list from `task_detail_lines`

The top page header should not repeat task type, target, progress or result data already shown in the status card.

### 8. TMDB search DTO carries display data

Extend TMDB search results with `posterUrl` and `overview` in addition to existing id/title/year/poster fields. Manual match and rename plan row search should render poster, title, original title, year and overview. The selected identity persistence can continue storing `posterPath`; `posterUrl` is display-only.

### 9. Rename plan path layout separates filename from directory

For long paths, show basename as primary text with wrapping enabled, then show directory path as secondary monospace text. Apply this to source and target in edit and confirm steps. This keeps table/card width stable and makes long filenames readable.

## Risks / Trade-offs

- **Risk: Losing structured execution record queries.** Mitigation: keep `rename_plan_items.status` and task summaries for machine-readable status; only remove structured UI detail records.
- **Risk: Task lines can grow for large plans.** Mitigation: store one meaningful line per item/important event, not every progress tick; prune task lines with task retention policy if needed.
- **Risk: Existing tests assert logs/execution records.** Mitigation: update tests to assert task detail lines, task summaries and pino-safe behavior instead.
- **Risk: Created plans without auto execution need discoverability.** Mitigation: task summary and item detail active/related task display should expose created plan id and waiting-for-user status.
- **Risk: Removing global DB logs removes in-app system log history.** Mitigation: diagnostics move to pino stdout/container logs; user-facing task history remains in tasks and task lines.
- **Risk: Browser production logs are unavailable without transmit.** Mitigation: keep client production logging disabled by design; server/worker diagnostics and task detail lines cover V1 operational needs.

## Migration Plan

1. Update Drizzle schema: remove `logs` and `execution_records`; add `task_detail_lines`; add indexes by `taskId` and `createdAt`.
2. Add pino and pino-pretty dependencies and environment-specific logger modules.
3. Replace all application `console.*` and DB `log()` usage with pino logger or task recorder depending on whether the event is user-visible.
4. Add `create_rename_plan_for_item` task type and worker dispatch.
5. Move plan creation out of scanner into the new task.
6. Update task detail API and UI to return/display task lines.
7. Update manual match, TMDB search DTOs and rename plan path layout.
8. Since this is beta, local development databases can be rebuilt with `db:push`.

## Open Questions

- Should non-auto created confirmed plans appear in a dedicated UI list, or is the item detail/task summary entry enough for V1?
