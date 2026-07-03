## MODIFIED Requirements

### Requirement: 管理台信息架构

系统 SHALL 使用左侧多级树状导航承载主要信息架构，并优先使用 shadcn Sidebar 组合实现 shell 导航。

#### Scenario: 用户查看导航

- **WHEN** 应用 shell 渲染导航
- **THEN** UI MUST 将 library paths 放在“媒体库”分组下，并将“任务”“日志”“设置”放在“系统”分组下

#### Scenario: 用户查看 library path detail

- **WHEN** 用户打开 library path detail
- **THEN** 主体 MUST 使用海报墙 card 展示 root-level 文件夹和视频文件
- **AND** 默认列表 MUST 隐藏空目录或无视频 item
- **AND** 未识别 item MUST 使用包含文件/文件夹名称的默认占位海报

#### Scenario: 用户首次打开应用 shell

- **WHEN** 应用 shell 首次渲染
- **THEN** 侧栏导航 MUST 有服务端提供的初始 library path 数据，并且后续动态摘要 MAY 通过职责专一 API 轮询刷新

#### Scenario: 用户打开 item detail

- **WHEN** 用户从 library path 海报墙进入单个 item
- **THEN** UI MUST 导航到 `libraries/[id]/[item_id]` 详情页，并在该页面集中展示海报、影视信息、完整路径、扫描和整理操作

#### Scenario: 用户浏览海报墙

- **WHEN** 用户查看 `libraries/[id]` 海报墙
- **THEN** 每个海报 card MUST 只展示 item 摘要信息和导航 affordance，并且 MUST NOT 内嵌手动匹配表单、扫描按钮或整理计划操作

### Requirement: 主页和详情页展示 active task 状态

系统 SHALL 在媒体库主页、library detail 和 item detail 中展示与当前对象相关的 active task 状态。扫描和整理中的提示 MUST 比普通链接更明显，并展示可用的 current/total 进度。

#### Scenario: 主页展示媒体库扫描状态

- **WHEN** 某个 library path 存在 queued 或 running 扫描任务
- **THEN** 主页对应媒体库入口 MUST 展示该任务状态和可用进度

#### Scenario: Library detail 禁止重复扫描

- **WHEN** 当前 library path 存在 queued 或 running 扫描任务
- **THEN** library detail 的扫描按钮 MUST 禁用或显示进行中状态
- **AND** UI MUST 提供进入该任务详情的入口
- **AND** UI MUST 显示明显的扫描进度提示，例如“正在扫描 3/12”

#### Scenario: Item detail 禁止重复任务

- **WHEN** 当前 item 或其 rename plan 存在 queued 或 running 扫描或整理任务
- **THEN** item detail 的对应操作按钮 MUST 禁用或显示进行中状态
- **AND** UI MUST 提供进入该任务详情的入口
- **AND** UI MUST 显示明显的扫描或整理进度提示，例如“正在整理 2/12”

## ADDED Requirements

### Requirement: 空目录默认隐藏且可在详情主动显示

系统 SHALL 默认隐藏空目录或无视频 item，并允许用户在 item detail 中通过显式开关主动查看空内容信息。

#### Scenario: library detail 默认隐藏空目录

- **WHEN** library detail 加载 item grid
- **THEN** UI MUST 默认不展示没有视频文件的空目录 item
- **AND** UI MUST NOT 将空目录显示为待整理内容

#### Scenario: item detail 显示空目录开关关闭

- **WHEN** 用户打开 item detail 且空内容显示开关关闭
- **THEN** UI MUST 保持主视图聚焦媒体身份、路径和操作
- **AND** UI MUST NOT 默认展示空目录诊断内容

#### Scenario: item detail 显示空目录开关打开

- **WHEN** 用户在 item detail 打开显示空目录或空内容的开关
- **THEN** UI MUST 展示空目录/无视频状态、完整远端路径和最近扫描时间
- **AND** UI SHOULD 提供重新扫描入口

### Requirement: 未识别占位海报包含文件上下文

系统 SHALL 为没有 poster 的 item 提供美观且可识别的 HTML 占位海报。

#### Scenario: 未识别文件夹无 poster

- **WHEN** item 是 folder 且没有 poster URL
- **THEN** 占位海报 MUST 展示文件夹图标或等价视觉
- **AND** 占位海报 MUST 展示 item 的文件夹名称

#### Scenario: 未识别视频文件无 poster

- **WHEN** item 是 file 且没有 poster URL
- **THEN** 占位海报 MUST 展示视频文件图标或等价视觉
- **AND** 占位海报 MUST 展示 item 的文件名

#### Scenario: 占位海报文本过长

- **WHEN** 文件或文件夹名称超过占位海报可用宽度
- **THEN** UI MUST 通过换行、截断或 line clamp 保持文本不溢出海报区域

### Requirement: 整理最终确认展示媒体摘要

系统 SHALL 在 rename plan 最终确认步骤展示媒体摘要，帮助用户确认本次整理的影视 identity。

#### Scenario: 最终确认渲染媒体摘要

- **WHEN** 用户进入 rename plan 最终确认
- **THEN** UI MUST 展示影视标题、年份、媒体类型和 TMDB ID
- **AND** 如存在海报 URL，UI MUST 展示海报缩略图

#### Scenario: 最终确认存在多行不同媒体信息

- **WHEN** selected rows 包含用户手动修改过的不同 row identity
- **THEN** UI MUST 明确展示每个 row 使用的目标媒体信息或分组摘要
- **AND** UI MUST 避免让用户误以为所有 row 都使用 item 主 identity
