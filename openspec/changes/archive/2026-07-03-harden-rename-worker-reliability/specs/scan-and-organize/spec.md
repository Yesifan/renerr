## MODIFIED Requirements

### Requirement: Rename 执行基于 plan

系统 SHALL 通过 `execute_rename_plan` task 执行所有自动和手动整理。Confirmed rename plan SHALL be a single-use execution token; once execution is queued or started, the same plan MUST NOT be executed by another task and MUST become terminal when that task finishes.

#### Scenario: 自动 plan 创建

- **WHEN** 扫描发现符合条件的 high-confidence item 且自动整理开启
- **THEN** 系统 MUST 创建 mode 为 `auto` 的 confirmed `rename_plan` 并 enqueue `execute_rename_plan`

#### Scenario: 手动 plan 提交

- **WHEN** 用户提交已批准的手动 plan
- **THEN** 系统 MUST 创建 mode 为 `manual` 的 confirmed `rename_plan` 并 enqueue `execute_rename_plan`

#### Scenario: Plan 执行开始后不可重复执行

- **WHEN** a rename plan already has an `execute_rename_plan` task that is queued, running, succeeded, partially_failed, or failed
- **THEN** 系统 MUST NOT create another execution task for that same plan
- **AND** UI/API MUST require the user to rescan and create a new plan if more work is needed

#### Scenario: Plan 执行结束

- **WHEN** the `execute_rename_plan` task finishes as succeeded, partially_failed, or failed
- **THEN** the rename plan MUST be marked terminal
- **AND** the terminal plan MUST NOT be submitted or executed again

### Requirement: Worker 移动文件前进行校验

worker SHALL 在每个文件 MOVE 前重新校验 source 和 target 状态。Executor SHALL process selected plan items row-by-row, calling FileClient `moveFile(source, target)` once per row. After submitting a MOVE, worker SHALL treat the FileClient move result as the row execution result and MUST NOT perform long visibility polling to prove remote final consistency.

WebDAV source URL SHALL 以用户配置为准，系统 MUST NOT 自动把 URL 改写为更高层级的服务端根路径。

当 source 和 target 同时跨目录且文件名不同，WebDAV/AList FileClient adapter MUST 将一个业务移动封装为先在 source 目录原地改成目标文件名、再移动到目标目录。Executor MUST NOT implement this two-step WebDAV strategy itself.

#### Scenario: Source 已消失

- **WHEN** plan item 的 source file 在执行时已不存在
- **THEN** worker MUST 将该 plan item 标记为 failed，并继续处理剩余 items
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 恢复跨目录改名中间态

- **WHEN** plan item 的原 source file 已不存在，但目标目录内存在同 basename 的中间文件
- **THEN** worker MUST 从该中间文件继续执行目标重命名
- **AND** execution record MUST 记录恢复中间态的 warning

#### Scenario: MOVE 返回成功

- **WHEN** worker submits a MOVE for a plan item
- **AND** the FileClient `moveFile(source, target)` call returns success
- **THEN** worker MUST mark that plan item as succeeded or submitted
- **AND** worker MUST write an execution record for that row before finishing the task
- **AND** execution record context SHOULD include FileClient move steps when provided
- **AND** worker MUST NOT wait for `exists(target)` or directory listing to prove target visibility

#### Scenario: MOVE 返回失败

- **WHEN** worker submits a MOVE for a plan item
- **AND** the FileClient `moveFile(source, target)` call returns an error or throws
- **THEN** worker MUST mark that plan item as failed with the MOVE error
- **AND** worker MUST write an execution record for that row
- **AND** execution record context MUST include the FileClient failure stage when provided
- **AND** worker MUST continue processing remaining selected plan items
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: WebDAV 跨目录改名由 adapter 封装

- **WHEN** executor requests FileClient to move `/a/01.mp4` to `/target/a.s01e01.mp4`
- **AND** the WebDAV/AList backend does not reliably support cross-directory move and rename in one operation
- **THEN** WebDAV/AList FileClient MUST first move `/a/01.mp4` to `/a/a.s01e01.mp4`
- **AND** WebDAV/AList FileClient MUST then move `/a/a.s01e01.mp4` to `/target/a.s01e01.mp4`
- **AND** executor MUST still treat this as a single row-level `moveFile(source, target)` operation

#### Scenario: WebDAV 原地 rename 失败

- **WHEN** WebDAV/AList FileClient fails while moving source to the same-directory target basename
- **THEN** FileClient MUST throw or return a structured move error with stage `rename_in_place`
- **AND** the error MUST include original source path, attempted rename path, and final target path when available

