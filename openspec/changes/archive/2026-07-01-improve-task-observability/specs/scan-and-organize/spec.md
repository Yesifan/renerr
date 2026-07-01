## ADDED Requirements

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
