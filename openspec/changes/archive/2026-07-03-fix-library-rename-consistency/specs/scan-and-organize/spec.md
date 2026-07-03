## MODIFIED Requirements

### Requirement: Library path 扫描遵循 item 状态规则

系统 SHALL 让 `scan_library_path` 同步当前 root-level `library_items`，并按每个 item 的状态处理。扫描得到的空目录或无视频目录 MUST 更新为空内容状态，并且 MUST NOT 作为默认媒体库列表中的可整理 item 展示。

#### Scenario: 远端 item 消失

- **WHEN** 已存储的 `library_item` 在 library root 不再存在
- **THEN** 系统 MUST 硬删除该当前 `library_item` 记录

#### Scenario: 远端 item 是空目录或无视频目录

- **WHEN** library path 扫描发现 root-level directory 存在但内部没有可统计的视频文件
- **THEN** 系统 MUST 将该 item 的视频数量、符合数量和待整理数量刷新为 0
- **AND** 系统 MUST 让该 item 从默认媒体库列表中隐藏
- **AND** 系统 MUST NOT 为该 item 创建自动整理计划

#### Scenario: 未识别 item

- **WHEN** 扫描 `unidentified` item 且该 item 包含视频文件
- **THEN** 系统 MUST 尝试识别，并在 high-confidence 时转为 `identified`，在 fuzzy、ambiguous、no-match 或 parse-failed 时转为 `pending_review`

#### Scenario: 识别失败没有候选

- **WHEN** 扫描 item 时无法解析标题或 TMDB 没有候选
- **THEN** 系统 MUST 将 item 标记为 `pending_review`
- **AND** recognition candidates MUST 保存为空数组

#### Scenario: 待确认 item

- **WHEN** 扫描 `pending_review` item
- **THEN** 系统 MUST 跳过该 item 的 TMDB 识别和自动整理
- **AND** 系统 MAY 刷新该 item 的空内容和文件统计以避免展示过期数量

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

### Requirement: 执行结果更新 item 摘要

系统 SHALL 在整理成功后同步更新 `library_items` 的 identity 状态和文件统计；执行失败只记录在 task、log 和 execution records 中。文件统计 MUST 来自执行后的远端真实扫描结果，而不是仅由 selected plan rows 或成功移动 targets 推导。

#### Scenario: 所有 selected plan items 成功

- **WHEN** rename plan 对某个 library item 的 selected rows 全部执行成功
- **THEN** 系统 MUST 将该 item 标记为 `organized`
- **AND** 系统 MUST 对受影响 item 重新扫描远端文件状态
- **AND** 系统 MUST 使用重新扫描结果更新 video、compliant、non-compliant 统计

#### Scenario: 部分或全部 plan items 失败

- **WHEN** rename plan 对某个 library item 的任意 selected row 执行失败
- **THEN** 系统 MUST 在 task、log 或 execution records 中保留失败原因
- **AND** 系统 MUST NOT 将该 item 标记为 `failed`
- **AND** 系统 MUST 尽量对受影响 item 重新扫描远端文件状态并刷新可获得的统计

#### Scenario: 用户取消勾选部分 rows 后执行成功

- **WHEN** confirmed rename plan 只包含用户选中的 rows
- **AND** 所有 selected rows 执行成功
- **THEN** 系统 MUST 重新扫描该 item 当前远端文件
- **AND** 未被选中的文件 MUST 继续计入该 item 的真实视频数量和命名符合度统计

### Requirement: Worker 移动文件前进行校验

worker SHALL 在每个文件 MOVE 前重新校验 source 和 target 状态。

WebDAV source URL SHALL 以用户配置为准，系统 MUST NOT 自动把 URL 改写为更高层级的服务端根路径。

worker MUST treat a WebDAV MOVE response as an operation submission result, not as final proof that the destination file is visible. For WebDAV/AList sources, worker MUST reconcile remote original source, renamed source, and final target path visibility after MOVE attempts before marking a row succeeded or failed.

当 source 和 target 同时跨目录且文件名不同，worker MUST 将业务移动拆分为先在 source 所在目录将原文件名改为最终文件名，再将该 renamed source 跨目录移动到最终 target path。worker MUST NOT use single-step cross-directory rename as the default strategy for WebDAV/AList sources.

worker SHALL 对目录创建后的可见性进行确认，并对 WebDAV/AList 临时 500 类移动失败、一致性延迟和远端不可判定状态进行有限重试、退避和对账。

#### Scenario: Source 已消失

