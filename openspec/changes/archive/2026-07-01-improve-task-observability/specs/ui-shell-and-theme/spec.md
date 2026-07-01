## ADDED Requirements

### Requirement: 主页和详情页展示 active task 状态
系统 SHALL 在媒体库主页、library detail 和 item detail 中展示与当前对象相关的 active task 状态。

#### Scenario: 主页展示媒体库扫描状态
- **WHEN** 某个 library path 存在 queued 或 running 扫描任务
- **THEN** 主页对应媒体库入口 MUST 展示该任务状态和可用进度

#### Scenario: Library detail 禁止重复扫描
- **WHEN** 当前 library path 存在 queued 或 running 扫描任务
- **THEN** library detail 的扫描按钮 MUST 禁用或显示进行中状态
- **AND** UI MUST 提供进入该任务详情的入口

#### Scenario: Item detail 禁止重复任务
- **WHEN** 当前 item 或其 rename plan 存在 queued 或 running 扫描或整理任务
- **THEN** item detail 的对应操作按钮 MUST 禁用或显示进行中状态
- **AND** UI MUST 提供进入该任务详情的入口

### Requirement: 任务列表和任务详情信息架构
系统 SHALL 将系统任务页作为任务列表入口，并提供单个任务详情视图。

#### Scenario: 用户查看任务列表
- **WHEN** 用户打开系统任务页
- **THEN** UI MUST 展示任务类型、目标对象、状态、可用进度、创建时间、结束时间和错误摘要

#### Scenario: 用户查看任务详情
- **WHEN** 用户打开单个任务详情
- **THEN** UI MUST 展示任务状态、目标对象、进度、完成摘要、任务日志和可用的结构化执行记录

#### Scenario: 详细日志已清理
- **WHEN** 任务详情的详细日志或执行记录已被保留策略清理
- **THEN** UI MUST 展示后端返回的任务摘要
- **AND** UI MUST 显示详细日志或记录已清理的提示

### Requirement: 任务详情内嵌日志
系统 SHALL 在任务详情中内嵌该任务关联日志，并将全局日志页保留为跨任务事件流。

#### Scenario: 任务详情展示日志
- **WHEN** 用户查看任务详情日志
- **THEN** UI MUST 直接展示后端日志 message 和 summary/context
- **AND** UI MUST NOT 在前端将任务日志翻译为另一套中文文案

#### Scenario: 全局日志跳转任务
- **WHEN** 用户在全局日志页查看带 task id 的日志
- **THEN** UI MUST 提供进入对应任务详情的入口

#### Scenario: 全局日志保留系统事件
- **WHEN** 日志不属于任何任务
- **THEN** 全局日志页 MUST 继续展示该日志