#### Scenario: WebDAV 最终 move 失败

- **WHEN** WebDAV/AList FileClient succeeds at same-directory rename
- **AND** fails while moving the intermediate path to the final target directory
- **THEN** FileClient MUST throw or return a structured move error with stage `move_to_target`
- **AND** the error MUST include original source path, intermediate path, and final target path when available

#### Scenario: Target 文件存在且未 overwrite

- **WHEN** target file 已存在且 plan item 不允许 overwrite
- **THEN** worker MUST 将该 plan item 标记为 conflict 或 failed，并且 MUST NOT 覆盖目标文件
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 手动 overwrite

- **WHEN** 手动批准的 plan item 允许 overwrite
- **THEN** worker MUST 对该 target file 使用 overwrite 行为，并在 execution records 中记录 overwritten target path

### Requirement: 部分执行失败时继续处理

worker SHALL 在单个 plan item 失败后继续执行剩余 plan items。Worker SHALL persist each row MOVE result during execution and SHALL summarize mixed success/failure at task completion.

#### Scenario: 成功和失败混合

- **WHEN** 至少一个 plan item 成功且至少一个 plan item 失败
- **THEN** task MUST 以 `partially_failed` 结束，或以 `failed` 携带部分成功 summary 结束
- **AND** execution records MUST 标识每个 attempted item 的结果
- **AND** 系统 MUST NOT 因失败 plan item 将 library item status 改为 `failed`

#### Scenario: 所有 MOVE 都失败

- **WHEN** selected plan items were attempted
- **AND** every attempted MOVE failed
- **THEN** task MUST 以 `failed` 结束
- **AND** task summary MUST include failed count and failure details

#### Scenario: Row 成功后持久化

- **WHEN** worker receives a successful MOVE result for a plan item
- **THEN** worker MUST update that `rename_plan_item` status to succeeded or submitted
- **AND** worker MUST write a succeeded execution record before task finalization

#### Scenario: Row 失败后持久化

- **WHEN** worker receives a failed MOVE result for a plan item
- **THEN** worker MUST update that `rename_plan_item` status to failed
- **AND** worker MUST write a failed execution record before task finalization
- **AND** worker MUST continue unrelated later plan items

### Requirement: 执行结果更新 item 摘要

系统 SHALL NOT use rename executor results as the source of truth for `library_items` identity status or file statistics. Executor SHALL record task, plan item, log, and execution record results; scanner SHALL update `library_items` according to the remote files and directories visible during scan.

#### Scenario: 所有 selected plan items 成功

- **WHEN** rename plan 对某个 library item 的 selected rows 全部 MOVE 返回成功
- **THEN** 系统 MUST record the task and execution records as successful
- **AND** executor MUST NOT directly mark the item as `organized`
- **AND** executor MUST NOT directly update video、compliant、non-compliant 统计

#### Scenario: 部分或全部 plan items 失败

- **WHEN** rename plan 对某个 library item 的任意 selected row 执行失败
- **THEN** 系统 MUST 在 task、log 或 execution records 中保留失败原因
- **AND** 系统 MUST NOT 将该 item 标记为 `failed`
- **AND** executor MUST NOT directly change item identity status or statistics based on the failed task

#### Scenario: 整理后扫描同步远端事实

- **WHEN** a rename task finishes as succeeded, partially_failed, or failed
- **AND** a later scan reads the affected source or target directories
- **THEN** scanner MUST use the current remote directory state as source of truth
- **AND** scanner MUST update item identity inheritance and file statistics according to the files actually visible remotely

## ADDED Requirements

### Requirement: 整理结束后自动扫描受影响目录

系统 SHALL automatically enqueue scan tasks for affected directories after an `execute_rename_plan` task finishes, regardless of whether all rows succeeded or some rows failed.

#### Scenario: 自动扫描源和目标目录

- **WHEN** an `execute_rename_plan` task finishes
- **THEN** system MUST collect all source directories and target directories from selected plan items
- **AND** system MUST deduplicate the affected directories
- **AND** system MUST enqueue scan tasks that cover every affected source and target directory

#### Scenario: 扫描任务去重

- **WHEN** an affected directory already has a queued or running scan task for the same target
- **THEN** system MUST reuse or report the existing task
- **AND** system MUST NOT create unnecessary duplicate scan tasks

#### Scenario: 扫描 enqueue 结果写入摘要

- **WHEN** system enqueues automatic scans after rename execution
- **THEN** task summary MUST include scan targets and whether each target was created, reused, or failed to enqueue
- **AND** UI MUST be able to show that media library state will be corrected by scan rather than by rename execution itself
