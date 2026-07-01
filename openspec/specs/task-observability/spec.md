## Purpose

定义后台任务状态、进度、事件日志、任务详情和日志存储控制规则，确保用户能从任务列表、任务详情和全局日志中理解任务运行结果。

## Requirements

### Requirement: 任务目标去重
系统 SHALL 对同一任务类型和同一业务目标的 queued/running 任务进行后端去重。

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

### Requirement: 任务事件日志
系统 SHALL 将用户可解释的任务事件记录为关联 task id 的日志。

#### Scenario: 记录任务事件
- **WHEN** worker 处理扫描或整理任务时发生用户需要了解的业务事件
- **THEN** 系统 MUST 写入带 task id 的日志
- **AND** 日志 message MUST 使用英文原文
- **AND** 日志 context SHOULD 包含可直接展示的 summary 和结构化业务字段

#### Scenario: 展示任务日志
- **WHEN** UI 展示任务详情日志
- **THEN** UI MUST 直接展示后端日志 message、summary 或 context
- **AND** UI MUST NOT 依赖前端日志翻译映射生成另一套文案

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

### Requirement: 全局日志流
系统 SHALL 保留全局日志页作为跨任务和系统事件流。

#### Scenario: 日志关联任务
- **WHEN** 全局日志中的条目存在 task id
- **THEN** UI MUST 提供可进入对应任务详情的入口

#### Scenario: 日志没有任务
- **WHEN** 全局日志中的条目没有 task id
- **THEN** UI MUST 继续展示该日志作为普通系统事件

### Requirement: 日志和记录存储控制
系统 SHALL 限制任务日志和执行记录的长期存储增长。

#### Scenario: 清理旧日志
- **WHEN** 日志超过保留天数或最大保留行数
- **THEN** 系统 MUST 清理最旧的可清理日志
- **AND** 系统 MUST NOT 清理 queued/running 任务所需日志

#### Scenario: 清理旧执行记录
- **WHEN** execution records 超过保留策略范围
- **THEN** 系统 MAY 清理旧的详细 execution records
- **AND** 系统 MUST 保留关联任务的完成摘要

#### Scenario: 限制日志内容大小
- **WHEN** 系统写入日志 context
- **THEN** 系统 MUST NOT 保存完整外部 API 响应、敏感配置或大量低层 trace
- **AND** 系统 MUST 保持 context 足够小以避免单条日志占用过多存储

#### Scenario: 详细日志已清理
- **WHEN** 用户查看一个详细日志已被保留策略清理的历史任务
- **THEN** UI MUST 仍展示任务完成摘要
- **AND** UI MUST 明确显示详细日志已被清理
