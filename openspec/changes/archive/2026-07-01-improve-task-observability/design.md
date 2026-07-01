## Context

Renarr 当前已有 `tasks.progress_json`、`updateTaskProgress()`、`execution_records` 和 `logs`，但这些能力没有形成完整的用户可见任务观测模型。扫描入口和整理入口直接创建任务，缺少同目标 queued/running 去重；扫描服务不接收 task id，无法把识别日志稳定关联到任务；任务页只展示 type/state/error，日志页只是全局列表，用户无法从任务详情判断哪些对象成功、哪些失败、当前任务执行到哪里。

本变更发生在 beta 阶段，可以直接调整 SQLite schema 并通过 `db:push` 同步本地库。日志和记录增长需要受控，避免把本地 SQLite 变成无限事件仓库。

## Goals / Non-Goals

**Goals:**

- 为任务建立稳定的观测模型：目标对象、进度、完成摘要、任务详情事件和关联记录。
- 禁止同一业务目标重复创建 queued/running 任务。
- 扫描任务记录扫描与识别事件；整理任务记录文件移动、sidecar、metadata 和执行事件，两者不混合。
- 任务详情内嵌该任务相关日志和结构化执行记录；全局日志页保留为全局事件流。
- UI 直接展示后端日志 message 和 summary/context，不做前端日志文案翻译。
- 通过保留期、最大行数、摘要持久化和 context 大小约束控制日志/记录存储增长。

**Non-Goals:**

- 不引入 WebSocket、SSE 或实时推送；V1 继续使用轮询。
- 不做复杂的前端日志本地化映射。
- 不记录低层 WebDAV/TMDB 请求级 trace。
- 不为扫描结果新增长期 `scan_records` 表；扫描事件先由 task logs 和 task summary 承载。
- 不提供任务取消、重试或并发 worker 调度改造。

## Decisions

### 1. 使用任务目标 key 做后端去重

任务创建路径增加 target key 概念，例如 `libraryPath:<id>`、`libraryItem:<id>`、`renamePlan:<id>`。创建任务时先查找同 `type + targetKey` 的 queued/running 任务，存在则返回已有任务，不再插入新行。

选择该方案是因为前端按钮禁用只能改善体验，不能阻止重复请求或多个页面同时触发。target key 也能支撑首页、library detail 和 item detail 查询相关 active task。

备选方案是只在各 API route 内手写重复检查，但会让扫描和整理入口规则分散，后续新增任务类型时容易漏掉。

### 2. 任务进度是当前状态，不是历史日志

`progressJson` 只保存当前阶段、计数、当前目标和简短 message，不为每个 tick 追加日志。扫描时在 root list 完成后知道 total，再按 item 更新 current；整理时按 selected plan row 更新 current/total 和成功失败计数。

这样大任务不会因为进度更新产生大量日志行。历史审计只记录业务事件，例如识别成功/失败、文件移动成功/失败和 warning。

### 3. 任务事件日志带 taskId，并保持后端原文展示

`logs` 增加可空 `taskId` 字段，并对 task id/time 建索引。worker 处理任务时把 task id 传入扫描和整理服务，业务日志必须携带 task id。UI 展示后端 `message` 和 `context.summary`，不把英文日志翻译成中文句子。

这保留了后端、worker、日志 message 使用英文原文的项目约定，同时避免前端维护一套脆弱的日志翻译字典。

### 4. 扫描任务和整理任务使用不同事件边界

扫描任务只写扫描和识别事件：

- `Library scan started`
- `Item recognized`
- `Item recognition failed`
- `Item skipped`
- `Library scan finished`

整理任务只写执行事件：

- `Rename plan started`
- `File move succeeded`
- `File move failed`
- `Sidecar move failed`
- `Metadata write failed`
- `Rename plan finished`

扫描任务不显示移动详情，整理任务不显示识别详情。自动整理由扫描任务 enqueue rename plan 后，移动详情出现在后续 `execute_rename_plan` 任务中。

### 5. 任务摘要长期保留，详细日志和记录可清理

任务完成时写入 compact `resultSummaryJson`，例如扫描总数、识别成功数、识别失败数、跳过数、移动成功数、移动失败数和 warning 数。即使详细 logs 或 execution records 被清理，任务列表和详情仍能展示最终摘要，并提示详细日志已按保留策略清理。

日志清理按 `logRetentionDays` 和最大行数双约束执行；queued/running 任务关联日志不得清理。`execution_records` 按任务/时间窗口保留旧明细，旧记录被清理后仍保留 task summary。

### 6. 保持现有 execution_records 作为整理结构化事实来源

整理任务继续写 `execution_records`，并补充对应 task logs 作为用户可读事件流。任务详情可以把 logs 和 execution records 同时展示：logs 解释发生了什么，execution records 提供结构化 source/target/status/error。

扫描任务暂不新增结构化记录表，避免在 V1 中引入过多存储面；若后续需要扫描历史报表，再单独设计 scan records。

## Risks / Trade-offs

- [Risk] 业务事件日志过细导致 SQLite 增长过快 → Mitigation: 只记录用户可解释事件，不记录底层请求 trace；增加保留期、最大行数和 context 大小限制。
- [Risk] 清理详细日志后用户无法排障旧任务 → Mitigation: 任务完成摘要长期保留，并在任务详情显示详细日志已清理。
- [Risk] target key 设计不一致导致去重失效 → Mitigation: 在 tasks 服务集中生成 target key，各 route 和 planner 不手写 key。
- [Risk] 扫描任务自动 enqueue rename plan 后用户误以为扫描任务应包含移动结果 → Mitigation: UI 和任务命名区分扫描任务与整理任务，自动整理产生独立整理任务。
- [Risk] 前端直接展示后端日志 message 可能不够友好 → Mitigation: 后端日志 message 和 `context.summary` 必须写成用户可读英文，不暴露内部堆栈或低层响应体。

## Migration Plan

1. beta 阶段更新 Drizzle schema 后使用 `db:push` 同步本地 SQLite。
2. 新增任务字段和日志 task 关联字段时，旧任务可缺少 target key、summary 或 task logs；UI 对空字段降级展示。
3. 已存在 logs 没有 task id，继续只在全局日志页展示，不出现在任务详情。
4. 清理策略只作用于 completed/failed 旧任务关联日志和旧 execution records，不清理 queued/running 所需数据。
