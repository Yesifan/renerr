## MODIFIED Requirements

### Requirement: 任务详情

系统 SHALL 提供任务详情能力，用于查看单个任务的状态、进度、摘要、关联日志和结构化执行记录。任务详情 UI MUST 允许用户查看长路径、长摘要和结构化 context 的完整内容。

#### Scenario: 查看扫描任务详情

- **WHEN** 用户打开扫描任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要和扫描/识别日志
- **AND** 系统 MUST NOT 在扫描任务详情中混入文件移动详情

#### Scenario: 查看整理任务详情

- **WHEN** 用户打开整理任务详情
- **THEN** 系统 MUST 返回该任务的状态、进度、完成摘要、整理日志和关联 execution records
- **AND** 系统 MUST NOT 在整理任务详情中混入扫描识别详情

#### Scenario: 查看长日志摘要

- **WHEN** 任务日志 summary 或 context 超过表格默认列宽
- **THEN** UI MUST 提供展开、详情弹窗或等价方式查看完整内容
- **AND** UI MUST NOT 只提供不可恢复的截断文本

#### Scenario: 查看长执行路径

- **WHEN** execution record 的 source path、target path 或 error 超过表格默认列宽
- **THEN** UI MUST 提供查看完整路径和错误内容的方式
- **AND** 完整内容 MUST 保持可复制

## ADDED Requirements

### Requirement: Item 相关 active task 可关联整理任务

系统 SHALL 允许 item detail 查询当前 item 相关的 queued/running 扫描任务和整理任务。

#### Scenario: item 有 active scan task

- **WHEN** 当前 item 存在 queued 或 running `scan_library_item` 任务
- **THEN** active task 查询 MUST 返回该任务
- **AND** UI MUST 展示该任务状态和可用进度

#### Scenario: item 有 active rename task

- **WHEN** 当前 item 关联的 rename plan 存在 queued 或 running `execute_rename_plan` 任务
- **THEN** active task 查询 MUST 能返回该整理任务或等价关联信息
- **AND** UI MUST 展示该整理任务状态和可用进度

#### Scenario: 刷新 item detail

- **WHEN** 用户刷新 item detail 页面且相关 rename task 仍处于 queued 或 running
- **THEN** UI MUST 仍能发现并展示该整理任务
- **AND** UI MUST 提供进入任务详情的入口

### Requirement: 整理进度摘要面向用户可读

系统 SHALL 在 rename task progress 中提供适合 UI 展示的当前进度。

#### Scenario: 整理任务处理中

- **WHEN** `execute_rename_plan` task 正在处理 plan rows
- **THEN** progress MUST 包含 current、total、当前 phase 和简短 message
- **AND** progress counts MUST 包含 succeeded、failed 和 warnings

#### Scenario: 整理任务完成

- **WHEN** `execute_rename_plan` task 完成
- **THEN** result summary MUST 包含 total、moved、moveFailed 和 warnings
- **AND** UI MUST 能用该摘要展示完成结果

### Requirement: 全局日志长内容可完整查看

系统 SHALL 在全局日志页保留跨任务日志的可扫读表格，同时允许查看长 summary 的完整内容。

#### Scenario: 全局日志 summary 被截断

- **WHEN** 全局日志 entry 的 summary 超过默认列宽
- **THEN** UI MUST 提供查看完整 summary 的方式
- **AND** UI MUST 保持任务详情链接可用
