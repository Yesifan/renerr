## MODIFIED Requirements

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
- **THEN** 主体 MUST 使用海报墙 card 展示 root-level 文件夹和视频文件，并且未识别 item MUST 使用默认占位海报

#### Scenario: 用户首次打开应用 shell

- **WHEN** 应用 shell 首次渲染
- **THEN** 侧栏导航 MUST 有服务端提供的初始 library path 数据，并且后续动态摘要 MAY 通过职责专一 API 轮询刷新

## ADDED Requirements

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
- **THEN** 页面 MUST 按 item grid/card、manual match、item detail 和 rename plan panel 拆分组件

#### Scenario: 子组件触发业务操作

- **WHEN** 拆分后的子组件需要触发保存、测试、扫描、搜索或提交
- **THEN** 子组件 MUST 通过 props/callback 或表单提交触发页面持有的业务流程，而不是自行创建不相关的全局状态
