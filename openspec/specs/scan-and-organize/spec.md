## Purpose

定义媒体库扫描、item 状态流转、rename plan 执行和执行结果记录的核心规则，确保自动整理、手动整理和 worker 失败处理共享同一套业务语义。
## Requirements
### Requirement: Library path 扫描遵循 item 状态规则

系统 SHALL 让 `scan_library_path` 同步当前 root-level `library_items`，并按每个 item 的状态处理。扫描得到的空目录或无视频目录 MUST 更新为空内容状态，并且 MUST NOT 作为默认媒体库列表中的可整理 item 展示。扫描 SHALL 只负责远端同步、统计刷新和影视识别；扫描 MUST NOT 直接创建 confirmed rename plan，也 MUST NOT 直接 enqueue `execute_rename_plan`。当 item 处于 `identified` 或 `organized` 且仍存在视频文件时，扫描 MAY enqueue `create_rename_plan_for_item`，由 planner 使用完整 `sourceFilePath !== targetFilePath` 判断是否存在可执行 rename rows。

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

#### Scenario: 已整理 item 仍存在视频文件

- **WHEN** 扫描 `organized` folder item
- **AND** 刷新后的 `videoFileCount` 大于 0
- **THEN** 系统 MUST 跳过 TMDB 识别
- **AND** 系统 MUST enqueue `create_rename_plan_for_item` for that item
- **AND** planner MUST use full path comparison to decide whether a confirmed rename plan is actually created

#### Scenario: 已整理 item 无视频文件

- **WHEN** 扫描 `organized` folder item
- **AND** 刷新后的 `videoFileCount` 等于 0
- **THEN** 系统 MUST 跳过 TMDB 识别
- **AND** 系统 MUST NOT enqueue `create_rename_plan_for_item`

### Requirement: Item 扫描是显式且受状态限制的

系统 SHALL 提供 `scan_library_item`，用于手动扫描单个符合条件的 `library_item`。Item 扫描 SHALL 只负责刷新统计和必要的影视识别；当扫描后 item 符合整理条件时，系统 MUST enqueue `create_rename_plan_for_item`，而不是直接创建 confirmed plan 或直接执行整理。Planner MUST use full `sourceFilePath !== targetFilePath` comparison to decide whether the queued plan creation produces executable rows.

#### Scenario: 扫描已整理 item 仍存在视频文件

- **WHEN** 用户手动扫描 `organized` item
- **AND** 刷新后的 `videoFileCount` 大于 0
- **THEN** 系统 MUST 刷新其内部视频数量和模板符合度统计
- **AND** 系统 MUST enqueue `create_rename_plan_for_item`
- **AND** 系统 MUST NOT 重新查询 TMDB
- **AND** planner MUST create executable rows only for files whose current full path differs from the generated target full path

#### Scenario: 扫描已整理 item 无视频文件

- **WHEN** 用户手动扫描 `organized` item
- **AND** 刷新后的 `videoFileCount` 等于 0
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

### Requirement: 已存在 folder 不是冲突

系统 SHALL 将已存在 target folder 视为可复用，并且 SHALL 只把 target file path 已存在视为冲突。

#### Scenario: Movie target folder 已存在

- **WHEN** 将电影整理到已存在 target folder 且 target video file 不存在
- **THEN** 系统 MUST 将文件移动到该 folder，且不报告 folder conflict

#### Scenario: TV target folder 已存在

- **WHEN** 将剧集整理到已存在 show folder 或 season folder 且 target episode file 不存在
- **THEN** 系统 MUST 将文件移动到该 folder，且不报告 folder conflict

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

### Requirement: Rename plan 忽略 no-op 文件移动

系统 SHALL 将 source file path 与 target file path 完全相同的 rename row 识别为 no-op，并阻止其进入默认执行集合。

#### Scenario: 生成同路径 row

- **WHEN** planner 生成的 row 满足 `sourceFilePath` 等于 `targetFilePath`
- **THEN** 系统 MUST 将该 row 标记为 no-op 或等价的不可执行跳过状态
- **AND** 该 row MUST 默认未选中
- **AND** 该 row MUST NOT 被视为 target conflict

#### Scenario: 提交 plan 时排除 no-op row

- **WHEN** 用户提交 draft
- **THEN** confirmed rename plan MUST NOT 包含仍为 no-op 的 rows

#### Scenario: 修改 row 后不再是 no-op

- **WHEN** 用户修改影视信息、season 或 episode 导致 target file path 与 source file path 不同
- **THEN** 系统 MUST 重新按普通 valid row 处理该 row
- **AND** 系统 MUST 对新的 target file path 执行冲突检测

### Requirement: Sidecar 和 metadata 遵循 V1 规则

