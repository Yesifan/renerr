## MODIFIED Requirements

### Requirement: 任务目标去重

系统 SHALL 对同一任务类型和同一业务目标的 queued/running 任务进行后端去重。For one-shot rename plan execution, the system SHALL also prevent executing a terminal rename plan again.

#### Scenario: 重复扫描同一 library path

- **WHEN** 用户请求扫描一个已有 queued 或 running `scan_library_path` 任务的 library path
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 重复扫描同一 library item

- **WHEN** 用户请求扫描一个已有 queued 或 running `scan_library_item` 任务的 library item
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 重复执行同一 rename plan

- **WHEN** 用户请求执行一个已有 queued 或 running `execute_rename_plan` 任务的 rename plan
- **THEN** 系统 MUST 返回已有任务
- **AND** 系统 MUST NOT 创建新的重复任务

#### Scenario: 执行已终止 rename plan

- **WHEN** 用户请求执行一个已经 succeeded、partially_failed 或 failed 的 rename plan
- **THEN** 系统 MUST reject the request with a stable error code
- **AND** 系统 MUST tell the UI to rescan and create a new plan instead

### Requirement: 任务进度模型

系统 SHALL 为 queued/running 任务提供可被 UI 消费的当前进度，而不是把进度 tick 写成历史日志。

#### Scenario: 任务正在运行

- **WHEN** 任务处于 running 状态并完成一个可观测阶段
- **THEN** 系统 MUST 更新该任务的 progress
- **AND** progress MUST 包含当前 phase、简短 message 和可用的 current/total 计数

#### Scenario: 任务完成

- **WHEN** 任务结束为 succeeded、partially_failed 或 failed
- **THEN** 系统 MUST 写入任务完成摘要
- **AND** 摘要 MUST 保留足够信息展示成功、失败、跳过和 warning 的计数

#### Scenario: 整理任务完成后扫描排队

- **WHEN** an `execute_rename_plan` task finishes
- **THEN** result summary MUST include automatic scan enqueue results for affected source and target directories
- **AND** summary MUST distinguish MOVE row results from later scan synchronization state

#### Scenario: 整理任务被 worker 重启中断

- **WHEN** worker startup finds a running `execute_rename_plan` task
- **THEN** 系统 MUST finish that task as failed
- **AND** result summary MUST include counts for succeeded, failed, and pending plan items already stored in the database
- **AND** error or summary MUST explain that the user should scan affected directories before creating another plan

### Requirement: 任务详情

系统 SHALL 提供任务详情能力，用于查看单个任务的状态、进度、摘要、关联日志和结构化执行记录。

#### Scenario: 查看扫描任务详情

- **WHEN** 用户打开扫描任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要和扫描/识别日志
- **AND** 系统 MUST NOT 在扫描任务详情中混入文件移动详情

#### Scenario: 查看整理任务详情

- **WHEN** 用户打开整理任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要、整理日志和关联 execution records
- **AND** 系统 MUST NOT 在整理任务详情中混入扫描识别详情

#### Scenario: 查看部分失败的整理任务详情

- **WHEN** 用户打开 partially_failed or failed rename task detail
- **THEN** UI MUST show row-level succeeded, failed, skipped, and warning counts
- **AND** UI MUST show failed row reasons when execution records are available
- **AND** UI MUST show FileClient failure stage and intermediate path when they are available
- **AND** UI MUST show automatic scan targets and enqueue status when present

#### Scenario: 查看中断的整理任务详情

- **WHEN** 用户打开 failed rename task detail
- **AND** the task summary indicates worker interruption
- **THEN** UI MUST clearly indicate that remote files may have changed before the interruption
- **AND** UI MUST guide the user to scan affected directories instead of rerunning the same plan

## ADDED Requirements

### Requirement: Execution records 保留 row 级 MOVE 结果

系统 SHALL write execution records or equivalent persisted row context for each attempted rename plan item, based on the MOVE request result.

#### Scenario: Row MOVE 成功

- **WHEN** worker receives a successful MOVE result for a rename plan item
- **THEN** system MUST persist an execution record or equivalent row context showing the row succeeded or was submitted
- **AND** the persisted context MUST include source path, target path, phase if applicable, attempt, and MOVE return information when available
- **AND** the persisted context SHOULD include FileClient move steps when provided by the adapter

#### Scenario: Row MOVE 失败

- **WHEN** worker receives a failed MOVE result for a rename plan item
- **THEN** system MUST persist an execution record or equivalent row context showing the row failed
- **AND** the persisted context MUST include source path, target path, phase if applicable, attempt, and error information
- **AND** the persisted context MUST include FileClient failure stage and intermediate path when provided by the adapter

#### Scenario: Worker 中断前已有 row 结果

- **WHEN** worker restarts after some rows already wrote execution records
- **THEN** task detail MUST still show those execution records
- **AND** the failed task summary MUST count those rows according to their stored statuses