- **WHEN** plan item 的 source file 在执行时已不存在
- **AND** renamed source path 或 final target path 也不存在
- **THEN** worker MUST 将该 plan item 标记为 failed 或 indeterminate，并继续处理剩余 items
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 跨目录移动成功但目标短暂不可见

- **WHEN** WebDAV MOVE 返回成功
- **AND** 立即对账得到 source 不存在且 destination 不存在
- **THEN** worker MUST treat the row as remote settling
- **AND** worker MUST wait for later reconciliation checkpoints before marking the row failed
- **AND** worker MUST NOT retry the same MOVE while source and destination are both invisible

#### Scenario: 跨目录移动成功后目标延迟出现

- **WHEN** WebDAV MOVE 返回成功
- **AND** 立即对账得到 source 不存在且 destination 不存在
- **AND** 后续对账得到 source 不存在且 destination 存在
- **THEN** worker MUST mark the MOVE phase as succeeded
- **AND** execution record MUST preserve the delayed visibility snapshots

#### Scenario: 跨目录移动 500 后 source 回滚

- **WHEN** WebDAV MOVE 返回 retryable 500 类错误
- **AND** 后续对账得到 source 存在且 destination 不存在
- **THEN** worker MAY retry the same MOVE within the configured retry limit
- **AND** execution record MUST preserve the 500 response and rollback snapshot

#### Scenario: 跨目录移动后长期不可判定

- **WHEN** WebDAV MOVE has been submitted or returned a retryable error
- **AND** source and destination remain invisible through the maximum settling window
- **THEN** worker MUST mark the plan item as indeterminate or failed with an indeterminate reason
- **AND** worker MUST record reconciliation snapshots in execution records
- **AND** worker MUST continue processing remaining items
- **AND** worker MUST NOT mark the corresponding library item status as `failed`

#### Scenario: 跨目录移动出现重复状态

- **WHEN** reconciliation finds both source and destination visible for the same MOVE phase
- **THEN** worker MUST stop retrying that plan item
- **AND** worker MUST mark the plan item as failed or indeterminate with a duplicate-state reason
- **AND** execution record MUST include source and destination path snapshots for manual inspection

#### Scenario: 阶段化执行跨目录改名

- **WHEN** a rename plan contains multiple rows that require cross-directory rename
- **THEN** worker MUST first process the original-source-to-renamed-source same-directory rename phase for eligible rows
- **AND** worker MUST reconcile renamed source visibility before processing the renamed-source-to-final-target cross-directory move phase
- **AND** worker MUST expose the active phase, attempt, current count, total count, and waiting reason in task progress

#### Scenario: 原地改名阶段

- **WHEN** original source path exists and renamed source path does not exist
- **THEN** worker MUST perform the same-directory rename from original source path to renamed source path
- **AND** worker MUST reconcile original source and renamed source visibility before starting the cross-directory move phase

#### Scenario: 最终跨目录移动阶段

- **WHEN** renamed source path exists and final target path does not exist
- **THEN** worker MUST perform the cross-directory move from renamed source path to final target path
- **AND** worker MUST reconcile renamed source and final target visibility before marking the row succeeded

#### Scenario: Target 文件存在且未 overwrite

- **WHEN** target file 已存在且 plan item 不允许 overwrite
- **THEN** worker MUST 将该 plan item 标记为 conflict 或 failed，并且 MUST NOT 覆盖目标文件
- **AND** worker MUST NOT 将对应 library item 的 status 改为 `failed`

#### Scenario: 手动 overwrite

- **WHEN** 手动批准的 plan item 允许 overwrite
- **THEN** worker MUST 对该 target file 使用 overwrite 行为，并在 execution records 中记录 overwritten target path

#### Scenario: 目标目录刚创建后不可见

- **WHEN** worker 创建或确认 target parent directory 后立即执行移动
- **THEN** worker MUST 在执行移动前确认 target parent directory 对 WebDAV 服务端可见
- **AND** 如果目录在有限等待后仍不可见，worker MUST 将当前 plan item 标记为 failed 并继续剩余 items

#### Scenario: WebDAV 移动返回临时 500

- **WHEN** WebDAV move 返回可重试的 500 类错误
- **THEN** worker MUST reconcile source and destination visibility before deciding whether to retry
- **AND** worker MUST only retry when source is visible and destination is not visible
- **AND** 如果重试后成功，execution record MUST 保留重试 warning and reconciliation snapshots
- **AND** 如果重试耗尽或状态长期不可判定，worker MUST 记录最终失败原因并继续处理剩余 items

## ADDED Requirements

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