executor SHALL 随视频移动 sidecar，并在成功整理后按 V1 settings 写 metadata。

#### Scenario: Sidecar 移动失败

- **WHEN** 视频移动成功但 sidecar 移动失败
- **THEN** 视频 plan item MUST 保持成功，sidecar 失败 MUST 记录为 warning/detail

#### Scenario: Metadata 写入失败

- **WHEN** 文件整理成功但 metadata 写入失败
- **THEN** item 整理 MUST NOT 回滚，metadata 失败 MUST 被记录

### Requirement: 扫描任务写入观测事件

系统 SHALL 在扫描任务中写入扫描和识别相关的任务进度、任务事件和完成摘要。

#### Scenario: Library path 扫描开始

- **WHEN** `scan_library_path` task 开始执行
- **THEN** 系统 MUST 写入任务开始事件
- **AND** 系统 MUST 在读取 root-level entries 后更新可用的 total 进度

#### Scenario: Item 识别成功

- **WHEN** 扫描任务将 item 识别为 TMDB movie 或 tv identity
- **THEN** 系统 MUST 写入 `Item recognized` 任务日志
- **AND** 日志 context MUST 包含 task id、library item id、top-level path、media type、title 和 source media id

#### Scenario: Item 识别失败

- **WHEN** 扫描任务因解析失败、无候选、歧义或 TMDB 错误导致 item 进入 pending review
- **THEN** 系统 MUST 写入 `Item recognition failed` 任务日志
- **AND** 日志 context MUST 包含 task id、library item id、top-level path 和失败原因

#### Scenario: Item 被跳过

- **WHEN** library path 扫描因 item 状态规则跳过 pending review、identified 或其他无需处理的 item
- **THEN** 系统 SHOULD 写入可解释的跳过事件或在任务摘要中计入 skipped

#### Scenario: 扫描任务完成

- **WHEN** 扫描任务结束
- **THEN** 系统 MUST 写入扫描完成摘要
- **AND** 摘要 MUST 包含处理数量、识别成功数量、识别失败数量和跳过数量

### Requirement: 整理任务写入观测事件

系统 SHALL 在 `execute_rename_plan` task 中写入整理执行相关的任务进度、任务事件和完成摘要。

#### Scenario: 整理任务开始

- **WHEN** `execute_rename_plan` task 开始执行
- **THEN** 系统 MUST 写入任务开始事件
- **AND** 系统 MUST 将 progress total 设置为 selected plan rows 数量

#### Scenario: 文件移动成功

- **WHEN** executor 成功移动一个 plan item 的视频文件
- **THEN** 系统 MUST 写入 `File move succeeded` 任务日志
- **AND** 日志 context MUST 包含 task id、plan id、plan item id、library item id、source path 和 target path
- **AND** 系统 MUST 写入 succeeded execution record

#### Scenario: 文件移动失败

- **WHEN** executor 移动一个 plan item 失败
- **THEN** 系统 MUST 写入 `File move failed` 任务日志
- **AND** 日志 context MUST 包含 task id、plan id、plan item id、library item id、source path、target path 和 error
- **AND** 系统 MUST 写入 failed execution record

#### Scenario: Sidecar 或 metadata warning

- **WHEN** 视频移动成功但 sidecar 移动或 metadata 写入失败
- **THEN** 系统 MUST 写入 warning 任务日志
- **AND** 系统 MUST NOT 因该 warning 将成功的视频移动回滚为失败

#### Scenario: 整理任务完成

- **WHEN** rename plan task 结束
- **THEN** 系统 MUST 写入整理完成摘要
- **AND** 摘要 MUST 包含移动成功数量、移动失败数量和 warning 数量

### Requirement: 自动整理任务边界

系统 SHALL 将扫描任务和自动整理产生的 rename 执行任务作为两个独立任务展示。

#### Scenario: 扫描触发自动整理

- **WHEN** 扫描任务识别出符合自动整理条件的 item 并创建 rename plan
- **THEN** 系统 MUST enqueue 独立的 `execute_rename_plan` task
- **AND** 扫描任务详情 MUST 只展示扫描和识别事件
- **AND** 文件移动详情 MUST 只展示在对应整理任务详情中

### Requirement: Library Path 可使用独立整理目标目录

系统 SHALL 允许 Library Path 配置同一 WebDAV source 下的可选整理目标目录。未配置整理目标目录时，rename plan MUST 继续使用 Library Path path 作为目标根目录；配置整理目标目录时，rename plan MUST 使用该目标目录作为 target path 根目录。Planner MUST 通过比较每个视频文件的当前完整 path 和按当前规则生成的 target 完整 path 决定是否生成可执行 rename plan row，而不是按是否配置整理目标目录或按文件名合规统计分支判断。

