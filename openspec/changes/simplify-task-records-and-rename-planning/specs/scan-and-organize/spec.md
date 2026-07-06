## MODIFIED Requirements

### Requirement: Library path 扫描遵循 item 状态规则

系统 SHALL 让 `scan_library_path` 同步当前 root-level `library_items`，并按每个 item 的状态处理。扫描得到的空目录或无视频目录 MUST 更新为空内容状态，并且 MUST NOT 作为默认媒体库列表中的可整理 item 展示。扫描 SHALL 只负责远端同步、统计刷新和影视识别；扫描 MUST NOT 直接创建 confirmed rename plan，也 MUST NOT 直接 enqueue `execute_rename_plan`。

#### Scenario: 远端 item 消失

- **WHEN** 已存储的 `library_item` 在 library root 不再存在
- **THEN** 系统 MUST 硬删除该当前 `library_item` 记录

#### Scenario: 远端 item 是空目录或无视频目录

- **WHEN** library path 扫描发现 root-level directory 存在但内部没有可统计的视频文件
- **THEN** 系统 MUST 将该 item 的视频数量、符合数量和待整理数量刷新为 0
- **AND** 系统 MUST 让该 item 从默认媒体库列表中隐藏
- **AND** 系统 MUST NOT 为该 item 创建整理计划创建任务

#### Scenario: 未识别 item

- **WHEN** 扫描 `unidentified` item 且该 item 包含视频文件
- **THEN** 系统 MUST 尝试识别，并在 high-confidence 时转为 `identified`，在 fuzzy、ambiguous、no-match 或 parse-failed 时转为 `pending_review`

#### Scenario: 新识别 item 进入计划创建任务

- **WHEN** 扫描将 `unidentified` item 成功转为 `identified`
- **THEN** 系统 MUST enqueue `create_rename_plan_for_item` for that item
- **AND** 系统 MUST NOT 在扫描任务内创建 confirmed rename plan

#### Scenario: 识别失败没有候选

- **WHEN** 扫描 item 时无法解析标题或 TMDB 没有候选
- **THEN** 系统 MUST 将 item 标记为 `pending_review`
- **AND** recognition candidates MUST 保存为空数组
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`

#### Scenario: 待确认 item

- **WHEN** 扫描 `pending_review` item
- **THEN** 系统 MUST 跳过该 item 的 TMDB 识别和整理计划创建
- **AND** 系统 MAY 刷新该 item 的空内容和文件统计以避免展示过期数量

#### Scenario: 发现历史整理目标目录

- **WHEN** library path 扫描发现一个一级目录等于历史 rename plan item 的 `target_top_level_path`
- **AND** 该 plan item 对应的旧 `library_item` 已有 TMDB identity
- **THEN** 系统 MUST 将旧 identity 继承到新目录对应的 `library_item`
- **AND** 新目录对应的 `library_item` MUST 标记为 `organized`

#### Scenario: 已识别 item

- **WHEN** 扫描 `identified` item
- **THEN** 系统 MUST NOT 再查询 TMDB
- **AND** 系统 MUST 刷新该 item 的文件统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item` for that item

#### Scenario: 已整理 item 有待整理文件

- **WHEN** 扫描 `organized` folder item
- **AND** 刷新后的 `nonCompliantFileCount` 大于 0
- **THEN** 系统 MUST 跳过 TMDB 识别
- **AND** 系统 MUST enqueue `create_rename_plan_for_item` for that item

#### Scenario: 已整理 item 无待整理文件

