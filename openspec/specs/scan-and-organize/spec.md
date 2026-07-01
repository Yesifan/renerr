## Purpose

定义媒体库扫描、item 状态流转、rename plan 执行和执行结果记录的核心规则，确保自动整理、手动整理和 worker 失败处理共享同一套业务语义。

## Requirements

### Requirement: Library path 扫描遵循 item 状态规则

系统 SHALL 让 `scan_library_path` 同步当前 root-level `library_items`，并按每个 item 的状态处理。

#### Scenario: 远端 item 消失

- **WHEN** 已存储的 `library_item` 在 library root 不再存在
- **THEN** 系统 MUST 硬删除该当前 `library_item` 记录

#### Scenario: 未识别 item

- **WHEN** 扫描 `unidentified` item
- **THEN** 系统 MUST 尝试识别，并在 high-confidence 时转为 `identified`，在 fuzzy、ambiguous、no-match 或 parse-failed 时转为 `pending_review`

#### Scenario: 识别失败没有候选

- **WHEN** 扫描 item 时无法解析标题或 TMDB 没有候选
- **THEN** 系统 MUST 将 item 标记为 `pending_review`
- **AND** recognition candidates MUST 保存为空数组

#### Scenario: 待确认 item

- **WHEN** 扫描 `pending_review` item
- **THEN** 系统 MUST 跳过该 item 的识别、内部检查和自动整理

#### Scenario: 发现历史整理目标目录

- **WHEN** library path 扫描发现一个一级目录等于历史 rename plan item 的 `target_top_level_path`
- **AND** 该 plan item 对应的旧 `library_item` 已有 TMDB identity
- **THEN** 系统 MUST 将旧 identity 继承到新目录对应的 `library_item`
- **AND** 新目录对应的 `library_item` MUST 标记为 `organized`

#### Scenario: 已识别 item

- **WHEN** 扫描 `identified` item
- **THEN** 系统 MUST NOT 再查询 TMDB，并且 MUST 让它保持等待整理

#### Scenario: 已整理 item

- **WHEN** 扫描 `organized` folder item
- **THEN** 系统 MUST 跳过 TMDB 识别，并更新内部视频数量和模板符合度统计

### Requirement: Item 扫描是显式且受状态限制的

系统 SHALL 提供 `scan_library_item`，用于手动扫描单个符合条件的 `library_item`。

#### Scenario: 扫描已整理 item

- **WHEN** 用户手动扫描 `organized` item
- **THEN** 系统 MUST 刷新其内部视频数量和模板符合度统计，并且不重新查询 TMDB

#### Scenario: 扫描未识别 item

- **WHEN** 用户手动扫描 `unidentified` item
- **THEN** 系统 MUST 使用与 library path 扫描相同的规则尝试识别

#### Scenario: 扫描不符合条件的 item

- **WHEN** 用户尝试扫描 `pending_review` 或 `identified` item
- **THEN** 系统 MUST 使用稳定 error code 拒绝请求

### Requirement: Rename 执行基于 plan

系统 SHALL 通过 `execute_rename_plan` task 执行所有自动和手动整理。

#### Scenario: 自动 plan 创建

- **WHEN** 扫描发现符合条件的 high-confidence item 且自动整理开启
- **THEN** 系统 MUST 创建 mode 为 `auto` 的 confirmed `rename_plan` 并 enqueue `execute_rename_plan`

#### Scenario: 手动 plan 提交

- **WHEN** 用户提交已批准的手动 plan
- **THEN** 系统 MUST 创建 mode 为 `manual` 的 confirmed `rename_plan` 并 enqueue `execute_rename_plan`

### Requirement: Worker 移动文件前进行校验

worker SHALL 在每个文件 MOVE 前重新校验 source 和 target 状态。

WebDAV source URL SHALL 以用户配置为准，系统 MUST NOT 自动把 URL 改写为更高层级的服务端根路径。

当 source 和 target 同时跨目录且文件名不同，FileClient adapter MAY 将一个业务移动拆分为先跨目录移动原文件名、再在目标目录内重命名，以兼容 AList 等 WebDAV 服务端。

#### Scenario: Source 已消失

- **WHEN** plan item 的 source file 在执行时已不存在
- **THEN** worker MUST 将该 plan item 标记为 failed，并继续处理剩余 items
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 恢复跨目录改名中间态

- **WHEN** plan item 的原 source file 已不存在，但目标目录内存在同 basename 的中间文件
- **THEN** worker MUST 从该中间文件继续执行目标重命名
- **AND** execution record MUST 记录恢复中间态的 warning

#### Scenario: Target 文件存在且未 overwrite

- **WHEN** target file 已存在且 plan item 不允许 overwrite
- **THEN** worker MUST 将该 plan item 标记为 conflict 或 failed，并且 MUST NOT 覆盖目标文件
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 手动 overwrite

- **WHEN** 手动批准的 plan item 允许 overwrite
- **THEN** worker MUST 对该 target file 使用 overwrite 行为，并在 execution records 中记录 overwritten target path

### Requirement: 已存在 folder 不是冲突

系统 SHALL 将已存在 target folder 视为可复用，并且 SHALL 只把 target file path 已存在视为冲突。

#### Scenario: Movie target folder 已存在

- **WHEN** 将电影整理到已存在 target folder 且 target video file 不存在
- **THEN** 系统 MUST 将文件移动到该 folder，且不报告 folder conflict

#### Scenario: TV target folder 已存在

- **WHEN** 将剧集整理到已存在 show folder 或 season folder 且 target episode file 不存在
- **THEN** 系统 MUST 将文件移动到该 folder，且不报告 folder conflict

### Requirement: 部分执行失败时继续处理

worker SHALL 在单个 plan item 失败后继续执行剩余 plan items。

#### Scenario: 成功和失败混合

- **WHEN** 至少一个 plan item 成功且至少一个 plan item 失败
- **THEN** task MUST 以 `partially_failed` 结束，并且 execution records MUST 标识每个 item 的结果
- **AND** 系统 MUST NOT 因失败 plan item 将 library item status 改为 `failed`

### Requirement: 执行结果更新 item 摘要

系统 SHALL 在整理成功后同步更新 `library_items` 的 identity 状态和文件统计；执行失败只记录在 task、log 和 execution records 中。

#### Scenario: 所有 selected plan items 成功

- **WHEN** rename plan 对某个 library item 的 selected rows 全部执行成功
- **THEN** 系统 MUST 将该 item 标记为 `organized`
- **AND** 系统 MUST 更新 video、compliant、non-compliant 统计

#### Scenario: 部分或全部 plan items 失败

- **WHEN** rename plan 对某个 library item 的任意 selected row 执行失败
- **THEN** 系统 MUST 在 task、log 或 execution records 中保留失败原因
- **AND** 系统 MUST NOT 将该 item 标记为 `failed`

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
