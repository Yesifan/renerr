# Future Work

本文档记录当前代码中已经确认的无效边界、未完成能力和暂不可达能力。这里的事项不属于当前 V1 产品能力，不应被加入当前任务类型、数据库模型或现行流程描述，除非后续单独完成设计、实现和验证。

## 记录规则

- `planned`：已确认需要解决，但尚未进入实现。
- `blocked`：存在产品或架构决策未定，暂不能直接实现。
- `deferred`：当前 beta 范围明确延后。
- 归档 OpenSpec change 只记录历史方案，不代表这些能力仍然存在。

## 未完成能力

### 1. 全局日志页

- 状态：`blocked`
- 当前情况：当前只有 pino stdout 和按 task 持久化的 `task_detail_lines`，没有全局日志表、全局日志 API 或 `/system/logs` 页面。
- 影响：用户只能在任务详情中查看任务运行记录；不属于任务的诊断日志不能从 Web UI 查询。
- 后续工作：决定是否新增独立应用事件持久化模型；如果不新增，则继续保持 stdout 仅供运维诊断，不恢复全局日志页。

### 2. Source 编辑

- 状态：`planned`
- 当前情况：`upsertSource(input, id)` 服务函数支持按 id 更新，但没有对应的 PUT API 和设置页编辑入口。
- 后续工作：增加凭据保留、URL/用户名修改、连接测试和错误展示的完整编辑流程。

### 3. Source 和 Library Path 删除

- 状态：`blocked`
- 当前情况：当前没有删除 API 或 UI。
- 影响：配置对象只能累积，无法在 Web UI 清理失效配置。
- 后续工作：明确删除时的级联行为、运行中任务处理、关联 item/plan/task 的保留策略后再实现。

### 4. 顶部全局搜索

- 状态：`deferred`
- 当前情况：`src/lib/components/AppShell.svelte` 中保留了搜索输入外观，但没有搜索状态、API、结果或跳转行为。
- 后续工作：先确定搜索范围（library、item、TMDB 或任务），再实现窄职责 API 和结果交互；在实现前不要把该输入当作可用功能。

### 5. 命名模板设置 UI

- 状态：`planned`
- 当前情况：schema、settings service 和 naming service 已支持电影/电视剧命名模板，但设置页只暴露 `namingLanguage` 和 `metadataEnabled`。
- 后续工作：设计模板编辑、占位符说明、非法模板校验、保存预览和已有计划 template snapshot 的交互。

### 6. Metadata 覆盖和日志保留设置 UI

- 状态：`planned`
- 当前情况：`overwriteMetadata` 和 `logRetentionDays` 存在于 settings schema，但没有设置页控件。
- 后续工作：决定是否作为 V1 设置公开，并补齐 UI、Paraglide 文案和运行时验证。

### 7. Task detail line 清理调度

- 状态：`planned`
- 当前情况：`cleanupTaskDetailLines()` 已实现，但生产 worker 启动和任务循环没有调用；`getTaskDetail()` 当前固定返回 `detailsCleaned: false`。
- 影响：`logRetentionDays` 当前不能按预期自动生效。
- 后续工作：选择 worker 启动清理、定时清理或独立维护任务，并在任务详情中准确表达清理结果。

### 8. 实时 Item Detail API

- 状态：`deferred`
- 当前情况：`getItemDetail()` 和 `GET /api/library-items/[id]` 能读取实时 WebDAV 文件，但当前 item detail 页面不调用它。
- 当前边界：V1 item detail 只展示数据库摘要；创建 rename plan draft 时才读取实时视频文件。
- 后续工作：如果未来需要文件诊断视图，再单独设计懒加载文件列表、权限、分页和移动端展示；在此之前不要扩大 item detail 的默认数据边界。

### 9. `lastExecutionSummary` item 摘要

- 状态：`blocked`
- 当前情况：`library_items.last_execution_summary_json` 和 DTO 字段存在，但当前生产代码没有写入逻辑；执行结果实际保存在 task summary、task detail lines 和 rename plan item status 中。
- 后续工作：决定删除该字段，或定义按 item 聚合最近执行任务的写入与展示规则。未决前不要依赖该字段作为执行事实来源。

### 10. 独立整理目标目录的扫描归属

- 状态：`blocked`
- 当前情况：planner 可以把文件整理到同一 WebDAV source 下、Library Path 外的 `organizeTargetPath`；executor 结束后只 enqueue 配置 Library Path 的 `scan_library_path`。
- 当前边界：整理目标目录是输出路径，不是第二个扫描范围；执行摘要会记录 source/target 目录，但不会为每个目录创建扫描任务。
- 后续工作：如果目标目录也需要纳入媒体库管理，需设计新的 Library Path 归属或目录级扫描任务；不能仅通过扩展现有 path scan 文案解决。

## 明确不属于当前实现的历史能力

以下名称可能出现在归档 change 或旧文档中，但当前不应视为可用能力：

- `cleanup_invalid_dirs` task
- `execution_records` 表
- `logs` 表或独立全局日志页
- item `failed` 状态
- 执行器直接更新 `library_items` 状态和统计
- 扫描任务直接创建 confirmed rename plan
- executor 内部的长时间远端可见性 reconcile 状态机
