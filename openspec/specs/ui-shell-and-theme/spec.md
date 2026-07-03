## Purpose

定义 Renarr 深色管理台 shell、媒体库页面、item detail 和整理流程的 UI 信息架构与视觉规则。

## Requirements

### Requirement: V1 默认深色媒体管理工具风

系统 SHALL 使用默认深色的媒体管理工具视觉风格，并且 V1 不提供主题切换入口。

#### Scenario: 用户打开应用

- **WHEN** 用户进入 Renarr 前端
- **THEN** UI MUST 默认使用深色主题，并且 MUST NOT 显示主题切换入口

#### Scenario: 页面使用颜色

- **WHEN** 前端页面需要背景、前景、边框、卡片、主色或危险色
- **THEN** 组件 MUST 优先使用 shadcn-svelte/Tailwind 语义 token，而不是在页面中散落硬编码颜色

#### Scenario: 页面使用基础 UI 控件

- **WHEN** 前端页面需要按钮、卡片、dialog、select、switch、checkbox、input、field、table、badge、empty、skeleton 或 sidebar
- **THEN** UI MUST 优先使用已安装或可新增的 shadcn-svelte 组件，而不是自写等价基础控件或使用原生 select

#### Scenario: 页面需要项目级分区

- **WHEN** 页面需要标题、描述、操作区和内容区组成的管理台 section
- **THEN** UI MAY 使用项目级 `SectionPanel` 封装，但该封装底层 MUST 使用 shadcn Card 组合

#### Scenario: 页面需要模态表单

- **WHEN** 页面需要添加类或确认类模态交互
- **THEN** UI MUST 使用 shadcn Dialog 或业务级 Dialog 组件，并且 MUST NOT 使用通用自写 Modal 壳

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

### Requirement: Item detail 媒体化管理视图

系统 SHALL 在 item detail 页面以深色媒体管理台方式展示 item 身份和文件上下文，且 MUST NOT 使用独立摘要 card 作为主要信息容器。

#### Scenario: 用户打开有海报的 item detail

- **WHEN** item 有 poster URL
- **THEN** UI MUST 在详情页主体展示海报，并 MAY 使用海报作为克制的背景视觉线索
- **AND** UI MUST 仍以文件核对、状态和操作确认为主要层级

#### Scenario: 用户查看路径信息

- **WHEN** item detail 渲染
- **THEN** UI MUST 展示 library path、item top-level path 和远端完整路径信息

#### Scenario: 用户查看摘要统计

- **WHEN** item detail 渲染视频数量、符合数量和待整理数量
- **THEN** UI MUST 将这些统计融入媒体信息区，而不是放入独立“Item 摘要”card

#### Scenario: 用户默认打开详情页

- **WHEN** item detail 首次渲染
- **THEN** UI MUST NOT 展示实时文件列表
- **AND** UI MUST 将页面重点放在媒体身份、远端完整路径、扫描统计和整理操作上

### Requirement: 状态视觉克制且一致

系统 SHALL 用一致、克制的状态色表达 library item 状态。

#### Scenario: 渲染 item 状态

- **WHEN** UI 展示 `unidentified`、`pending_review`、`identified` 或 `organized` 状态
- **THEN** UI MUST 使用稳定状态色映射：未识别为灰，待确认为黄/橙，已识别为蓝，已整理为绿

#### Scenario: 普通操作文案

- **WHEN** UI 展示常用按钮、toast 或表格状态
- **THEN** 中文文案 MUST 简短且工具化，例如“扫描”“整理”“待处理”“执行计划”“手动指定”

#### Scenario: 执行失败

- **WHEN** rename task 或 plan item 执行失败
- **THEN** 媒体库主页和 item 媒体信息区 MUST NOT 显示 item status 为失败
- **AND** 用户 MUST 通过任务、日志或 execution records 查看失败详情

### Requirement: 二值控件语义一致

系统 SHALL 按语义区分可立即持久化的开关和表单/批量选择项。

