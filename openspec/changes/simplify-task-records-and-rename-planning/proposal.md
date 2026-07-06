## Why

当前扫描、整理计划创建、执行和任务详情记录的职责混在一起：扫描会直接创建并执行整理计划，任务详情同时展示任务摘要、日志和 execution records，导致行为不清晰、实现复杂且信息重复。需要将后台任务拆成更小的业务步骤，并把任务运行详情简化为用户可读的字符串列表，同时使用 pino 统一前端、SvelteKit server、worker 和脚本日志。

## What Changes

- 将扫描职责收敛为远端同步、统计刷新和影视识别；扫描不再直接创建 confirmed rename plan，也不直接 enqueue `execute_rename_plan`。
- 新增 `create_rename_plan_for_item` 后台任务，扫描对每个已识别或已整理且仍有待整理文件的 item enqueue 该任务。
- 调整 `autoOrganize` 语义：它只控制 `create_rename_plan_for_item` 创建出可执行 plan 后是否自动 enqueue `execute_rename_plan`。
- **BREAKING** 移除数据库 `logs` 表作为产品功能，不再提供全局日志页依赖的数据库日志流。
- **BREAKING** 移除结构化 `execution_records` 作为任务详情数据源，任务详情改为展示 `task_detail_lines` 中的英文原文 string list。
- 引入 pino 作为统一日志库；Node 侧生产日志输出 JSON 到 stdout，由 Docker logging driver 或宿主进程负责轮转。
- 前端开发环境使用 pino browser，生产环境不做 warn/error transmit endpoint。
- 任务运行记录通过专门 task recorder 同时写入 `task_detail_lines` 和 pino。
- 任务详情页只保留状态 card 和运行记录列表；顶部不重复展示任务信息。
- TMDB 搜索结果返回并展示海报、简介等信息；服务器生成英文任务运行记录，客户端原样显示，不做 i18n 翻译。
- Rename plan 编辑和确认视图优化长文件名展示：文件名单独显示并允许换行，路径在文件名下方单独一行显示。

## Capabilities

### New Capabilities

### Modified Capabilities

- `scan-and-organize`: 扫描、整理计划创建和自动执行的任务边界与状态流转规则发生变化。
- `task-observability`: 任务详情、日志存储、运行记录和服务器日志机制发生变化。
- `manual-review-plans`: TMDB 搜索结果展示和 rename plan 长文件名布局规则发生变化。

## Impact

- Affected backend services: `src/lib/server/services/scanner.ts`, `planner.ts`, `executor.ts`, `tasks.ts`, logging/task detail services, worker dispatch.
- Affected database schema: remove `logs` and `execution_records`; add `task_detail_lines`; add task type support for `create_rename_plan_for_item`.
- Affected routes/UI: task detail/list pages, item detail active task display, manual match panel, rename plan panel, TMDB search API response shape.
- New dependencies: `pino` and `pino-pretty` for deterministic English logging across frontend, server, worker, and scripts.
- Tests: update V1 core flow, task observability, route boundary, and UI type expectations for the new task and run record model.