#### Scenario: 未配置整理目标目录

- **WHEN** 系统为 Library Path 下的 item 创建 rename plan
- **AND** 该 Library Path 没有配置整理目标目录
- **THEN** plan item 的 target file path MUST 继续以该 Library Path path 为根目录生成

#### Scenario: 配置整理目标目录

- **WHEN** 系统为 Library Path `/library` 下的 TV item `a` 创建 rename plan
- **AND** 该 Library Path 配置整理目标目录 `/target_path`
- **AND** 解析出的剧集信息为 season 1 episode 1
- **THEN** plan item 的 source file path MUST 指向 `/library/a/01.mp4`
- **AND** plan item 的 target file path MUST 以 `/target_path` 为根目录生成，例如 `/target_path/<show>/Season 01/<episode-name>.mp4`
- **AND** plan item 的 target file path MUST NOT 以 `/library` 为根目录生成

#### Scenario: 整理到目标目录后原 item 消失

- **WHEN** rename plan 将 Library Path `/library` 下的 item 文件移动到整理目标目录 `/target_path`
- **AND** 后续扫描 `/library`
- **THEN** 系统 MUST 按现有远端 item 消失规则硬删除原 `library_item`
- **AND** 系统 MUST NOT 自动把原 `library_item` 转换为 `/target_path` 下的 item

#### Scenario: 已整理 item 添加目标目录后再次生成 plan

- **WHEN** Library Path `/library` 下已存在 `organized` item
- **AND** 该 item 的当前视频文件 path 已符合命名模板
- **AND** 用户将该 Library Path 的整理目标目录更新为 `/target_path`
- **THEN** 下一次 plan 创建 MUST 按 `/target_path` 作为有效目标根目录生成 target file path
- **AND** 如果任一视频文件的当前完整 path 不等于生成后的 target 完整 path，系统 MUST 创建可执行 rename plan row

#### Scenario: 完整 path 相同时不生成可执行行

- **WHEN** 系统为 `identified` 或 `organized` item 创建 rename plan
- **AND** 该 item 的每个视频文件当前完整 path 都等于按当前 Library Path、整理目标目录、媒体身份和命名模板生成的 target 完整 path
- **THEN** 系统 MUST 将这些行视为 no-op
- **AND** `create_rename_plan_for_item` MUST 成功结束且不创建 confirmed rename plan

#### Scenario: 完整 path 不同时生成可执行行

- **WHEN** 系统为 `identified` 或 `organized` item 创建 rename plan
- **AND** 任一视频文件当前完整 path 不等于按当前 Library Path、整理目标目录、媒体身份和命名模板生成的 target 完整 path
- **THEN** 系统 MUST 为该视频文件创建可执行 rename plan row
- **AND** 目录不同、文件名不同或二者都不同 MUST 都被视为需要整理

#### Scenario: 沿用 overwrite 策略

- **WHEN** rename plan 使用整理目标目录生成 target file path
- **AND** target file 已存在
- **THEN** 自动 plan MUST 继续拒绝覆盖
- **AND** 手动 plan MUST 仅在用户批准 overwrite 后覆盖
- **AND** executor MUST 继续使用现有 row-by-row move 规则处理该 plan

### Requirement: Library Path 整理目标目录配置受路径关系约束

系统 SHALL 在创建或更新 Library Path 时规范化整理目标目录，并防止整理目标目录成为当前 Library Path path 的子目录。整理目标目录 MUST 隶属于同一个 WebDAV source，因为它作为该 Library Path 的字段保存，不能指定另一个 source。

#### Scenario: Target path 是 library path 子目录

- **WHEN** 用户为 Library Path `/library` 配置整理目标目录 `/library/organized`
- **THEN** 系统 MUST 拒绝保存
- **AND** 响应 MUST 使用稳定 validation error

#### Scenario: Target path 等于 library path

- **WHEN** 用户为 Library Path `/library` 配置整理目标目录 `/library`
- **THEN** 系统 MUST 将该配置视为未使用独立整理目标目录
- **AND** 后续 rename plan MUST 以 `/library` 作为目标根目录

#### Scenario: Target path 是 sibling 目录

- **WHEN** 用户为 Library Path `/library` 配置整理目标目录 `/target_path`
- **THEN** 系统 MUST 允许保存该配置
- **AND** 后续 rename plan MUST 以 `/target_path` 作为目标根目录

#### Scenario: Target path 是 parent 目录

- **WHEN** 用户为 Library Path `/library/inbox` 配置整理目标目录 `/library`
- **THEN** 系统 MUST 允许保存该配置
- **AND** 后续 rename plan MUST 以 `/library` 作为目标根目录