- **WHEN** 扫描 `organized` folder item
- **AND** 刷新后的 `nonCompliantFileCount` 等于 0
- **THEN** 系统 MUST 跳过 TMDB 识别
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`

### Requirement: Item 扫描是显式且受状态限制的

系统 SHALL 提供 `scan_library_item`，用于手动扫描单个符合条件的 `library_item`。Item 扫描 SHALL 只负责刷新统计和必要的影视识别；当扫描后 item 符合整理条件时，系统 MUST enqueue `create_rename_plan_for_item`，而不是直接创建 confirmed plan 或直接执行整理。

#### Scenario: 扫描已整理 item 有待整理文件

- **WHEN** 用户手动扫描 `organized` item
- **AND** 刷新后的 `nonCompliantFileCount` 大于 0
- **THEN** 系统 MUST 刷新其内部视频数量和模板符合度统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB

#### Scenario: 扫描已整理 item 无待整理文件

- **WHEN** 用户手动扫描 `organized` item
- **AND** 刷新后的 `nonCompliantFileCount` 等于 0
- **THEN** 系统 MUST 刷新其内部视频数量和模板符合度统计
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB

#### Scenario: 扫描未识别 item

- **WHEN** 用户手动扫描 `unidentified` item
- **THEN** 系统 MUST 使用与 library path 扫描相同的规则尝试识别
- **AND** 如果 item 成功转为 `identified`，系统 MUST enqueue `create_rename_plan_for_item`

#### Scenario: 扫描已识别 item

- **WHEN** 用户手动扫描 `identified` item
- **THEN** 系统 MUST 刷新该 item 的文件统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB

#### Scenario: 扫描不符合条件的 item

- **WHEN** 用户尝试扫描 `pending_review` item
- **THEN** 系统 MUST 使用稳定 error code 拒绝请求

### Requirement: Rename 执行基于 plan

系统 SHALL 通过 `execute_rename_plan` task 执行所有自动和手动整理。Confirmed rename plan SHALL be a single-use execution token; once execution is queued or started, the same plan MUST NOT be executed by another task and MUST become terminal when that task finishes. 系统 SHALL 使用 `create_rename_plan_for_item` task 为单个 item 创建 confirmed rename plan；`autoOrganize` 只控制 plan 创建成功后是否自动 enqueue `execute_rename_plan`。

#### Scenario: 扫描排队单 item 计划创建任务

- **WHEN** scan task 发现 eligible item
- **THEN** 系统 MUST enqueue `create_rename_plan_for_item` with that item id
- **AND** scan task MUST NOT directly create a confirmed rename plan

#### Scenario: 单 item 计划创建无可执行行

- **WHEN** `create_rename_plan_for_item` processes an eligible item
- **AND** all candidate rows are no-op, invalid, or there are no video files
- **THEN** task MUST finish as succeeded
- **AND** task result summary MUST explain that no executable plan was created
- **AND** 系统 MUST NOT enqueue `execute_rename_plan`

#### Scenario: 单 item 计划创建且自动执行开启

- **WHEN** `create_rename_plan_for_item` creates a confirmed rename plan with executable rows
- **AND** the library path has `autoOrganize` enabled
- **THEN** 系统 MUST enqueue `execute_rename_plan` for that plan
- **AND** task result summary MUST include the created plan id and execution task id

#### Scenario: 单 item 计划创建且自动执行关闭

- **WHEN** `create_rename_plan_for_item` creates a confirmed rename plan with executable rows
- **AND** the library path has `autoOrganize` disabled
- **THEN** 系统 MUST NOT enqueue `execute_rename_plan`
- **AND** task result summary MUST include the created plan id and indicate that execution is waiting for user action

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
- **AND** worker MUST append an English task detail line describing the missing source

#### Scenario: MOVE 返回成功

- **WHEN** worker submits a MOVE for a plan item
- **AND** the FileClient `moveFile(source, target)` call returns success
- **THEN** worker MUST mark that plan item as succeeded or submitted
- **AND** worker MUST append an English task detail line describing the successful move before finishing the task
- **AND** worker MUST NOT wait for `exists(target)` or directory listing to prove target visibility

#### Scenario: MOVE 返回失败

- **WHEN** worker submits a MOVE for a plan item
- **AND** the FileClient `moveFile(source, target)` call returns an error or throws
- **THEN** worker MUST mark that plan item as failed with the MOVE error
- **AND** worker MUST append an English task detail line describing the failed move
- **AND** the task detail line MUST include the FileClient failure stage and intermediate path when provided
- **AND** worker MUST continue processing remaining selected plan items
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: WebDAV 跨目录改名由 adapter 封装

- **WHEN** executor requests FileClient to move `/a/01.mp4` to `/target/a.s01e01.mp4`
- **AND** the WebDAV/AList backend does not reliably support cross-directory move and rename in one operation
- **THEN** WebDAV/AList FileClient MUST first move `/a/01.mp4` to `/a/a.s01e01.mp4`
- **AND** WebDAV/AList FileClient MUST then move `/a/a.s01e01.mp4` to `/target/a.s01e01.mp4`
- **AND** executor MUST still treat this as a single row-level `moveFile(source, target)` operation

#### Scenario: 恢复跨目录改名中间态

- **WHEN** plan item 的原 source file 已不存在，但 source 目录内存在同 target basename 的中间文件
- **THEN** FileClient MUST 从该中间文件继续执行目标移动
- **AND** worker MUST append an English task detail line describing the recovered intermediate path

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
- **AND** worker MUST append an English task detail line describing the target conflict
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 手动 overwrite

- **WHEN** 手动批准的 plan item 允许 overwrite
- **THEN** worker MUST 对该 target file 使用 overwrite 行为
- **AND** worker MUST include overwrite status in the English task detail line for that item

### Requirement: 部分执行失败时继续处理

worker SHALL 在单个 plan item 失败后继续执行剩余 plan items。Worker SHALL persist each row MOVE result in `rename_plan_items.status` during execution and SHALL summarize mixed success/failure at task completion.

#### Scenario: 成功和失败混合

- **WHEN** 至少一个 plan item 成功且至少一个 plan item 失败
- **THEN** task MUST 以 `partially_failed` 结束，或以 `failed` 携带部分成功 summary 结束
- **AND** task detail lines MUST include the result of each attempted item
- **AND** 系统 MUST NOT 因失败 plan item 将 library item status 改为 `failed`

#### Scenario: 所有 MOVE 都失败

- **WHEN** selected plan items were attempted
- **AND** every attempted MOVE failed
- **THEN** task MUST 以 `failed` 结束
- **AND** task summary MUST include failed count and failure details
- **AND** task detail lines MUST include each attempted failure

#### Scenario: Row 成功后持久化

- **WHEN** worker receives a successful MOVE result for a plan item
- **THEN** worker MUST update that `rename_plan_item` status to succeeded or submitted
- **AND** worker MUST append a succeeded task detail line before task finalization

#### Scenario: Row 失败后持久化

- **WHEN** worker receives a failed MOVE result for a plan item
- **THEN** worker MUST update that `rename_plan_item` status to failed
- **AND** worker MUST append a failed task detail line before task finalization
- **AND** worker MUST continue unrelated later plan items

### Requirement: 执行结果更新 item 摘要

系统 SHALL NOT use rename executor results as the source of truth for `library_items` identity status or file statistics. Executor SHALL record task, plan item, pino log, task detail line, and task summary results; scanner SHALL update `library_items` according to the remote files and directories visible during scan.

#### Scenario: 所有 selected plan items 成功

- **WHEN** rename plan 对某个 library item 的 selected rows 全部 MOVE 返回成功
- **THEN** 系统 MUST record the task, task detail lines, and plan item statuses as successful
- **AND** executor MUST NOT directly mark the item as `organized`
- **AND** executor MUST NOT directly update video、compliant、non-compliant 统计

#### Scenario: 部分或全部 plan items 失败

- **WHEN** rename plan 对某个 library item 的任意 selected row 执行失败
- **THEN** 系统 MUST 在 task summary、task detail lines 或 pino logs 中保留失败原因
- **AND** 系统 MUST NOT 将该 item 标记为 `failed`
- **AND** executor MUST NOT directly change item identity status or statistics based on the failed task

#### Scenario: 整理后扫描同步远端事实

- **WHEN** a rename task finishes as succeeded, partially_failed, or failed
- **AND** a later scan reads the affected source or target directories
- **THEN** scanner MUST use the current remote directory state as source of truth
- **AND** scanner MUST update item identity inheritance and file statistics according to the files actually visible remotely
