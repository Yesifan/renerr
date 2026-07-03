## Why

WebDAV/AList/夸克的 MOVE 可见性无法被 worker 稳定证明：MOVE 可能返回成功但 source 和 target 在一段时间内都不可见，也可能返回失败但之后远端状态又发生变化。继续在整理执行器里做长时间对账和复杂恢复，既增加 AList 压力，也仍然无法保证真实成功；Renarr 应把扫描结果作为媒体库事实来源，让整理执行只负责提交请求和记录结果。

## What Changes

- 将 rename plan 明确定义为一次性执行凭证：同一个 plan 只能执行一次，执行结束后进入 terminal 状态，用户需要重新扫描远端事实后生成新 plan。
- 简化整理 worker：按 plan item 顺序逐行执行，每行调用一次 FileClient `moveFile(source, target)`，成功或失败都立即记录，然后继续下一行。
- 将 WebDAV/AList 的“先原地改名、再移动到目标目录”两步语义封装进 FileClient adapter；executor 不再分批执行 rename phase 和 move phase。
- FileClient MOVE 失败 MUST 提供结构化 stage 信息，让 executor 能区分 direct move、原地 rename、最终 move 哪一步失败。
- 移除整理执行路径中的长时间 `exists`/directory-listing settling 对账、`indeterminate` 结果和复杂远端最终一致性证明。
- 整理执行器不直接把 `library_items` 更新为 organized，也不直接刷新文件统计；媒体库 item 状态和统计只由扫描同步远端事实。
- 整理任务完成后自动 enqueue 针对受影响目录的扫描任务，扫描范围包含所有源目录和目标目录，并去重。
- 保留 WebDAV MOVE 可见性探针作为开发诊断工具，但探针结果不成为业务执行路径要求。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `scan-and-organize`: 调整 rename plan 一次性执行、逐项 MOVE 失败继续、整理后自动扫描受影响目录，以及 scanner 作为媒体库真实状态来源。
- `task-observability`: 调整整理任务摘要和 execution records，表达每个 row 的 MOVE 成功/失败以及整理后扫描 enqueue 结果。
- `connectivity-testing`: 保留 WebDAV MOVE 可见性探针作为诊断能力，不再要求业务 executor 使用探针式对账。

## Impact

- 后端服务：`src/lib/server/services/executor.ts`、`tasks.ts`、`scanner.ts`、`planner.ts`。
- WebDAV 集成：`src/lib/server/integrations/webdav-client.ts` 继续提供 MOVE/list/exists 能力；业务执行不依赖长轮询证明。
- 数据模型：可能需要调整 rename plan terminal 状态、row 状态和任务 summary 字段；beta 阶段允许通过 `db:push` 同步 schema，不要求旧开发库兼容。
- UI/API：任务详情展示逐项成功/失败、部分失败、整理后已排队扫描目录；不把整理成功直接等同于媒体库已扫描完成。
- 测试：覆盖单行 MOVE 失败后继续执行、自动扫描源/目标目录、terminal plan 不可重复执行、executor 不直接修改 item 摘要、scan 后以远端事实刷新媒体库。
