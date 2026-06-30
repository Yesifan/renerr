## MODIFIED Requirements

### Requirement: 管理台信息架构
系统 SHALL 使用左侧多级树状导航承载主要信息架构，并优先使用 shadcn Sidebar 组合实现 shell 导航。

#### Scenario: 用户查看导航
- **WHEN** 应用 shell 渲染导航
- **THEN** UI MUST 将 library paths 放在“媒体库”分组下，并将“任务”“日志”“设置”放在“系统”分组下

#### Scenario: 用户查看 library path detail
- **WHEN** 用户打开 library path detail
- **THEN** 主体 MUST 使用海报墙 card 展示 root-level 文件夹和视频文件，并且未识别 item MUST 使用默认占位海报

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
- **THEN** UI MUST 将这些统计融入媒体信息区或文件区，而不是放入独立“Item 摘要”card

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
