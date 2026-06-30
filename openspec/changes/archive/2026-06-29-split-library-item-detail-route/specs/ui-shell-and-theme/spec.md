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
- **THEN** UI MUST 导航到 `libraries/[id]/[item_id]` 详情页，并在该页面集中展示远端文件详情、手动识别、扫描和整理计划操作

#### Scenario: 用户浏览海报墙

- **WHEN** 用户查看 `libraries/[id]` 海报墙
- **THEN** 每个海报 card MUST 只展示 item 摘要信息和导航 affordance，并且 MUST NOT 内嵌手动匹配表单、扫描按钮或整理计划操作

### Requirement: 复杂页面按业务区域拆分

系统 SHALL 将复杂页面拆分为业务区域组件，同时保持页面级业务状态和 mutation 的单一归属。

#### Scenario: settings/media 页面重构

- **WHEN** 设置页使用 shadcn 组件重构
- **THEN** 页面 MUST 按元数据设置、文件管理设置、Library Paths、Sources 和添加 dialog 拆分组件

#### Scenario: library detail 页面重构

- **WHEN** 媒体库详情页使用 shadcn 组件重构
- **THEN** 页面 MUST 按 item grid/card、manual match、item detail 和 rename plan panel 拆分组件

#### Scenario: 子组件触发业务操作

- **WHEN** 拆分后的子组件需要触发保存、测试、扫描、搜索或提交
- **THEN** 子组件 MUST 通过 props/callback 或表单提交触发页面持有的业务流程，而不是自行创建不相关的全局状态

#### Scenario: library path 页面职责

- **WHEN** `libraries/[id]` 页面渲染
- **THEN** 页面 MUST 只持有 library path 级列表、刷新和扫描状态，并且 MUST NOT 持有 selected item、manual match、item detail 或 rename plan draft 状态

#### Scenario: item detail 页面职责

- **WHEN** `libraries/[id]/[item_id]` 页面渲染
- **THEN** 页面 MUST 按 item summary、远端文件详情、manual match 和 rename plan 区域组织业务组件，并持有 item 级 query 和 mutation 状态
