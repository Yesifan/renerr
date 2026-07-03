## Why

当前媒体库扫描、整理计划和任务展示之间存在数据一致性断点：空目录仍作为有效 item 展示，no-op 重命名会进入计划，整理完成后统计依赖执行摘要而不是真实远端文件状态。用户在处理 WebDAV/AList/夸克目录时会看到错误的视频统计、不可操作的计划行、缺少进度反馈，以及首次整理因远端一致性延迟而部分失败。

## What Changes

- 空目录默认从媒体库列表中隐藏，不作为常规待整理内容展示。
- item detail 增加显式开关，让用户主动查看当前 item 的空目录/空内容状态和相关上下文。
- source path 与 target path 完全一致的计划行视为 no-op，默认不进入可执行计划；用户修改影视信息或季集后导致 target 变化时再恢复为可选行。
- 手动取消勾选计划行后，整理完成统计不再由 selected rows 推导；执行后对受影响 item 重新扫描真实远端文件以刷新视频数、符合数和待整理数。
- 整理执行增强 WebDAV/AList 兼容性：将 MOVE 返回值视为提交结果而非最终事实，通过 original source、renamed source、final target 远端状态对账，优先使用“先原地改名、再跨目录移动最终文件名”的阶段化策略处理 AList/夸克一致性延迟。
- 媒体库详情和 item detail 提供更明显的扫描/整理进度提示，例如“正在扫描 3/12”或“正在整理 2/12”。
- 未识别 item 的海报占位展示文件/文件夹名称，并使用更清晰的背景、图标和状态视觉。
- TMDB 搜索提供 loading、空结果和错误反馈。
- rename plan 最终确认增加影视信息摘要 card，方便提交前确认目标媒体身份。
- 任务日志和执行记录中的长路径、摘要和结构化 context 支持完整查看，避免只显示截断文本。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `scan-and-organize`: 调整空目录处理、no-op rename 语义、执行后 item 统计刷新和 WebDAV 重试要求。
- `manual-review-plans`: 调整手动 plan draft 对 no-op rows、最终确认影视信息和 TMDB 搜索 loading 的交互要求。
- `task-observability`: 调整任务详情和日志长内容展示、active progress 关联和整理任务摘要要求。
- `ui-shell-and-theme`: 调整媒体库海报墙、item detail 进度提示、空目录主动显示开关和未识别占位海报要求。

## Impact

- 后端服务：`src/lib/server/services/scanner.ts`、`planner.ts`、`executor.ts`、`tasks.ts`、WebDAV client adapter。
- 前端页面和组件：`src/routes/libraries/[id]/+page.svelte`、`src/routes/libraries/[id]/[item_id]/+page.svelte`、`LibraryItemCard.svelte`、`ItemDetailPanel.svelte`、`ManualMatchPanel.svelte`、`RenamePlanPanel.svelte`、任务详情和日志页面。
- 数据/API：可能需要扩展 item detail DTO、active task 查询或 rename plan/task 关联字段；不要求正式版向后兼容，仍按 beta 策略处理本地 SQLite。
- 测试：需要覆盖扫描空目录、no-op plan、取消勾选后执行统计、WebDAV move 对账/重试/长期不可判定状态、任务进度和 UI 状态。
