## Why

当前扫描和整理任务缺少可被用户理解的运行状态、进度和任务内事件记录，用户在主页、任务页或日志页都难以判断任务是否正在执行、执行到哪里、哪些对象成功或失败。任务入口也缺少后端级去重，用户可以重复创建同一目标的扫描或整理任务，进一步放大状态混乱和日志排障成本。

## What Changes

- 为后台任务增加面向 UI 的观测能力：目标对象、运行进度、完成摘要和任务详情事件。
- 对同一业务目标的 queued/running 任务做后端去重，避免重复扫描同一个 library path、library item 或重复执行同一个 rename plan。
- 扫描任务记录扫描和识别事件，例如识别成功、识别失败、跳过 item 和任务完成摘要。
- 整理任务记录文件移动、sidecar、metadata 和执行完成事件；扫描任务不混入移动详情。
- 任务详情页内嵌该任务相关日志和结构化执行记录；全局日志页保留为全局事件流。
- 控制日志和执行记录的存储增长：只记录业务可解释事件，保留任务摘要，并按保留策略清理旧日志/记录。
- UI 直接展示后端日志 message 和 summary/context，不做前端日志文案翻译。

## Capabilities

### New Capabilities

- `task-observability`: 定义任务进度、任务事件日志、任务详情、全局日志流、任务去重和日志/记录保留策略。

### Modified Capabilities

- `scan-and-organize`: 扫描与整理执行需要写入任务进度、任务事件和完成摘要，并遵守同目标任务去重。
- `ui-shell-and-theme`: 任务详情和全局日志的信息架构需要支持任务内嵌日志、进度展示和入口状态反馈。

## Impact

- 数据库 schema：`tasks` 需要支持 target key、结果摘要等任务观测字段；`logs` 需要支持 task 关联；必要时补充索引以支撑任务详情和清理查询。
- 服务层：`tasks`、`logs`、`scanner`、`executor`、`planner` 需要写入进度、业务事件和摘要，并实现同目标 queued/running 去重。
- API：任务列表、任务详情、日志列表和相关 scan/submit 接口需要返回任务状态、进度、事件和已有任务信息。
- UI：主页、library detail、item detail、系统任务页和日志页需要展示 active task 状态、任务详情、进度和事件流。
- 测试：需要覆盖任务去重、扫描/整理事件、进度摘要、日志清理策略和 UI 所需 DTO。