#### Scenario: 用户切换已有对象设置

- **WHEN** 用户在列表中切换已有 Library Path 的自动整理设置
- **THEN** UI MUST 使用 shadcn Switch，并且切换 MUST 调用真实后端持久化接口或 action

#### Scenario: 用户填写创建表单

- **WHEN** 用户在添加 Library Path dialog 中选择初始自动整理值
- **THEN** UI MUST 使用 shadcn Checkbox 或等价表单选择控件，并且只在提交创建表单时保存

#### Scenario: 用户编辑整理计划行

- **WHEN** 用户选择 rename draft row 或确认覆盖冲突文件
- **THEN** UI MUST 使用 shadcn Checkbox，而不是 Switch

### Requirement: 复杂页面按业务区域拆分

系统 SHALL 将复杂页面拆分为业务区域组件，同时保持页面级业务状态和 mutation 的单一归属。

#### Scenario: settings/media 页面重构

- **WHEN** 设置页使用 shadcn 组件重构
- **THEN** 页面 MUST 按元数据设置、文件管理设置、Library Paths、Sources 和添加 dialog 拆分组件

#### Scenario: library detail 页面重构

- **WHEN** 媒体库详情页使用 shadcn 组件重构
- **THEN** 页面 MUST 按 item grid/card、item media detail、manual match dialog 和 rename plan dialog 拆分组件

#### Scenario: 子组件触发业务操作

- **WHEN** 拆分后的子组件需要触发保存、测试、扫描、搜索或提交
- **THEN** 子组件 MUST 通过 props/callback 或表单提交触发页面持有的业务流程，而不是自行创建不相关的全局状态

#### Scenario: library path 页面职责

- **WHEN** `libraries/[id]` 页面渲染
- **THEN** 页面 MUST 只持有 library path 级列表、刷新和扫描状态，并且 MUST NOT 持有 selected item、manual match、item detail 或 rename plan draft 状态

#### Scenario: item detail 页面职责

- **WHEN** `libraries/[id]/[item_id]` 页面渲染
- **THEN** 页面 MUST 按媒体信息、manual match dialog 和 rename plan dialog 组织业务组件，并持有 item 级 mutation 状态

### Requirement: Item detail 操作按钮规则

系统 SHALL 根据 item 状态和待整理数量展示 item detail 主操作按钮。

#### Scenario: Pending review item

- **WHEN** item status 为 `pending_review`
- **THEN** UI MUST 显示“手动指定”按钮
- **AND** UI MUST NOT 显示独立“执行计划”按钮

#### Scenario: Identified item

- **WHEN** item status 为 `identified`
- **THEN** UI MUST 显示“手动指定”和“执行计划”按钮

#### Scenario: Organized item 有待整理文件

- **WHEN** item status 为 `organized` 且 non-compliant file count 大于 0
- **THEN** UI MUST 显示“执行计划”按钮
- **AND** UI MUST NOT 显示“手动指定”按钮

#### Scenario: Organized item 无待整理文件

- **WHEN** item status 为 `organized` 且 non-compliant file count 为 0
- **THEN** UI MUST NOT 显示“执行计划”或“手动指定”按钮

### Requirement: Plan flow 使用 Dialog

系统 SHALL 使用宽 dialog 承载手动指定和执行计划流程。

#### Scenario: 用户点击手动指定

- **WHEN** 用户点击“手动指定”
- **THEN** UI MUST 打开 dialog，并按候选/搜索、计划编辑、最终确认的步骤推进

#### Scenario: 用户点击执行计划

- **WHEN** 用户点击“执行计划”
- **THEN** UI MUST 打开 dialog，并按计划编辑、最终确认的步骤推进

#### Scenario: Dialog 展示长表格

- **WHEN** 计划编辑步骤包含多行长路径
- **THEN** dialog MUST 提供足够宽度和滚动区域，避免页面内容重叠或控件溢出

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
